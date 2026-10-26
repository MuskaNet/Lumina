<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { fetchBrowseChildren } from "./browseApi";
import { directoryIcon, fileIcon } from "./detail";
import type { BrowseEntry } from "./browseModel";
import { t } from "../shared/i18n";

/**
 * Legacy-style repository tree: one level is loaded per expansion so large
 * repositories open instantly. Only the visible rows are rendered; directories
 * expand lazily and the selected row follows the URL path.
 */
const props = defineProps<{
  repository: string;
  source?: string;
  format?: string | null;
  selectedPath?: string;
}>();

const emit = defineEmits<{
  select: [entry: BrowseEntry];
  "root-state": [state: { loading: boolean; empty: boolean }];
}>();

interface TreeRow {
  entry: BrowseEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  error?: string;
}

const rootEl = ref<HTMLElement | null>(null);
const rootEntries = ref<BrowseEntry[]>([]);
const rootLoading = ref(false);
const rootError = ref("");
const loadedKey = ref("");
const children = reactive<Record<string, BrowseEntry[]>>({});
const expanded = reactive(new Set<string>());
const loading = reactive(new Set<string>());
const errors = reactive<Record<string, string>>({});
const pending = new Map<string, Promise<BrowseEntry[]>>();

const repositoryKey = computed(() => `${props.repository}\u0000${props.source ?? ""}`);

const rows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = [];
  const walk = (entries: BrowseEntry[], depth: number) => {
    for (const entry of entries) {
      const isExpanded = expanded.has(entry.path);
      result.push({
        entry,
        depth,
        expanded: isExpanded,
        loading: loading.has(entry.path),
        error: errors[entry.path],
      });
      if (!entry.leaf && isExpanded && children[entry.path]) {
        walk(children[entry.path], depth + 1);
      }
    }
  };
  walk(rootEntries.value, 0);
  return result;
});

async function load(force = false): Promise<void> {
  const key = repositoryKey.value;
  if (!force && loadedKey.value === key) return;
  loadedKey.value = key;
  rootLoading.value = true;
  rootError.value = "";
  emit("root-state", { loading: true, empty: false });
  try {
    rootEntries.value = await fetchBrowseChildren(props.repository, "", props.source ?? "");
    emit("root-state", { loading: false, empty: rootEntries.value.length === 0 });
  } catch (error) {
    rootError.value = (error as Error)?.message || String(error);
    rootEntries.value = [];
    emit("root-state", { loading: false, empty: false });
  } finally {
    rootLoading.value = false;
  }
}

function loadChildren(path: string): Promise<BrowseEntry[]> {
  const cached = children[path];
  if (cached) return Promise.resolve(cached);
  const running = pending.get(path);
  if (running) return running;
  loading.add(path);
  delete errors[path];
  const task = fetchBrowseChildren(props.repository, path, props.source ?? "")
    .then((entries) => {
      children[path] = entries;
      return entries;
    })
    .catch((error: unknown) => {
      errors[path] = (error as Error)?.message || String(error);
      throw error;
    })
    .finally(() => {
      pending.delete(path);
      loading.delete(path);
    });
  pending.set(path, task);
  return task;
}

async function toggleFolder(entry: BrowseEntry): Promise<void> {
  if (expanded.has(entry.path)) {
    expanded.delete(entry.path);
    return;
  }
  expanded.add(entry.path);
  try {
    await loadChildren(entry.path);
  } catch {
    // The error is rendered under the folder row; keep the folder expanded so
    // the user can retry by collapsing and expanding it again.
  }
}

function activate(entry: BrowseEntry): void {
  if (entry.leaf) {
    emit("select", entry);
    return;
  }
  void toggleFolder(entry);
  emit("select", entry);
}

