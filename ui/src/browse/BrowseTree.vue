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
let rootPending: Promise<void> | null = null;

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
  if (!force && loadedKey.value === key) {
    if (rootPending) await rootPending;
    return;
  }
  if (!force && rootPending && loadedKey.value === key) {
    await rootPending;
    return;
  }
  loadedKey.value = key;
  rootLoading.value = true;
  rootError.value = "";
  emit("root-state", { loading: true, empty: false });
  const task = fetchBrowseChildren(props.repository, "", props.source ?? "")
    .then((entries) => {
      rootEntries.value = entries;
      emit("root-state", { loading: false, empty: rootEntries.value.length === 0 });
    })
    .catch((error) => {
      rootError.value = (error as Error)?.message || String(error);
      rootEntries.value = [];
      emit("root-state", { loading: false, empty: false });
    })
    .finally(() => {
      rootLoading.value = false;
      rootPending = null;
    });
  rootPending = task;
  await task;
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

<style scoped>
.kk-tree {
  box-sizing: border-box;
  inline-size: 100%;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 2px;
  font-size: 0.875rem;
}

.kk-tree__state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8125rem;
}

.kk-tree__error {
  border-radius: var(--md-sys-shape-corner-small, 8px);
}

.kk-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-block-size: 34px;
  padding-inline-end: 12px;
  border-radius: 9999px;
  margin-block: 2px;
  white-space: nowrap;
  transition: background-color 150ms ease, color 150ms ease;
}

.kk-tree-row:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.kk-tree-row.is-selected {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-weight: 600;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.kk-tree-toggle,
.kk-tree-toggle-spacer {
  flex: 0 0 24px;
  inline-size: 24px;
  block-size: 24px;
}

.kk-tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.kk-tree-toggle:hover {
  background: var(--md-sys-color-surface-container-highest);
}

.kk-tree-toggle .material-symbols-outlined {
  font-size: 20px;
  transition: transform 120ms ease;
}

.kk-tree-toggle .material-symbols-outlined.is-open {
  transform: rotate(90deg);
}

.kk-tree-icon {
  flex: 0 0 auto;
  font-size: 18px;
  color: var(--md-sys-color-on-surface-variant);
}

.kk-tree-row.is-selected .kk-tree-icon {
  color: var(--md-sys-color-on-secondary-container);
}

.kk-tree-label {
  flex: 1 0 auto;
  min-inline-size: 0;
  padding: 4px 6px;
  border: 0;
  border-radius: 9999px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}

.kk-tree-label:focus-visible,
.kk-tree-toggle:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: -2px;
}

.kk-tree__rows {
  inline-size: max-content;
  min-inline-size: 100%;
}
</style>
