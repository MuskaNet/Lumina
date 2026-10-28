<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { session } from "../../shared/session";
import { browseHash, navigate } from "../route";
import { buildUploadForm, newUploadDraft, type UploadDraft, type UploadSpec } from "../upload";
import UploadFields from "../components/UploadFields.vue";

interface Repository {
  name: string;
  format?: string | null;
  type?: string | null;
}

defineProps<{ repositories: Repository[] }>();
const repositories = ref<Repository[]>([]);
const specs = ref<UploadSpec[]>([]);
const selected = ref("");
const loading = ref(true);
const busy = ref(false);
const status = ref("");
let sequence = 0;
const component = ref<UploadDraft>(newUploadDraft([]));
const assets = ref<{ id: number; draft: UploadDraft }[]>([]);
const target = computed(() => repositories.value.find((repo) => repo.name === selected.value));
const spec = computed(() => specs.value.find((item) => item.format.toLowerCase() === target.value?.format?.toLowerCase()));
const uploadable = computed(() => repositories.value.filter((repo) => specs.value.some((item) => item.format.toLowerCase() === repo.format?.toLowerCase())));
const groups = computed(() => {
  const result = new Map<string, UploadSpec["componentFields"]>();
  for (const field of spec.value?.componentFields ?? []) {
    const name = field.group || "Component attributes";
    if (!result.has(name)) result.set(name, []);
    result.get(name)!.push(field);
  }
  return Array.from(result, ([name, fields]) => ({ name, fields }));
});

function addAsset() {
  if (spec.value) assets.value.push({ id: ++sequence, draft: newUploadDraft(spec.value.assetFields) });
}

watch([selected, spec], () => {
  status.value = "";
  component.value = newUploadDraft(spec.value?.componentFields ?? []);
  assets.value = [];
  addAsset();
});

