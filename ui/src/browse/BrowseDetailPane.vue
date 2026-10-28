<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { t } from "../shared/i18n";
import { writeClipboard } from "../shared/clipboard";
import { showToast } from "../shared/snackbar";
import { formatBytes, shortDigest } from "./formatters";
import {
  attributeGroups,
  dockerMetadataPanel,
  fileIcon,
  isDockerDetail,
  summaryPanel,
} from "./detail";
import type { BrowseAssetDetail, BrowseEntry, UsageDetail } from "./browseModel";

/**
 * Right-hand pane of the repository browser. Renders the legacy Summary,
 * Docker metadata, Usage and Attributes panels for the selected entry, plus the
 * download and delete actions.
 */
const props = defineProps<{
  repositoryName: string;
  repositoryFormat?: string | null;
  entry: BrowseEntry;
  detail: BrowseAssetDetail | null;
  loading: boolean;
  usage: UsageDetail | null;
  canDelete: boolean;
}>();

const emit = defineEmits<{ delete: [] }>();

const usageSelection = ref("");

watch(
  () => props.usage,
  (usage) => {
    usageSelection.value = usage?.snippets[0]?.displayName ?? "";
  },
  { immediate: true },
);

const dockerDetail = computed(() => props.entry.leaf && isDockerDetail(props.repositoryFormat, props.detail));
const summary = computed(() => {
  if (props.entry.leaf) {
    return summaryPanel(props.repositoryName, props.entry, props.detail);
  }
  return {
    title: "Summary",
    rows: props.usage?.summaryRows ?? [
      { label: "Repository", value: props.repositoryName },
      { label: "Directory", value: props.entry.path },
    ],
  };
});
const dockerPanel = computed(() => (props.entry.leaf ? dockerMetadataPanel(props.detail) : null));
const attributes = computed(() =>
  props.entry.leaf ? attributeGroups(props.detail, { hideDocker: dockerDetail.value }) : [],
);
const downloadUrl = computed(() =>
  props.entry.leaf ? props.detail?.downloadUrl || props.entry.downloadUrl || "" : "",
);
const snippets = computed(() => props.usage?.snippets ?? []);
const snippet = computed(
  () =>
    snippets.value.find((candidate) => candidate.displayName === usageSelection.value) ??
    snippets.value[0] ??
    null,
);

async function copySnippet(): Promise<void> {
  if (!snippet.value) return;
  try {
    await writeClipboard(snippet.value.snippetText);
    showToast(t("Copied"), "ok");
  } catch {
    showToast(t("Unable to copy usage snippet"), "error");
  }
}

function describeDescriptor(row: {
  mediaType?: string;
  artifactType?: string;
  imageName?: string;
}): string {
  return row.artifactType || row.mediaType || row.imageName || "-";
}

</script>

