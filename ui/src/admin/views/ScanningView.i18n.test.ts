import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { setLanguage } from "../../shared/i18n";

const api = vi.hoisted(() => ({ get: vi.fn(), send: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/api/client", () => ({ api }));
import ScanningView from "./ScanningView.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  setLanguage("en");
});
beforeEach(() => {
  setLanguage("zh-CN");
  vi.clearAllMocks();
  api.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/summary")) return { deploymentEnabled: true, scanner: { ready: true }, summary: {} };
    if (path.endsWith("/config")) return { enforcementMode: "AUDIT", pendingAction: "ALLOW", failureAction: "BLOCK", partialAction: "ALLOW" };
    return { items: [{
      id: 1, name: "npm-proxy", repository: "npm-proxy", format: "npm", type: "PROXY",
      stage: "CATALOG_AND_MATCH", status: "PENDING", severity: "HIGH", blockSeverity: "CRITICAL",
      assetPath: "org/example/demo.jar", advisoryId: "CVE-2026-0001", scopeType: "repository",
    }] };
  });
  api.send.mockResolvedValue({});
});

async function open(): Promise<VueWrapper> {
  const wrapper = mount(ScanningView);
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

async function click(wrapper: VueWrapper, selector: string, text: string) {
  const node = wrapper.findAll(selector).find((item) => item.text().endsWith(text));
  expect(node, text).toBeDefined();
  await node!.trigger("click");
  await flushPromises();
}

function options(wrapper: VueWrapper, selector: string) {
  return wrapper.findAll(`${selector} option`).map((node) => ({ value: node.attributes("value"), label: node.text() }));
}

describe("ScanningView Chinese display contracts", () => {
  it("translates overview, dynamic table columns and states but preserves repository names, paths and protocol identifiers", async () => {
    const wrapper = await open();
    expect(wrapper.text()).toContain("待处理候选项");
    expect(wrapper.text()).toContain("运行中任务");
    await click(wrapper, ".kk-tab", "任务");
    expect(wrapper.text()).toContain("尝试次数");
    expect(wrapper.text()).toContain("待处理");
    expect(wrapper.text()).toContain("生成清单并匹配漏洞");
    expect(wrapper.text()).toContain("org/example/demo.jar");
    await click(wrapper, ".kk-tab", "仓库");
    expect(wrapper.text()).toContain("npm-proxy");
    expect(wrapper.text()).toContain("PROXY");
    expect(wrapper.text()).toContain("npm");
    await click(wrapper, ".kk-tab", "漏洞结果");
    expect(wrapper.text()).toContain("CVE-2026-0001");
    expect(wrapper.text()).toContain("高危");
  });

  it("translates severity, enforcement and action options without changing their API values", async () => {
    const wrapper = await open();
    await click(wrapper, ".kk-tab", "策略");
    await click(wrapper, "button", "创建策略");
    expect(options(wrapper, "#policy-severity")).toEqual([
      { value: "UNKNOWN", label: "未知" }, { value: "NEGLIGIBLE", label: "可忽略" },
      { value: "LOW", label: "低危" }, { value: "MEDIUM", label: "中危" },
      { value: "HIGH", label: "高危" }, { value: "CRITICAL", label: "严重" },
    ]);
    await wrapper.get("#policy-name").setValue("test-policy");
    await wrapper.get("#policy-severity").setValue("CRITICAL");
    const policyDialog = wrapper.get("#policy-name").element.closest("dialog")!;
    (policyDialog.querySelector(".micl-dialog__actions .micl-button-filled-s") as HTMLButtonElement).click();
    await flushPromises();
    expect(api.send).toHaveBeenCalledWith("/internal/security/scanning/policies", "POST", expect.objectContaining({ name: "test-policy", blockSeverity: "CRITICAL" }));
    await click(wrapper, ".kk-tab", "仓库");
    await click(wrapper, "button", "配置");
    expect(options(wrapper, "#config-mode")).toEqual([{ value: "AUDIT", label: "仅审计" }, { value: "ENFORCE", label: "强制执行" }]);
    for (const selector of ["#config-pending", "#config-failure", "#config-partial"]) {
      expect(options(wrapper, selector)).toEqual([{ value: "ALLOW", label: "允许" }, { value: "BLOCK", label: "阻断" }]);
    }
  });

  it("translates waiver scope options but preserves the scope values", async () => {
    const wrapper = await open();
    await click(wrapper, ".kk-tab", "豁免");
    await click(wrapper, "button", "创建豁免");
    expect(options(wrapper, "#waiver-scope")).toEqual([
      { value: "repository", label: "仓库" }, { value: "asset", label: "制品" }, { value: "finding", label: "漏洞结果" },
    ]);
    expect(wrapper.get("#waiver-advisory").attributes("placeholder")).toBe("CVE-2026-1234");
    expect(wrapper.get("#waiver-package").attributes("placeholder")).toBe("pkg:maven/org.example/demo");
  });
});