/** Expands every ancestor of `path` and returns the matching entry, if present. */
async function expandTo(path: string): Promise<BrowseEntry | null> {
  if (!path) return null;
  await load();
  const segments = path.split("/").filter(Boolean);
  let parent = "";
  let found: BrowseEntry | null = null;
  for (let index = 0; index < segments.length; index += 1) {
    const currentPath = segments.slice(0, index + 1).join("/");
    const level = index === 0 ? rootEntries.value : await loadChildren(parent);
    found = level.find((entry) => entry.path === currentPath) ?? null;
    if (!found) return null;
    if (!found.leaf) {
      expanded.add(found.path);
      await loadChildren(found.path).catch(() => undefined);
    }
    parent = currentPath;
  }
  if (found && !found.leaf) expanded.add(found.path);
  return found;
}

/** Reloads the tree while keeping the currently expanded branches open. */
async function refresh(): Promise<void> {
  const openBranches = [...expanded];
  for (const path of Object.keys(children)) delete children[path];
  for (const path of Object.keys(errors)) delete errors[path];
  expanded.clear();
  pending.clear();
  loadedKey.value = "";
  await load(true);
  for (const path of openBranches) {
    await expandTo(path).catch(() => undefined);
  }
}

watch(
  () => props.selectedPath,
  async (path) => {
    if (!path) return;
    await nextTick();
    const row = rootEl.value?.querySelector<HTMLElement>(
      `[data-tree-path="${CSS.escape(path)}"]`,
    );
    row?.scrollIntoView?.({ block: "nearest" });
  },
);

defineExpose({ load, expandTo, refresh });
</script>

<template>
  <div ref="rootEl" class="kk-tree" role="tree" :aria-label="t('Repository contents')">
    <div v-if="rootLoading" class="kk-tree__state" role="status">
      <span class="kk-tree-spinner" aria-hidden="true"></span>
      {{ t("Loading…") }}
    </div>
    <div v-else-if="rootError" class="kk-tree__state kk-form-error" role="alert">
      <span>{{ rootError }}</span>
      <button type="button" class="micl-button-text-s" @click="load(true)">{{ t("Retry") }}</button>
    </div>
    <div v-else-if="!rows.length" class="kk-tree__state kk-muted">{{ t("(empty)") }}</div>
    <div v-else class="kk-tree__rows">
      <template v-for="row in rows" :key="row.entry.path">
        <div
          class="kk-tree-row"
          :class="{ 'is-selected': row.entry.path === props.selectedPath }"
          role="treeitem"
          :aria-selected="row.entry.path === props.selectedPath"
          :aria-expanded="row.entry.leaf ? undefined : row.expanded"
          :data-tree-path="row.entry.path"
          :style="{ paddingInlineStart: `${8 + row.depth * 18}px` }"
        >
          <button
            v-if="!row.entry.leaf"
            type="button"
            class="kk-tree-toggle"
            :disabled="row.loading"
            :aria-label="row.expanded ? t('Collapse folder') : t('Expand folder')"
            :title="row.expanded ? t('Collapse folder') : t('Expand folder')"
            @click.stop="toggleFolder(row.entry)"
          >
            <span
              class="material-symbols-outlined"
              :class="{ 'is-open': row.expanded }"
              aria-hidden="true"
            >chevron_right</span>
          </button>
          <span v-else class="kk-tree-toggle-spacer" aria-hidden="true"></span>

          <span class="material-symbols-outlined kk-tree-icon" aria-hidden="true">
            {{ row.entry.leaf ? fileIcon(row.entry.name, props.format) : directoryIcon(row.entry.name) }}
          </span>

          <button type="button" class="kk-tree-label" @click="activate(row.entry)">
            {{ row.entry.name }}
          </button>

          <span v-if="row.loading" class="kk-tree-spinner" aria-hidden="true"></span>
        </div>
        <div
          v-if="row.error"
          class="kk-tree__state kk-form-error kk-tree__error"
          role="alert"
          :style="{ paddingInlineStart: `${28 + row.depth * 18}px` }"
        >
          {{ row.error }}
        </div>
      </template>
    </div>
  </div>
</template>
