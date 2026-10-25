<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import { browseHash, navigate } from "../route";

interface Repository {
  name: string;
  type?: string | null;
  format?: string | null;
}

interface BrowseEntry {
  name: string;
  path?: string | null;
  leaf?: boolean;
}

const props = defineProps<{
  repositories: Repository[];
  repo: string;
  path: string;
  source: string;
}>();

const entries = ref<BrowseEntry[]>([]);
const loading = ref(false);
const error = ref("");
const selected = ref<BrowseEntry | null>(null);
const filter = ref("");

const columns: DataTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Type", align: "end" },
  { key: "actions", label: "Actions", align: "end" },
];

const currentRepo = computed(() => props.repositories.find((repo) => repo.name === props.repo));

const crumbs = computed(() => {
  const parts = props.path ? props.path.split("/").filter(Boolean) : [];
  const trail = [{ label: props.repo, path: "" }];
  let accumulated = "";
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    trail.push({ label: part, path: accumulated });
  }
  return trail;
});

const filtered = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  const sorted = [...entries.value].sort((a, b) => {
    if (Boolean(a.leaf) !== Boolean(b.leaf)) return a.leaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  if (!needle) return sorted;
  return sorted.filter((entry) => entry.name.toLowerCase().includes(needle));
});

async function load() {
  if (!props.repo) {
    entries.value = [];
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams();
    if (props.path) params.set("path", props.path);
    if (props.source) params.set("source", props.source);
    const query = params.toString();
    const payload = await api.get<{ entries?: BrowseEntry[] }>(
      `/internal/browse/${encodeURIComponent(props.repo)}${query ? `?${query}` : ""}`,
    );
    entries.value = payload.entries ?? [];
  } catch (cause) {
    error.value = (cause as Error).message;
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function open(entry: BrowseEntry) {
  if (entry.leaf) {
    selected.value = entry;
    return;
  }
  navigate(browseHash(props.repo, entry.path ?? entry.name, props.source));
}

function downloadUrl(entry: BrowseEntry): string {
  const path = entry.path ?? entry.name;
  return `/repository/${encodeURIComponent(props.repo)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

watch(() => [props.repo, props.path, props.source], load, { immediate: true });
</script>

<template>
  <div class="kk-toolbar">
    <nav class="kk-breadcrumbs" aria-label="Breadcrumb">
      <template v-for="(crumb, index) in crumbs" :key="crumb.path">
        <button
          v-if="index < crumbs.length - 1"
          type="button"
          class="kk-location"
          @click="navigate(browseHash(repo, crumb.path, source))"
        >
          {{ crumb.label }}
        </button>
        <span v-else aria-current="page">{{ crumb.label }}</span>
        <span v-if="index < crumbs.length - 1" class="kk-muted">/</span>
      </template>
    </nav>
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="entry-filter">{{ t("Filter") }}</label>
      <input id="entry-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    <button type="button" class="micl-button-outlined-m kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <p v-if="currentRepo" class="kk-muted">
    {{ currentRepo.format }} · {{ currentRepo.type }} ·
    <code class="kk-mono">/repository/{{ repo }}/</code>
  </p>

  <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>

  <M3DataTable
    :columns="columns"
    :rows="filtered"
    :row-key="(row: BrowseEntry) => String(row.path ?? row.name)"
    :loading="loading"
    :empty-text="t('This folder is empty.')"
    :aria-label="t('Repository contents')"
  >
    <template #cell-name="{ row }">
      <button type="button" class="kk-location" @click="open(row)">
        <span class="material-symbols-outlined" aria-hidden="true">{{ row.leaf ? "description" : "folder" }}</span>
        {{ row.name }}
      </button>
    </template>
    <template #cell-kind="{ row }">{{ row.leaf ? t("File") : t("Folder") }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <a v-if="row.leaf" class="micl-button-text-s" :href="downloadUrl(row)">{{ t("Open") }}</a>
        <button v-else type="button" class="micl-button-text-s" @click="open(row)">{{ t("Browse") }}</button>
      </div>
    </template>
  </M3DataTable>

  <div v-if="selected" class="kk-summary">
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Selected file") }}</span>
      <strong class="kk-summary__value kk-mono">{{ selected.path ?? selected.name }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Download") }}</span>
      <a class="micl-button-text-s" :href="downloadUrl(selected)">{{ t("Open") }}</a>
    </div>
  </div>
</template>