<template>
  <div class="kk-detail-pane">
    <div class="kk-detail-head">
      <span class="material-symbols-outlined kk-detail-head__icon" aria-hidden="true">
        {{ fileIcon(props.entry.name, props.repositoryFormat) }}
      </span>
      <code class="kk-detail-head__path" :title="props.entry.path">{{ props.entry.path }}</code>
      <button
        v-if="props.canDelete"
        type="button"
        class="micl-button-outlined-s kk-detail-head__delete kk-destructive-outlined-btn"
        @click="emit('delete')"
      >
        <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">delete</span>
        {{ t("Delete") }}
      </button>
    </div>

    <div v-if="props.loading" class="kk-detail-loading" role="status">
      <span class="kk-tree-spinner" aria-hidden="true"></span>
      {{ t("Loading…") }}
    </div>

    <template v-else>
      <section class="kk-detail-panel">
        <header class="kk-detail-panel__head">
          <span class="material-symbols-outlined kk-detail-panel__icon" aria-hidden="true">info</span>
          {{ t(summary.title) }}
        </header>
        <dl class="kk-detail-rows">
          <div v-for="row in summary.rows" :key="row.label" class="kk-detail-row">
            <dt>{{ t(row.label) }}</dt>
            <dd :class="{ 'kk-mono': row.code }">{{ row.label === 'Transport warning' ? t(row.value) : row.value }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="dockerPanel" class="kk-detail-panel">
        <header class="kk-detail-panel__head">
          <span class="material-symbols-outlined kk-detail-panel__icon" aria-hidden="true">layers</span>
          {{ t(dockerPanel.title) }}
        </header>
        <dl v-if="dockerPanel.rows.length" class="kk-detail-rows">
          <div v-for="row in dockerPanel.rows" :key="row.label" class="kk-detail-row">
            <dt>{{ t(row.label) }}</dt>
            <dd :class="{ 'kk-mono': row.code }">{{ row.value }}</dd>
          </div>
        </dl>
        <div v-if="dockerPanel.groups?.length" class="kk-detail-groups">
          <div v-for="group in dockerPanel.groups" :key="group.title" class="kk-descriptor-group">
            <h4 class="kk-descriptor-group__title">{{ t(group.title) }}</h4>
            <div class="kk-descriptor-rows">
              <div v-for="descriptor in group.rows" :key="descriptor.digest + (descriptor.platform ?? '')" class="kk-descriptor-row">
                <code class="kk-descriptor-row__digest" :title="descriptor.digest">
                  {{ shortDigest(descriptor.digest) }}
                </code>
                <span class="kk-descriptor-row__media" :title="describeDescriptor(descriptor)">
                  {{ describeDescriptor(descriptor) }}
                </span>
                <span class="kk-descriptor-row__size">
                  {{ descriptor.sizeBytes != null ? formatBytes(descriptor.sizeBytes) : "-" }}
                </span>
                <span v-if="descriptor.platform || descriptor.imageName" class="kk-descriptor-row__platform">
                  {{ descriptor.platform || descriptor.imageName }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="snippets.length && snippet" class="kk-detail-panel">
        <header class="kk-detail-panel__head">
          <span class="material-symbols-outlined kk-detail-panel__icon" aria-hidden="true">terminal</span>
          {{ t("Usage") }}
        </header>
        <div class="kk-usage">
          <div class="kk-usage__row">
            <div class="micl-textfield-outlined kk-usage__selector">
              <select
                v-model="usageSelection"
                class="kk-usage__pick"
                :aria-label="t('Usage snippet')"
              >
                <option v-for="option in snippets" :key="option.displayName" :value="option.displayName">
                  {{ t(option.displayName) }}
                </option>
              </select>
            </div>
            <button
              type="button"
              class="micl-button-tonal-s kk-usage__copy"
              :aria-label="t('Copy usage snippet')"
              :title="t('Copy usage snippet')"
              @click="copySnippet"
            >
              <span class="material-symbols-outlined kk-pill-btn__icon" aria-hidden="true">
                content_copy
              </span>
              <span>{{ t("Copy") }}</span>
            </button>
          </div>
          <p v-if="snippet.description" class="kk-usage__hint">{{ t(snippet.description) }}</p>
          <pre class="kk-usage__snippet"><code>{{ snippet.snippetText }}</code></pre>
        </div>
      </section>

      <section v-if="attributes.length" class="kk-detail-panel">
        <header class="kk-detail-panel__head">
          <span class="material-symbols-outlined kk-detail-panel__icon" aria-hidden="true">tune</span>
          {{ t("Attributes") }}
        </header>
        <div class="kk-attribute-groups">
          <div v-for="group in attributes" :key="group.title" class="kk-attribute-group">
            <h4 class="kk-attribute-group__title">{{ t(group.title) }}</h4>
            <dl class="kk-detail-rows">
              <div v-for="row in group.rows" :key="row.label" class="kk-detail-row">
                <dt>{{ row.label }}</dt>
                <dd :class="{ 'kk-mono': row.code }">{{ row.value }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div v-if="downloadUrl" class="kk-detail-download">
        <a
          class="micl-button-filled-s kk-detail-download__btn"
          :href="downloadUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">download</span>
          {{ t("Download") }}
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kk-detail-pane {
  flex: 0 0 auto;
  min-block-size: max-content;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-inline-size: 0;
}

.kk-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
  padding-block-end: 4px;
}

.kk-detail-head__icon {
  flex: 0 0 auto;
  color: var(--md-sys-color-primary);
  font-size: 22px;
}

.kk-detail-head__path {
  flex: 1 1 auto;
  min-inline-size: 0;
  color: var(--md-sys-color-on-surface);
  font-family: var(--md-sys-typescale-body-medium-font, ui-monospace, monospace);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
  font-weight: 600;
}

.kk-detail-head__delete {
  flex-shrink: 0;
  margin-inline-start: auto;
}

.kk-destructive-outlined-btn {
  border: 1px solid var(--md-sys-color-error) !important;
  color: var(--md-sys-color-error) !important;
  background: transparent !important;
  padding-inline: 16px !important;
  min-block-size: 36px !important;
  font-weight: 600 !important;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.kk-destructive-outlined-btn:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent) !important;
}

.kk-destructive-outlined-btn:active {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 20%, transparent) !important;
}

.kk-detail-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

.kk-detail-panel {
  border-radius: 20px;
  background: var(--md-sys-color-surface-container-low);
  overflow: hidden;
}

.kk-detail-panel__head {
  padding: 12px 18px;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.02rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.kk-detail-panel__icon {
  font-size: 18px;
  color: var(--md-sys-color-primary);
}

.kk-detail-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 12px 18px;
}

.kk-detail-rows--trailing {
  border-block-start: 1px solid var(--md-sys-color-outline-variant);
}

.kk-detail-row {
  display: grid;
  grid-template-columns: minmax(6rem, 30%) minmax(0, 1fr);
  gap: 6px 14px;
  align-items: start;
}

.kk-detail-row dt {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.kk-detail-row dd {
  margin: 0;
  min-inline-size: 0;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.kk-detail-groups,
.kk-attribute-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px 12px;
}

.kk-descriptor-group__title,
.kk-attribute-group__title {
  margin: 8px 0 4px;
  color: var(--md-sys-color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05rem;
  text-transform: uppercase;
}

.kk-descriptor-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kk-descriptor-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto minmax(0, 0.8fr);
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--md-sys-color-surface-container);
  font-size: 0.75rem;
}

.kk-descriptor-row__digest {
  overflow: hidden;
  text-overflow: ellipsis;
}

.kk-descriptor-row__media,
.kk-descriptor-row__platform {
  color: var(--md-sys-color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
}

.kk-usage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px 18px;
}

.kk-usage__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kk-usage__selector {
  flex: 1 1 0;
  min-inline-size: 0;
}

.kk-usage__copy {
  white-space: nowrap;
}

.kk-usage__hint {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.75rem;
}

.kk-usage__snippet {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-highest);
  overflow: auto;
}

.kk-usage__snippet code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre;
}

.kk-detail-download {
  display: flex;
  margin-block-start: auto;
  padding-block-start: 8px;
}

.kk-detail-download__btn {
  inline-size: 100%;
  text-decoration: none;
}
</style>
