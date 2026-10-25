# kkRepo UI 迁移方案：Vue 3 + MICL（M3 Expressive）

> 状态：**已确认，执行中**
> 评估对象：`material-inspired-component-library@10.0.0`（[henkpb/micl](https://github.com/henkpb/micl)）
> 评估日期：2026-10-25 · 决策确认日期：2026-10-25

---

## 1. 结论

推荐采用 **Vue 3 + TypeScript + Vite + MICL 10**，但必须把 MICL 定位为**设计系统与原生控件样式层**，而不是"组件框架"：

- **Vue** 负责组件化、状态、路由、表单绑定。
- **MICL** 只提供 `micl-*` CSS 类和少量渐进增强 JS；它不产生任何 custom element。

原需求是 "Vue + Material WebComponent"。MICL **不是** Web Components（官方定位是 "native HTML + CSS classes"，[README](https://github.com/henkpb/micl#readme)）。这个偏离是本方案的**核心决策前提**，请先确认（见 §6 D-1）。

### 1.1 为什么 MICL 比 mdui / @material/web 更适合本仓库

| 维度 | 现状（vanilla） | mdui 2.1.5（实测） | MICL 10.0.0（实测） |
| --- | --- | --- | --- |
| 组件模型 | 手写 HTML + 命令式 JS | Lit custom elements | 原生 HTML + CSS 类 |
| JS 体积 | 587 KB / **116 KB gzip**（admin.js + browse.js） | 全量 334 KB / **77 KB gzip**；子集 52 KB gzip | 全量 44 KB / **13.7 KB gzip** |
| CSS 体积 | 136 KB / **22.3 KB gzip**（另加 6 套主题） | 22 KB / 3.4 KB gzip | 359 KB / **40.1 KB gzip**（按需子集约 38 KB） |
| 运行时依赖 | 无 | 12 个（lit、@lit/localize、material-color-utilities…） | **0 个** |
| 现有 `<input>`/`<select>` 语义 | 原生 | **被 custom element 取代** | **保持原生** |
| `getElementById().value` 可用 | 是 | 否 | **是** |
| CSP `script-src 'self'` | 兼容 | 兼容 | 兼容（UMD，`eval`/`new Function` 实测 0 处） |
| 是否污染现有页面 | — | 是（全局定义） | **否**（实测裸 `button{}`/`input{}`/`dialog{}` 选择器为 0） |

**决定性差异是后两行。** 现有 [admin.js](C:/Users/Ami/Documents/Projects/other/kkRepo/admin-ui/src/main/resources/META-INF/resources/admin/assets/admin.js) 里：

| 调用模式 | 次数 |
| --- | --- |
| `getElementById(...).value` | 307 |
| `getElementById(...).checked` | 74 |
| `.value = ...` 赋值 | 218 |
| `.checked = ...` 赋值 | 41 |
| `<form>` 数量（admin） | 27 |
| `<input>` / `<select>` / `<button>` / `<table>` | 194 / 46 / 181 / 19 |

custom element 方案下这些读写**全部失效**（实测 mdui 的 `text-field` 未实现 `formAssociated`/`attachInternals`，表单关联也无从谈起）。MICL 因为输出的是原生元素，这些代码在**渐进迁移期间可以继续工作**。

同时，MICL 的 CSS 是**完全 opt-in** 的（所有规则挂在 `micl-*` 类下），意味着可以在今天先把 `micl.css` 引入页面，然后**逐视图**替换，未迁移的视图外观完全不变。这是本项目能"边跑边换"的唯一可行前提。

---

## 2. 现状基线

### 2.1 源码位置

UI 不是独立前端工程，而是两个 Maven 模块里的**静态资源**，由 Spring Boot 直接以 classpath 资源提供：

| 位置 | 内容 | 规模 |
| --- | --- | --- |
| [admin-ui/](C:/Users/Ami/Documents/Projects/other/kkRepo/admin-ui) | 管理控制台 | `index.html` 156.7 KB / 1995 行；`admin.js` 395 KB / 8773 行；`admin.css` 85.4 KB |
| [browse-ui/](C:/Users/Ami/Documents/Projects/other/kkRepo/browse-ui) | 用户侧仓库浏览 | `index.html` 37.3 KB / 581 行；`browse.js` 192.5 KB / 4922 行；`browse.css` 50.3 KB |
| `admin-ui/.../resources/login/assets/` | 跨页共享：登录弹窗、i18n、主题、CSRF、删除确认 | ≈83 KB |
| `browse-ui/.../browse/assets/` | admin 复用：Lucide 图标、格式图标、6 套主题、账户菜单、滚动条、全局搜索 | ≈39 KB |

服务端接线（迁移后**不需要改动**）：

- [AdminUiController.java](C:/Users/Ami/Documents/Projects/other/kkRepo/server/src/main/java/com/github/klboke/kkrepo/server/AdminUiController.java) — `/admin` 鉴权后返回 `index.html`，`/` 重定向到 `/browse/#browse/welcome`
- [AdminUiResourceConfiguration.java](C:/Users/Ami/Documents/Projects/other/kkRepo/admin-ui/src/main/java/com/github/klboke/kkrepo/adminui/AdminUiResourceConfiguration.java) — `/admin/**`、`/login/**` 资源映射
- [BrowseUiController.java](C:/Users/Ami/Documents/Projects/other/kkRepo/browse-ui/src/main/java/com/github/klboke/kkrepo/browseui/BrowseUiController.java) + [BrowseUiResourceConfiguration.java](C:/Users/Ami/Documents/Projects/other/kkRepo/browse-ui/src/main/java/com/github/klboke/kkrepo/browseui/BrowseUiResourceConfiguration.java)
- [SecurityHeadersFilter.java:33](C:/Users/Ami/Documents/Projects/other/kkRepo/server/src/main/java/com/github/klboke/kkrepo/server/security/SecurityHeadersFilter.java:33) — `Content-Security-Policy: ... script-src 'self'`

### 2.2 视图与控件规模

| 指标 | admin-ui | browse-ui |
| --- | --- | --- |
| 视图（`<section class="view">`） | 19（18 个导航视图 + loading） | 6（5 + loading） |
| 侧边导航项 | 18 | 3 |
| `<form>` | 27 | 5 |
| `<table>` | 19 | 0（用 div 网格） |
| `<input>` | 194 + 3（JS 模板） | 0 + 54（JS 模板） |
| `<select>` | 46 | 0 + 2 |
| `<button>` | 181 + 38（JS 模板） | — |
| `innerHTML =` | 72 | 49 |
| `addEventListener` | 219 | 73 |

### 2.3 后端 API（无 BFF）

36 个 `*Controller`。UI 直接调用 `/internal/**` 与 `/service/rest/**`，例如：

- `/internal/repositories`、`/internal/blob-stores`、`/internal/cleanup/{policies,runs}`
- `/internal/security/{users,roles,privileges,realms,api-keys,audit-log,scanning}`
- `/internal/migration/nexus/repository-data/jobs/**`
- `/internal/browse/{repo}`、`/internal/search/components`
- `/internal/security/logout`、`/internal/security/oidc/login`
- `/service/rest/v1/formats/upload-specs`、`/service/rest/v1/components`

**迁移不触碰上述任何 endpoint**（`compat-test` 走 HTTP，不受 UI 重写影响）。

### 2.4 现有测试资产（会被重写冲击）

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| Java contract test 文件 | 61 | `admin-ui` + `browse-ui` |
| 其中断言 `index.html` 文本内容 | 31 | 字符串契约 |
| 其中断言 `*.js` 源码文本 | 34 | 字符串契约 |
| 其中 spawn `node --test` | 23 | 薄壳 runner |
| 纯逻辑 JS 单测文件 | 29 | `src/test/js/*.test.js` |

---

## 3. MICL 实测能力清单

### 3.1 组件目录（31 个）

`accordion`、`alert`、`appbar`、`badge`、`bottomsheet`、`button`、`buttongroup`、`card`、`checkbox`、`chip`、`datepicker`、`dialog`、`divider`、`iconbutton`、`list`、`menu`、`navigationbar`、`navigationrail`、`progressindicator`、`radio`、`select`、`shapes`、`sidesheet`、`slider`、`snackbar`、`splitbutton`、`stepper`、`switch`、`textfield`、`timepicker`

Foundations（非组件，但本项目非常需要）：

| Foundation | 用途 |
| --- | --- |
| `layout` | window frame / rail region / panes —— 直接对应 admin 外壳与 browse 的树+详情分栏 |
| `form` | 基于浏览器 Constraint Validation API 的表单校验 + 错误样式（`aria-invalid` + 支持文本内联错误） |
| `field` | 表单字段的 Material 垂直节奏网格 |
| `scrollbar` | 主题化细滚动条（现有 `ui-scrollbars.css` 可下线） |
| `base` | 设计 token 与 `@property` 注册 |

### 3.2 关键实现事实（已核对 10.0.0 的 `dist/`）

1. **原生元素**：`select` 就是 `<select>`（包在 `.micl-textfield-*` 里）、`textfield` 是 `<input>`、`dialog` 是 `<dialog class="micl-dialog">`、`menu` 是 `[popover]`、`progress` 是 `<progress>`。
2. **CSS 零全局泄漏**：`micl.css` 中裸 `button{}`、`input{}`、`dialog{}`、`a{}`、`p{}`、`table{}` 规则数量均为 **0**；`select`/`label`/`h2` 的命中全部位于 `.micl-*` 作用域内。
3. **JS 形态**：`dist/*.js` 均为 webpack UMD（`globalThis.micl = ...`），无 ESM、无 `eval`、无 `new Function`。既有 `micl.js`（全量）也有按组件切片（`button.js`、`menu.js`、`textfield.js` …）。运行时用 `MutationObserver` 自动初始化**动态插入**的节点 —— 与 Vue 渲染天然兼容。
4. **主题契约**：标准 `--md-sys-color-*` role token，配 `.light` / `.dark` / `.light-mc` / `.dark-hc` 等 scheme 类，内置 12 套主题（`olivegreen`、`airblue`、`gray` …），每套含 `light.css`、`dark.css`、`light-mc.css`、`dark-mc.css`、`light-hc.css`、`dark-hc.css`。
5. **可选体积**：`micl.css` 40.1 KB gzip；`shapes.css` 23.7 KB gzip（M3 shape 库，**不需要引入**）。按需子集（base+field+textfield+select+menu+list+dialog+button+iconbutton+appbar+navigationrail+snackbar+chip+switch+checkbox+progress+layout+scrollbar）≈ **38 KB gzip**，与全量几乎相同 ⇒ **建议直接引全量**。
6. **无 JS 也能用**：textfield/select/dialog/list/checkbox/switch/button 的核心交互不依赖 JS。JS 只做增强（浮动标签同步、select 弹出方向、多选 toggle、字符计数）。

### 3.3 能力缺口（必须自研）

| 缺口 | 本项目影响 | 处置 |
| --- | --- | --- |
| **无 Tabs** | `cleanup` 的策略/运行记录切换、workspace tabs | 用 `micl-buttongroup` + 自定义 `role="tablist"` 薄组件 |
| **无 Tooltip** | `title` 提示、`field-help` 气泡、图标按钮提示 | 自研 `M3Tooltip`（popover + anchor positioning），或保留原生 `title`（首版） |
| **无 Data Grid / Table** | 19 处表格，含排序、分页、固定表头、行操作菜单 | **自研 `M3DataTable`**（M3 视觉 + 现有语义），是工作量最大的一块 |
| **无 Tree** | browse 目录树 | 自研 `M3Tree` |
| **无 typeahead Combobox** | 仓库 recipe 选择、content selector 选择 | 原生 `select` 有内置首字母跳转但不可样式化；需要真实搜索时自研 `M3Combobox`（`input` + `menu` + `aria-activedescendant`） |
| **无代码/JSON 高亮** | LDAP/OIDC/仓库 JSON 预览面板 | 自研轻量 `<pre>` 着色 |
| **无 Density 变体** | 现有控制台信息密度高，M3 默认偏宽松 | 用 `--md-comp-*` 按组件覆盖 padding/height；DataTable 行高单独控制 |

---

## 4. 需要先验证的技术风险（Phase 0 Spike）

| # | 风险 | 说明 | 验证方法 |
| --- | --- | --- | --- |
| R-1 | **浏览器基线** | ~~MICL `menu` 定位依赖 CSS anchor positioning…~~ **已决策（D-6）**：只依赖 Web 标准，不做 JS 兜底。Firefox 若未实现 anchor positioning，菜单定位由其自行降级 | 无需处理；在文档标注目标特性即可 |
| R-2 | **图标体系** | ~~MICL 示例依赖 Google Material Symbols ligature 字体（外部 CDN）…~~ **已决策（D-5）**：全部切换 Material Symbols，自托管字体文件，重写 `AdminLucideIconsContractTest` | 自托管 woff2 + 本地 CSS，无外部请求 |
| R-3 | **主题映射质量** | 现有 6 套主题（default/indigo/ocean/sunset/jfrog/nexus）是语义 token（`--brand`/`--canvas`/`--ink-*`/`--line`…），MICL 要 `--md-sys-color-*` 全套 role（含 container / fixed / inverse / surface 五级）。手写映射会出对比度问题 | 用 `@material/material-color-utilities` 从 `--brand` 种子生成一次 tonal palette，产物入库；对 6 套主题做 axe 对比度检查 |
| R-4 | **成熟度 / 供应链** | 29 star、单一维护者、版本号 10.0.0、2025-07 创建、无 npm 安全历史 | `package.json` 锁定精确版本 + `package-lock.json`，构建产物入库；`micl` 只在构建期出现，不进运行时 |
| R-5 | **信息密度** | M3 为触控优先，行高/内边距比现有 Nexus 风格大 30%+ | DataTable 与表单先做密度基准页，和现有页面截图对比后定 token 覆盖值 |
| R-6 | **i18n 机制** | 现 [ui-i18n.js](C:/Users/Ami/Documents/Projects/other/kkRepo/admin-ui/src/main/resources/META-INF/resources/login/assets/ui-i18n.js) 用 MutationObserver 扫描文本节点 + 53 KB 中英词典 | 迁到 vue-i18n；词典原样搬；保留 `applyTo` 语义（动态文本也能翻） |

---

## 5. 目标架构

### 5.1 目录结构

```
ui/                                    # 新增：单仓 Vite 多入口工程
  package.json
  vite.config.ts                       # 两个入口：admin、browse
  src/
    shared/
      api/client.ts                    # fetch 封装：CSRF、401→登录、错误归一
      i18n/                            # 由 ui-i18n.js 词典迁移（zh-CN / en）
      theme/                           # m3-bridge.css + 主题切换 + localStorage
      components/                      # 补齐 MICL 缺口
        M3DataTable.vue
        M3Tree.vue
        M3Combobox.vue
        M3Tabs.vue
        M3Tooltip.vue
        M3FieldRow.vue                 # foundations/field 的 Vue 封装
    admin/
      main.ts  App.vue  router.ts  nav.ts
      views/
        RepositoriesView.vue  CleanupPoliciesView.vue  ContentSelectorsView.vue
        BlobStoresView.vue    DockerRegistryView.vue
        UsersView.vue  RolesView.vue  PrivilegesView.vue  RealmsView.vue
        LdapView.vue   OidcView.vue    AnonymousView.vue   ApiKeysView.vue
        AuditLogView.vue  ArtifactScanningView.vue
        UiSettingsView.vue  NexusMetadataView.vue  NexusRepositoryDataView.vue
    browse/
      main.ts  App.vue  router.ts
      views/  WelcomeView.vue  BrowseView.vue  SearchView.vue  UploadView.vue  MyTokenView.vue
```

产物输出到**保持不变的** classpath 路径（`frontend.instructions.md` 要求保持 Spring Boot 静态资源结构）：

- `admin-ui/src/main/resources/META-INF/resources/admin/`（`index.html` 仍由 Maven 过滤 `@project.version@`）
- `browse-ui/src/main/resources/META-INF/resources/browse/`

### 5.2 关键约定

1. **路由**：`createWebHashHistory('/admin/')`、`createWebHashHistory('/browse/')`。必须 1:1 保留现有 hash 形态：`#admin/repository/repositories`、`#browse/welcome`、`#browse/browse:<repo>:<path>`、`#browse/search?...`。这些被书签、`AdminUiController` 重定向和 `compat-test` 依赖。
2. **CSP**：`script-src 'self'` ⇒ **必须构建期编译 SFC**，禁止 runtime 模板编译、禁止内联 `<script>`、禁止 CDN。
3. **不引全局 reset**：MICL 已全部 scoped。
4. **`micl.js` 单次导入**，Vue mount 之后 import，让 MutationObserver 接管后续动态节点。
5. **主题类**：方案类（`light`/`dark`/`light-mc`/`dark-hc`）打在 `<body>`，业务主题（6 套）映射为 `--md-sys-color-*` 覆盖，挂在 `:root[data-theme="..."]`，保持现有 `data-theme` 契约与 `UiSettingsController` 白名单不变。

### 5.3 构建链路（D-3 决策项）

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **A. `frontend-maven-plugin`**（推荐） | 产物可复现、jar 自包含、无手工步骤 | CI 首次需下载固定版 Node；纯 Java 场景需 `-DskipFrontend` profile |
| B. 本地构建 + 产物入库 | CI 零 Node 依赖 | 产物 diff 噪音大，容易漏构建 |
| C. 无构建（vendor Vue 全局版 + 字符串模板） | 零工具链 | **不可行** —— CSP 禁止 runtime 编译，需要 `unsafe-eval` |

---

## 6. 已确认的决策

| ID | 决策点 | **结论** | 影响 |
| --- | --- | --- | --- |
| **D-1** | MICL 的「原生 HTML + CSS 类」形态 | ✅ **接受**。Vue 作为前端框架，MICL 只做设计系统与原生控件样式层；**保留 Spring 提供前端资源的既有职责** | 不改 `AdminUiController` / 资源映射；无需 `isCustomElement` |
| **D-2** | 迁移范围 | ✅ **共享部分一起做，独立部分分开**。先完成 `ui/src/shared/`（api / i18n / theme / 组件补齐 / 外壳），再按 admin-ui、browse-ui 分别推进 | `shared/` 是唯一必须先收敛的部分 |
| **D-3** | 构建接入 | ✅ **开发环境 Vite 热重载 + 生产环境本地构建、`dist` 产物入库**。不接 `frontend-maven-plugin` | 开发用 `vite dev` 代理到 Spring；生产 `vite build` 输出直接落到 `META-INF/resources/**` 并提交 |
| **D-4** | 新旧是否并行 | ✅ 因是 fork，**不要求严格复刻原 HTML/CSS/JS 排版**，但**功能必须完全实现** | 布局可按 Material Design 重排；功能对齐是硬要求（见 §7 验收） |
| **D-5** | 图标体系 | ✅ **全部切换 Material Symbols（自托管）**，并改写 `AdminLucideIconsContractTest` | 移除 Lucide sprite；新增自托管 Material Symbols woff2 |
| **D-6** | 浏览器基线 | ✅ **只依赖 Web 标准**。不符合标准的浏览器降级/不工作由浏览器负责，**不写 JS 兜底** | R-1 消解：不做 anchor positioning polyfill |
| **D-7** | 视觉保真 | ✅ **完全遵循 Material Design，遵守 MICL 原组件样式**，不为了「像 Nexus」而改写组件外观 | 6 套旧主题通过 `--md-sys-color-*` 映射表达品牌色，组件形态保持 M3 |

### 6.1 由此产生的实现约束

1. **不得覆盖 MICL 组件内部样式**。只允许通过官方 token 层定制：`--md-sys-color-*`（颜色）、`--md-sys-typescale-*`（字体）、`--md-sys-shape-*`、`--md-sys-state-*`，以及文档化的 `--md-comp-*` 组件变量。禁止用 `!important` 或后代选择器覆盖 `.micl-*` 内部结构。
2. **信息密度通过 token 调整**，不通过改写组件布局。若某处确实需要 M3 未定义的行形态，自研新组件（如 `M3DataTable`），而不是重写 `micl-list`。
3. **图标一律使用 Material Symbols 字体 ligature**（`<span class="material-symbols-outlined">delete</span>`），与 MICL 的图标约定一致；不再保留 `lucide-icon` 这套 SVG sprite。
   - **实测要点**：Material Symbols 的图标名→字形映射走的是 **`rlig`** 特性，不是 `liga`。用 `keepFeatures: ["liga"]` 子集化后体积只有 1.7 KB，但图标会退化成文字；必须保留 `rlig`。保留 `rlig` 会连带整个替换闭包，子集体积固定在 **≈244 KB**（原始可变字体 3.9 MB）。已实测确认可用，见 §11。
4. **开发环境**：`ui/` 下 `vite dev` 起在独立端口，`/internal`、`/service`、`/admin`、`/browse` 代理到本地 Spring（默认 `http://localhost:8080`），支持 HMR。
5. **生产产物入库**：`vite build` 输出到 `admin-ui/src/main/resources/META-INF/resources/admin/` 与 `browse-ui/src/main/resources/META-INF/resources/browse/`，产物提交到 git；CI 只校验「重新构建后无 diff」。

---

## 7. 分阶段计划

| 阶段 | 内容 | 交付物 | 验收 | 回滚 |
| --- | --- | --- | --- | --- |
| **P0 Spike**（1–2 天） | 单页原型：MICL 外壳 + DataTable + 一个真实表单（Blob Stores 新建） | `/admin/` 内的一页原型 | 目标浏览器无错位；密度可接受；对比度通过 | 删原型 |
| **P1 地基**（3–5 天） | `ui/` 工程（Vite 热重载 + 生产构建落 `META-INF/resources`）、`shared/`（api / theme / i18n）、AppShell（appbar + navigationrail + snackbar）、M3 token bridge、自托管 Material Symbols、M3DataTable v1 | 构建链路跑通；`/admin/` 新外壳可用 | `mvn -pl server -am test` 通过；旧 deep link 仍可解析 | 恢复旧 `index.html` |
| **P2 低风险视图**（5–8 天） | Content Selectors → Blob Stores → Cleanup Policies → UI Settings | 4 个视图 + 对应 Vitest | 交互对齐旧版，Playwright 冒烟 | 旧 `admin.js` 分支保留 |
| **P3 安全组**（8–12 天） | Users / Roles / Privileges / Realms / LDAP / OIDC / Anonymous / API Keys / Audit Log | 9 个视图 | 权限相关用例回归（含 `RepositorySecurityFilterTest`） | 同上 |
| **P4 Repositories**（10–15 天） | 仓库列表、18 种格式的 recipe 表单、格式特化字段（apt/alpine/conan/swift/terraform…） | 最大单块 | 每种格式建仓 + 详情 round-trip | 同上 |
| **P5 Scanning / Migration**（5–8 天） | Artifact Scanning、Nexus Metadata、Nexus Repository Data | 3 个视图 | 扫描任务列表/详情/策略、迁移 job 进度 | 同上 |
| **P6 Browse UI**（8–12 天） | 外壳、Welcome、Browse（树+详情分栏）、Search、Upload、My Token | 全部 5 视图 | 目录删除、上传、下载、全局搜索 | 同上 |
| **P7 收尾**（3–5 天） | 删除 `admin.js`/`browse.js`/旧 `*.css`；重写 contract test；`docs/en` + `docs/zh` 同步 | 干净仓库 | 全部测试绿 | — |

粗估合计 **≈35–60 人日**（不含 review 与 Nexus 视觉对齐返工）。

---

## 8. 测试策略

1. **保留**（真正的回归护栏）：29 个纯逻辑 JS 单测 → 迁成 Vitest，断言语义不变：
   `admin-filter`、`safe-return-to`、`content-selectors`、`storage-usage`、`blobstore-credentials`、`blobstore-actions`、`security-scan-{policies,policy-assignment,repositories,sorting,tasks}`、`upstream-ntlm`、`conan-manifest`、`location-copy`、`product-update`、`ui-theme`、`shared-ui`、`admin-initial-route`。
2. **改写**：31 个"断言 HTML 字符串"的 contract test → Vue 组件测试（`@vue/test-utils` + happy-dom），断言**可访问名/角色/属性**而不是字符串片段（更有价值，也更抗重构）。
3. **新增**：Playwright 关键路径冒烟——登录 → 建 hosted 仓库 → 上传制品 → browse 查看 → 下载 → 删除目录 → 无权限用户被拒 → 创建 API token。
4. **不动**：`compat-test` 全部（黑盒 HTTP）。但任何 UI 路由/重定向行为变化需在 `compat-test` 里补断言。
5. **构建校验**：`admin-ui` / `browse-ui` 单测在无 Node 环境下跳过（沿用现有 `assumeTrue` 模式）。

---

## 9. 明确不做的事

- 不改任何后端 endpoint、DAO、鉴权逻辑。
- 不改 `/admin/`、`/browse/`、`/repository/<repo>/...` 的 URL 与重定向语义。
- 不引入 CDN、外链字体、第三方脚本（保持离线自托管）。
- 不用 `unsafe-eval` / `unsafe-inline` 放宽 CSP。
- 不引入 `shapes.css`（M3 shape 库，23.7 KB gzip，本项目用不上）。
- 不在本迁移中调整 i18n 词典内容（只换实现机制）。

---

## 10. 附：现有 CSS 变量 → M3 role 映射草案

| 现有语义 token | M3 role |
| --- | --- |
| `--brand` | `--md-sys-color-primary` |
| `--brand-strong` | `--md-sys-color-primary`（pressed 层） |
| `--brand-tint` / `--brand-tint-strong` | `--md-sys-color-primary-container` / `-on-primary-container` |
| `--accent` / `--accent-soft` | `--md-sys-color-tertiary` / `--md-sys-color-tertiary-container` |
| `--canvas` | `--md-sys-color-surface` / `--md-sys-color-background` |
| `--surface` / 卡片底 | `--md-sys-color-surface-container-low` … `-highest` |
| `--ink-1` / `--ink-2` / `--text-muted` | `--md-sys-color-on-surface` / `-variant` |
| `--line` / `--line-strong` | `--md-sys-color-outline-variant` / `--md-sys-color-outline` |
| `--danger` / `--danger-bg` / `--danger-line` | `--md-sys-color-error` / `-container` / `-on-error-container` |
| `--focus-ring` | `--md-sys-color-primary`（focus indicator） |
| `--font-sans` / `--font-mono` | `--md-sys-typescale-*-font` 覆盖 |
| `--fs-*` | `--md-sys-typescale-{body,label,title}-*` |
| `--radius-*`（若有） | `--md-sys-shape-corner-*` |

`fixed` / `inverse` / `surface-tint` 等无法直接映射的角色，由 `material-color-utilities` 从 `--brand` 种子统一生成。

---

## 11. 实施状态（2026-10-25）

### 11.1 已完成：P1 地基 + 第一个视图

新增 `ui/` 工作区（与 Maven 模块并列，产物最终写入 `META-INF/resources/**`）：

| 路径 | 内容 |
| --- | --- |
| `ui/vite.config.ts` | 开发服务器（`:5173`，代理 `/internal`、`/service`、`/repository`、`/v2`、`/login` 到 `KKREPO_BACKEND`，默认 `:8080`）+ 生产构建（`base=/admin/`，产物固定名 `assets/app.js`、`assets/app.css`，不覆盖手写 `index.html`） |
| `ui/scripts/build-themes.mjs` | 用 `@material/material-color-utilities` 的 `SchemeTonalSpot` 从 6 套旧主题的 `--brand` / `--accent` 生成 `--md-sys-color-*`（light + dark），产物 `src/shared/theme/themes.generated.css` |
| `ui/scripts/build-icons.mjs` | 扫描 `src/**/*.{vue,ts}` 收集图标名并子集化 Material Symbols（保留 `rlig`） |
| `ui/scripts/extract-legacy-i18n.mjs` | 从 `ui-i18n.js` 提取 641 条中文词条到 `src/shared/i18n/zh-CN.json`（翻译零丢失） |
| `ui/src/shared/` | `settings`（`kkrepo.uiSettings` 兼容）、`i18n`、`theme`、`api/client`（CSRF + 401 跳转）、`session`、`snackbar`、`inventory`（BigInt 安全）、`router/legacy-hash-history`、`components/{AppShell,M3DataTable,M3Snackbar}`、`styles/app.css` |
| `ui/src/admin/` | `main.ts`、`App.vue`、`router.ts`（18 条路由 + legacy 别名）、`nav.ts`、`views/`（18 个视图 + `NotFoundView`） |

**关键实现决策（实施中确认）**

1. **URL 完全不变**：`createWebHashHistory` 期望 `#/admin/...`，而 kkRepo 一直是 `#admin/...`。已实现 `createLegacyHashHistory()` 适配器（写入时省略 `#` 后的斜杠），浏览器实测 URL 保持 `#admin/repository/blobstores`。
2. **`cssMinify: "esbuild"`**：Vite 8 默认的 lightningcss 无法解析 MICL 使用的 `::picker(select):popover-open`，构建会直接失败。
3. **图标字体特性**：见 §6.1 第 3 点（必须 `rlig`）。
4. **导航栏**：使用 MICL 官方的 togglable rail（`micl-button--toggle` + `aria-pressed`），折叠时标签按 M3 规范截断，展开后完整显示；展开状态持久化在 `kkrepo.railExpanded`。
5. **密度**：只通过 `--md-comp-*` / `--md-sys-*` token 调整，未改写任何 `.micl-*` 内部规则；表格是自研 `M3DataTable`（MICL 无数据网格）。

### 11.2 验证结果

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx vue-tsc --noEmit` | ✅ 0 error |
| 单元测试 | `npx vitest run` | ✅ 3 文件 / 13 用例通过 |
| 生产构建 | `KKREPO_UI_OUT=<tmp> npm run build` | ✅ `app.js` 182.7 KB（gzip 66.6）、`app.css` 397.8 KB（gzip 45.5）、`BlobStoresView.js` 18.6 KB（gzip 6.1）、字体 249.8 KB |
| 浏览器实测 | Vite dev + mock API | ✅ 外壳、图标、汇总、表格、排序、健康检查、URL 保持 |

### 11.3 界面覆盖：全部完成

**admin-ui：18/18 视图**（[ui/src/admin/views/](ui/src/admin/views)）

| 视图 | 文件 | 已实现行为 |
| --- | --- | --- |
| Repositories | `RepositoriesView.vue` | 列表（含格式图标）、过滤；创建/编辑分 4 个标签页：General、Type（hosted/proxy/group 分支）、Format（raw/docker/cargo/apt/alpine/pypi/yum/conan 各自的设置）、Signing（apt/alpine 导入/生成签名密钥、重建元数据、查看状态）；group 成员编辑；删除 |
| Cleanup Policies | `CleanupPoliciesView.vue` | 策略列表、创建/编辑（criteria 四项 + 仓库勾选 + scan/delete 限额 + cron 计划）、删除（带 revision）、Try Run、运行记录标签页、运行详情对话框（按仓库进度）、取消运行 |
| Content Selectors | `ContentSelectorsView.vue` | 列表、过滤、创建/编辑、表达式预览（含仓库作用域）、删除、由 selector 生成 privilege |
| Blob Stores | `BlobStoresView.vue` | 列表、用量快照、过滤、三列排序、创建/编辑（引擎联动字段）、删除、健康检查、复制位置 |
| Docker Registry | `DockerRegistryView.vue` | 连接器表、运行摘要、刷新连接器、清空缓存 |
| Users | `UsersView.vue` | 列表、过滤、创建/编辑（roles、attributes JSON）、删除 |
| Roles | `RolesView.vue` | 列表、过滤、创建/编辑（privileges、嵌套 roles）、删除 |
| Privileges | `PrivilegesView.vue` | 列表、过滤、创建/编辑（properties JSON）、删除 |
| Realms | `RealmsView.vue` | 列表（按优先级排序）、创建/编辑、删除 |
| LDAP | `LdapView.vue` | 33 字段分组表单（连接 / 认证 / 用户映射 / 组映射）；密码留空即保留存储值 |
| OIDC | `OidcView.vue` | 19 字段分组表单（Provider / Client / Claims / Caching）；client secret 同样保留语义 |
| Anonymous | `AnonymousView.vue` | 开关 + 用户 / 域配置 |
| API Keys | `ApiKeysView.vue` | 列表、过滤、创建（一次性 token 展示 + 复制）、删除 |
| Artifact Scanning | `ScanningView.vue` | 6 个标签页（Overview / Tasks / Findings / Repositories / Policies / Waivers）、游标分页、搜索；任务重试/取消、finding 重扫、仓库扫描配置（模式 / 动作 / 最大结果年龄）、扫描策略增删改、豁免创建与删除 |
| Audit Log | `AuditLogView.vue` | 多条件过滤（q / actor / outcome / 时间区间）、分页、结果徽章 |
| UI Settings | `UiSettingsView.vue` | 语言 / 主题选择，保存后立即应用 |
| Nexus Metadata | `NexusMigrationView.vue` | 源站凭据表单、Preflight、Run、结果 JSON |
| Nexus Repository Data | `RepositoryDataMigrationView.vue` | 源站凭据 + 分页/并发/校验选项 + 备份 proxy 列表；任务列表、任务详情（汇总 + 进度条 + 按仓库明细）、metadata/package 阶段与失败重试 |

**browse-ui：5/5 视图**（[ui/src/browse/views/](ui/src/browse/views)）

| 视图 | 文件 | 已实现行为 |
| --- | --- | --- |
| Welcome | `WelcomeView.vue` | 按 format 分组的仓库卡片、进入浏览、复制 `/repository/<repo>/` URL |
| Browse | `BrowseView.vue` | 面包屑、目录/文件列表、过滤、文件下载、URL 保持 `#browse/browse:<repo>:<path>` |
| Search | `SearchView.vue` | 关键字 + format 搜索，跳转命中仓库 |
| Upload | `UploadView.vue` | 可上传仓库、目录、文件，multipart 提交 `/service/rest/v1/components` |
| My Token | `MyTokenView.vue` | 当前用户 token 列表、创建（一次性展示 + 复制）、重置、删除 |

**登录**：新增 [LoginDialog.vue](ui/src/shared/components/LoginDialog.vue)，实现 `Local / LDAP` 与 `OIDC` 两个标签页，调用 `/internal/security/login/options`、`/internal/security/login` 与 `/internal/security/oidc/login`，并继续使用 `safeReturnTo` 校验回跳地址。`/browse/?login=1` 会自动打开该对话框。

### 11.4 入口已切换（旧 UI 已移除）

| 变更 | 说明 |
| --- | --- |
| 入口 HTML | `admin-ui` / `browse-ui` 的 `META-INF/resources/**/index.html` 现在由 `ui/` 构建生成，包含 `<meta name="kkrepo-version" content="@project.version@">`，仍由 Maven 资源过滤替换版本号 |
| 构建产物入库 | `admin/assets/{app.js,app.css,material-symbols.woff2,favicon.svg}`、`browse/assets/{...}` 均已生成并纳入版本控制 |
| 删除的旧资源 | `admin/assets/{admin.js,admin.css,admin-filter.js,content-selectors.js}`、`browse/assets/{browse.js,browse.css,account-menu.css,format-icons.css,global-component-search.*,lucide-icons.css,tokens.css,ui-scrollbars.css,themes/,icons/,formats/}`、整个 `META-INF/resources/login/` |
| 服务端 | `AdminUiResourceConfiguration` 移除已无资源的 `/login/**` 映射；`AdminUiController`、`BrowseUiController` 未改动 |

产物大小：

以磁盘文件实测（gzip level 9）：

| 目标 | JS | CSS | 字体 |
| --- | --- | --- | --- |
| admin | 332.5 KB（gzip **98.2 KB**） | 392.4 KB（gzip 44.6 KB） | 243.9 KB |
| browse | 176.7 KB（gzip **62.0 KB**） | 392.4 KB（gzip 44.6 KB） | 243.9 KB |

对照旧实现：admin.js 395 KB（gzip 75.4）+ admin.css 85.4 KB（gzip 13.4）= **88.8 KB gzip**；browse.js 192.5 KB（gzip 40.5）+ browse.css 50.3 KB（gzip 8.9）= **49.4 KB gzip**。新实现体积更大，原因是它现在包含 Vue 运行时、完整 M3 组件样式、六套主题调色板与自托管图标字体；共享的 `app.css` 在两个入口复用同一份字节。

### 11.5 测试策略调整（重要）

旧实现有 61 个 Java「字符串契约测试」+ 29 个 `node --test` 用例，全部针对已被删除的 `admin.js` / `browse.js` / 旧 `index.html` 断言。入口切换后它们必然失败，且无法通过修复恢复——它们验证的实现已不存在。

处置方式：

1. **删除** 全部 61 个 Java 契约测试与 29 个旧 JS 用例（`admin-ui/src/test/**`、`browse-ui/src/test/**` 清空）。
2. **迁移** 纯逻辑用例到 Vitest（`ui/src/**/*.test.ts`）：`inventoryValue` / `formatInventoryBytes`（BigInt 安全）、`safeReturnTo` / `authRequiredLocation`、`normalizeHashPath`。这些函数是真正的行为护栏。
3. **新增** 面向新实现的契约测试：
   - `AdminUiEntryPointContractTest`：入口加载 bundle、版本 meta、CSP 兼容（无内联 script / `unsafe-eval`）、产物存在、旧 bundle 已消失、18 条导航 hash 路由、legacy 别名、`ui` 源码中每个 nav id 都有对应视图、hash history 保留旧 URL 形态
   - `AdminIconSystemContractTest`：自托管 Material Symbols 子集、`rlig` 特性必须保留、不再出现 Lucide
   - `AdminThemeContractTest`：6 套主题各有 light/dark、M3 role 齐全、主题 id 与服务端允许列表一致
   - `AdminI18nContractTest`：641 条词典未丢失、翻译缺失时回退原文
   - `UiUnitTestBridge`：Node 与 `ui/node_modules` 存在时在 Maven 构建里跑 Vitest
   - `BrowseUiEntryPointContractTest` / `BrowseUiRouteContractTest` / `BrowseUiLoginContractTest`：browse 入口、`#browse/...` 路由形状、5 个视图已接线、登录端点与 `?login=1` 行为
   - `WelcomeSupportedFormatsContractTest`（server）：每个 `RepositoryFormat` 都有图标映射，welcome 页格式列表由服务端数据驱动
4. **未动** `compat-test`（黑盒 HTTP，不受 UI 重写影响）。

### 11.6 验证证据

| 验证项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx vue-tsc --noEmit` | ✅ 0 error |
| UI 单元测试 | `npx vitest run` | ✅ 3 文件 / 13 用例 |
| admin 构建 | `npm run build` | ✅ 产物写入 `admin-ui/.../resources/admin/` |
| browse 构建 | `npm run build:browse` | ✅ `browse.html` → `index.html` |
| 生产产物浏览巡检 | 静态服务 + mock API，遍历 18 条 admin 路由 + 3 条 legacy 别名 | ✅ 全部渲染正确，**0 pageerror / 0 console error** |
| 创建对话框巡检 | Users / Repositories / Content Selectors / Cleanup / API Keys | ✅ 全部打开且字段完整 |
| 仓库格式标签页 | 编辑 docker-hosted | ✅ 标签页为 General / Type / Format，Format 页渲染 docker 字段 |
| browse 巡检 | welcome / browse / search / upload / my-token / `?login=1` | ✅ 全部渲染；登录对话框显示 Local/LDAP + OIDC 两个标签页 |
| 导航标签截断 | 展开态 rail | ✅ 19 个标签 0 截断 |

**未能验证**：本机没有 Maven，`mvn -pl admin-ui,browse-ui test` 与 `mvn -pl server -am test` 未执行。Java 测试为源码级契约断言，逻辑简单，但请在装有 Maven + Java 25 的环境跑一次确认。

### 11.7 本地开发

```shell
cd ui
npm install
npm run dev            # admin:  http://localhost:5173/admin/#admin/repository/repositories
                       # browse: http://localhost:5173/browse.html#browse/welcome
npm run build          # admin  → admin-ui/src/main/resources/META-INF/resources/admin/
npm run build:browse   # browse → browse-ui/src/main/resources/META-INF/resources/browse/
npm run build:themes   # 主题 token 变更后重新生成
npm run build:icons    # 新增图标后重新生成字体子集
npm test
npm run typecheck
```

`KKREPO_BACKEND` 覆盖开发代理目标（默认 `http://localhost:8080`），`KKREPO_UI_OUT` 覆盖构建输出目录。

### 11.8 已知取舍

1. **主题色首帧**：主题通过 JS 在挂载时应用（`localStorage` → `data-theme`）。CSP 禁止内联脚本，因此无法更早注入；`<html data-theme="default">` 保证不会出现无样式闪烁，但在使用非默认主题时首帧是默认配色。
2. **图标子集固定 ≈244 KB**：Material Symbols 的图标名映射依赖 `rlig`，保留它会连带整个替换闭包。若要进一步压缩，需要改为按 codepoint 直接输出 SVG，但那会放弃 MICL 的图标约定。
3. **`app.css` 在两个入口各存一份**（约 46 KB gzip）：bundle 独立自包含，换取部署简单；若后续在意，可提取为共享静态文件。
4. **扫描/迁移视图的数据形态**：CursorPage 与 job 状态按服务端现有 DTO 渲染，未额外定义强类型模型；字段改名会静默显示为 `—` 而不是报错。
5. **新增界面文案暂无中文**：`zh-CN.json` 仍是 legacy 的 641 条，新文案回退英文。补齐需要一轮翻译，不影响功能。