async function load() {
  loading.value = true;
  status.value = "";
  try {
    const [repos, definitions] = await Promise.all([
      api.get<Repository[]>("/internal/repositories/uploadable"),
      api.get<UploadSpec[]>("/service/rest/v1/formats/upload-specs"),
    ]);
    specs.value = definitions;
    repositories.value = repos;
    if (!uploadable.value.some((repo) => repo.name === selected.value)) {
      selected.value = uploadable.value[0]?.name ?? "";
    }
  } catch (error) {
    status.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(() => session.value?.userId, (userId) => { if (userId) void load(); });

async function upload() {
  if (busy.value || !selected.value || !spec.value) return;
  status.value = "";
  try {
    const form = buildUploadForm(spec.value, component.value, assets.value.map((asset) => asset.draft));
    busy.value = true;
    await api.send(`/service/rest/v1/components?repository=${encodeURIComponent(selected.value)}`, "POST", form);
    showToast(t("Component uploaded successfully."), "ok");
    navigate(browseHash(selected.value, String(component.value.values.directory ?? "")));
  } catch (error) {
    status.value = t((error as Error).message);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <form class="kk-upload-container" @submit.prevent="upload">
    <header class="kk-upload-heading">
      <h2 class="kk-empty-state__title kk-upload-heading__title">{{ t("Upload a component") }}</h2>
      <p class="kk-upload-heading__subtitle">
        {{ t("Upload assets to a hosted repository using format-specific component specifications.") }}
      </p>
    </header>

    <fieldset class="kk-upload-fields" :disabled="loading || busy">
      <!-- 步骤 1：仓库选择 -->
      <section class="kk-upload-step-card">
        <header class="kk-upload-step-card__head">
          <span class="kk-upload-step-badge">1</span>
          <div class="kk-upload-step-card__title-group">
            <h3 class="kk-upload-step-title">{{ t("Select target repository") }}</h3>
            <p class="kk-upload-step-desc">{{ t("Choose the hosted repository to publish components to.") }}</p>
          </div>
        </header>
        <div class="kk-upload-step-body">
          <div class="micl-textfield-outlined kk-field--wide">
            <label for="upload-repository">{{ t("Repository") }}</label>
            <select id="upload-repository" v-model="selected" :disabled="!uploadable.length" required>
              <option v-if="!uploadable.length" value="">{{ t("No uploadable repositories") }}</option>
              <option v-for="repo in uploadable" :key="repo.name" :value="repo.name">{{ repo.name }} ({{ repo.format }})</option>
            </select>
          </div>
        </div>
      </section>

      <template v-if="spec">
        <!-- 步骤 2：命名空间与组件属性配置 -->
        <section v-for="(group, gIdx) in groups" :key="group.name" class="kk-upload-step-card kk-upload-step-card--namespace">
          <header class="kk-upload-step-card__head">
            <span class="kk-upload-step-badge">{{ 2 + gIdx }}</span>
            <div class="kk-upload-step-card__title-group">
              <h3 class="kk-upload-step-title">{{ t(group.name) }}</h3>
              <p class="kk-upload-step-desc">{{ t("Specify the namespace coordinates and release attributes.") }}</p>
            </div>
          </header>
          <div class="kk-upload-step-body">
            <UploadFields :fields="group.fields" :draft="component" prefix="upload-component" />
          </div>
        </section>

        <!-- 步骤 3：资产文件上传 -->
        <section class="kk-upload-step-card">
          <header class="kk-upload-step-card__head">
            <span class="kk-upload-step-badge">{{ 2 + groups.length }}</span>
            <div class="kk-upload-step-card__title-group">
              <h3 class="kk-upload-step-title">{{ t("Assets") }}</h3>
              <p class="kk-upload-step-desc">{{ t("Attach binary assets, signatures or package files.") }}</p>
            </div>
          </header>
          <div class="kk-upload-step-body">
            <div v-for="(asset, index) in assets" :key="asset.id" class="kk-upload-asset-card">
              <div v-if="spec.multipleUpload" class="kk-upload-asset-header">
                <span class="kk-upload-asset-title">{{ t("Asset #") }}{{ index + 1 }}</span>
                <button v-if="assets.length > 1" type="button" class="micl-button-text-s" @click="assets.splice(index, 1)">{{ t("Remove asset") }}</button>
              </div>
              <UploadFields :fields="spec.assetFields" :draft="asset.draft" :prefix="`upload-asset-${asset.id}`" />
            </div>
            <div v-if="spec.multipleUpload" class="kk-upload-add-action">
              <button type="button" class="micl-button-tonal-s kk-pill-btn" @click="addAsset">
                <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>{{ t("Add another asset") }}
              </button>
            </div>
          </div>
        </section>
      </template>

      <!-- 核心操作按钮 -->
      <div class="kk-upload-actions">
        <button type="submit" class="micl-button-filled-s kk-primary-pill-btn" :disabled="!spec || !selected">
          <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">upload</span>
          <span>{{ busy ? t("Uploading…") : t("Upload") }}</span>
        </button>
        <span v-if="target" class="micl-chip-assist kk-tonal-chip">
          <span class="material-symbols-outlined kk-tonal-chip__icon" aria-hidden="true">category</span>
          {{ target.format }}
        </span>
      </div>
    </fieldset>
    <p v-if="status" class="kk-form-error" role="alert">{{ status }}</p>
  </form>
</template>

<style scoped>
.kk-upload-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  inline-size: 100%;
  margin-inline: 0;
}

.kk-upload-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kk-upload-heading__title {
  margin: 0;
  font-family: var(--md-ref-typeface-brand, var(--md-ref-typeface-plain));
  font-size: var(--md-sys-typescale-headline-small-size, 1.5rem);
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.kk-upload-heading__subtitle {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.5;
}

.kk-upload-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
  margin: 0;
  border: 0;
  min-inline-size: 0;
}

.kk-upload-step-card {
  background-color: var(--md-sys-color-surface-container);
  border-radius: 24px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.kk-upload-step-card__head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.kk-upload-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 32px;
  block-size: 32px;
  border-radius: 50%;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.kk-upload-step-card__title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kk-upload-step-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  line-height: 1.3;
}

.kk-upload-step-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
}

.kk-upload-step-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 命名空间输入框在桌面端保持 3 列网格，移动端自动降级为单栏垂直堆叠 */
.kk-upload-step-card--namespace :deep(.kk-upload-fields-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

/* Field wrappers are rendered by UploadFields, so the span overrides must
 * pierce the child component scope. */
.kk-upload-step-card--namespace :deep(.kk-upload-fields-grid .kk-field--span-3),
.kk-upload-step-card--namespace :deep(.kk-upload-fields-grid .kk-field--wide) {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .kk-upload-step-card {
    padding: 18px 20px;
    border-radius: 20px;
  }
  .kk-upload-step-card--namespace :deep(.kk-upload-fields-grid) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.kk-upload-asset-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: var(--md-sys-color-surface-container-low);
  transition: border-color 200ms ease;
}

.kk-upload-asset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kk-upload-asset-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.kk-upload-add-action {
  padding-block-start: 4px;
}

.kk-upload-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-block-start: 8px;
}
</style>
