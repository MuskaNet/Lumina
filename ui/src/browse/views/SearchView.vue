<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import { browseHash, searchHash, navigate } from "../route";

interface ComponentHit {
  repository?: string | null;
  repositoryName?: string | null;
  format?: string | null;
  name?: string | null;
  version?: string | null;
  path?: string | null;
  assetPath?: string | null;
  [key: string]: unknown;
}

const props = defineProps<{ query: string; format: string }>();

const keyword = ref(props.query);
const format = ref(props.format);
const limit = ref(50);
const hits = ref<ComponentHit[]>([]);
const loading = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "repository", label: "Repository" },
  { key: "format", label: "Format" },
  { key: "name", label: "Component" },
  { key: "version", label: "Version" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() =>
  hits.value.map((hit) => ({
    ...hit,
    repository: hit.repository ?? hit.repositoryName ?? "",
    name: hit.name ?? hit.path ?? hit.assetPath ?? "",
  })),
);

async function run() {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ limit: String(limit.value) });
    if (keyword.value.trim()) params.set("q", keyword.value.trim());
    if (format.value.trim()) params.set("format", format.value.trim());
    const payload = await api.get<unknown>(`/internal/search/components?${params.toString()}`);
    hits.value = extract(payload);
  } catch (cause) {
    error.value = (cause as Error).message;
    hits.value = [];
  } finally {
    loading.value = false;
  }
}

function extract(payload: unknown): ComponentHit[] {
  if (Array.isArray(payload)) return payload as ComponentHit[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["items", "components", "results"]) {
      const value = record[key];
      if (Array.isArray(value)) return value as ComponentHit[];
    }
  }
  return [];
}

function submit() {
  navigate(searchHash(format.value, keyword.value));
  void run();
}

function openHit(hit: ComponentHit) {
  const repo = String(hit.repository ?? hit.repositoryName ?? "");
  if (!repo) return;
  navigate(browseHash(repo, String(hit.path ?? hit.assetPath ?? "")));
}

watch(
  () => [props.query, props.format],
  () => {
    keyword.value = props.query;
    format.value = props.format;
    void run();
  },
  { immediate: true },
);
</script>

<template>
  <form class="kk-toolbar" role="search" @submit.prevent="submit">
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
      <label for="search-keyword">{{ t("Search components") }}</label>
      <input id="search-keyword" v-model="keyword" type="search" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined kk-filter">
      <label for="search-format">{{ t("Format") }}</label>
      <input id="search-format" v-model="format" type="text" placeholder="maven2" autocomplete="off">
    </div>
    <button type="submit" class="micl-button-filled-s kk-toolbar__spacer">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">search</span>
      {{ t("Search") }}
    </button>
  </form>

  <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>

  <M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: ComponentHit, index?: number) => `${row.repository}-${row.name}-${index}`"
    :loading="loading"
    :empty-text="t('No components matched the search.')"
    :aria-label="t('Component search results')"
  >
    <template #cell-repository="{ row }">{{ row.repository || "—" }}</template>
    <template #cell-format="{ row }">{{ row.format || "—" }}</template>
    <template #cell-name="{ row }"><code class="kk-mono">{{ row.name }}</code></template>
    <template #cell-version="{ row }">{{ row.version || "—" }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openHit(row)">{{ t("Browse") }}</button>
      </div>
    </template>
  </M3DataTable>
</template>
