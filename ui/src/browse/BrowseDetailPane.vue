<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { t } from "../shared/i18n";
import { writeClipboard } from "../shared/clipboard";
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
const copiedSnippet = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.usage,
  (usage) => {
    usageSelection.value = usage?.snippets[0]?.displayName ?? "";
    copiedSnippet.value = false;
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
  } catch {
    return;
  }
  copiedSnippet.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedSnippet.value = false;
    copiedTimer = null;
  }, 1200);
}

function describeDescriptor(row: {
  mediaType?: string;
  artifactType?: string;
  imageName?: string;
}): string {
  return row.artifactType || row.mediaType || row.imageName || "-";
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
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
        class="micl-button-outlined-s kk-detail-head__delete"
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
        <header class="kk-detail-panel__head">{{ t(summary.title) }}</header>
        <dl class="kk-detail-rows">
          <div v-for="row in summary.rows" :key="row.label" class="kk-detail-row">
            <dt>{{ t(row.label) }}</dt>
            <dd :class="{ 'kk-mono': row.code }">{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="dockerPanel" class="kk-detail-panel">
        <header class="kk-detail-panel__head">{{ t(dockerPanel.title) }}</header>
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
        <header class="kk-detail-panel__head">{{ t("Usage") }}</header>
        <div class="kk-usage">
          <div class="kk-usage__row">
            <select
              v-model="usageSelection"
              class="kk-usage__pick"
              :aria-label="t('Usage snippet')"
            >
              <option v-for="option in snippets" :key="option.displayName" :value="option.displayName">
                {{ option.displayName }}
              </option>
            </select>
            <button
              type="button"
              class="micl-iconbutton-standard-s kk-usage__copy"
              :aria-label="copiedSnippet ? t('Copied') : t('Copy usage snippet')"
              :title="copiedSnippet ? t('Copied') : t('Copy usage snippet')"
              @click="copySnippet"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                {{ copiedSnippet ? "check" : "content_copy" }}
              </span>
            </button>
          </div>
          <p v-if="snippet.description" class="kk-usage__hint">{{ snippet.description }}</p>
          <pre class="kk-usage__snippet"><code>{{ snippet.snippetText }}</code></pre>
        </div>
      </section>

      <section v-if="attributes.length" class="kk-detail-panel">
        <header class="kk-detail-panel__head">{{ t("Attributes") }}</header>
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
          class="micl-button-outlined-s"
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
