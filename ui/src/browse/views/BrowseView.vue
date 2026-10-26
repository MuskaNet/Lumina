<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { t } from "../../shared/i18n";
import { formatLogoClass } from "../../shared/formatIcons";
import { fetchBrowseChildren, fetchBrowseDetail } from "../browseApi";
import { browseHash, BROWSE_PREFIX, navigate, replaceBrowseRoute, searchHash } from "../route";
import { repositoryBaseUrl } from "../formatters";
import { canDeleteEntry } from "../delete";
import { usageDetailForEntry } from "../usage";
import type {
  BrowseAssetDetail,
  BrowseEntry,
  BrowseRepository,
  UsageContext,
  UsageDetail,
} from "../browseModel";
import BrowseTree from "../BrowseTree.vue";
import BrowseDetailPane from "../BrowseDetailPane.vue";
import BrowseDeleteDialog from "../components/BrowseDeleteDialog.vue";
import NotFoundView from "../../shared/components/NotFoundView.vue";

/**
 * Repository content browser: the legacy tree + detail layout. The tree loads
 * one directory level at a time, the detail pane renders the Summary, Docker
 * metadata, Usage and Attributes panels, and the URL keeps the selected path so
 * deep links expand straight to the file.
 */
const props = defineProps<{
  repositories: BrowseRepository[];
  repo: string;
  path: string;
  source: string;
}>();

const TREE_WIDTH_KEY = "kkrepo.browse.treePaneWidthPct";
const TREE_WIDTH_DEFAULT = 68;

const splitEl = ref<HTMLElement | null>(null);
const tree = ref<InstanceType<typeof BrowseTree> | null>(null);
const deleteDialog = ref<InstanceType<typeof BrowseDeleteDialog> | null>(null);
const selected = ref<BrowseEntry | null>(null);
const detail = ref<BrowseAssetDetail | null>(null);
const usage = ref<UsageDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref("");
const treeWidth = ref(readTreeWidth());
const treeRootState = ref({ loading: true, empty: false });
const pathMissing = ref(false);

let selectionToken = 0;
let pathToken = 0;

const repository = computed(() => props.repositories.find((candidate) => candidate.name === props.repo));
const repositoryMissing = computed(() => props.repositories.length > 0 && !repository.value);
const catalogHash = `${BROWSE_PREFIX}browse`;
const repoRootHash = computed(() => browseHash(props.repo));
const htmlViewUrl = computed(() => `/service/rest/repository/browse/${encodeURIComponent(props.repo)}/`);
const canDeleteSelected = computed(() => {
  const repo = repository.value ?? { name: props.repo };
  return canDeleteEntry(repo, selected.value);
});

function readTreeWidth(): number {
  try {
    const stored = Number.parseFloat(globalThis.localStorage?.getItem(TREE_WIDTH_KEY) ?? "");
    if (Number.isFinite(stored)) return clampTreeWidth(stored);
  } catch {
    // localStorage can be unavailable; the default layout is enough.
  }
  return TREE_WIDTH_DEFAULT;
}

function clampTreeWidth(value: number): number {
  return Math.max(65, Math.min(70, value));
}

function persistTreeWidth(): void {
  try {
    globalThis.localStorage?.setItem(TREE_WIDTH_KEY, String(treeWidth.value));
  } catch {
    // Per-browser preference only.
  }
}

function setTreeWidth(value: number, persist = true): void {
  treeWidth.value = clampTreeWidth(value);
  if (persist) persistTreeWidth();
}

function resetTreeWidth(): void {
  setTreeWidth(TREE_WIDTH_DEFAULT);
}

function startResize(event: PointerEvent): void {
  const split = splitEl.value;
  if (!split) return;
  event.preventDefault();
  const rect = split.getBoundingClientRect();
  const onMove = (moveEvent: PointerEvent) => {
    setTreeWidth(((moveEvent.clientX - rect.left) / (rect.width || 1)) * 100, false);
  };
  const onEnd = () => {
    globalThis.removeEventListener?.("pointermove", onMove as EventListener);
    globalThis.removeEventListener?.("pointerup", onEnd);
    persistTreeWidth();
  };
  globalThis.addEventListener?.("pointermove", onMove as EventListener);
  globalThis.addEventListener?.("pointerup", onEnd);
}

function onResizerKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowLeft") {
    setTreeWidth(treeWidth.value - 2);
  } else if (event.key === "ArrowRight") {
    setTreeWidth(treeWidth.value + 2);
  } else if (event.key === "Home" || event.key === "Enter" || event.key === " ") {
    resetTreeWidth();
  } else {
    return;
  }
  event.preventDefault();
}

function usageContext(): UsageContext {
  const repo = repository.value ?? { name: props.repo };
  const location = globalThis.location;
  return {
    repository: repo,
    baseUrl: repositoryBaseUrl(repo),
    origin: location?.origin ?? "",
    host: location?.host ?? "",
    protocol: location?.protocol ?? "https:",
    fetchChildren: (path: string) => fetchBrowseChildren(props.repo, path, props.source),
  };
}

async function loadSelection(): Promise<void> {
  const currentPathToken = ++pathToken;
  selected.value = null;
  detail.value = null;
  usage.value = null;
  pathMissing.value = false;
  detailError.value = "";
  detailLoading.value = false;
  if (!props.repo) return;
  if (repositoryMissing.value) return;

  const treeInstance = tree.value;
  if (!treeInstance) return;
  await treeInstance.load();
  if (currentPathToken !== pathToken) return;
  if (!props.path) return;

  const entry = await treeInstance.expandTo(props.path);
  if (currentPathToken !== pathToken) return;
  if (!entry) {
    pathMissing.value = true;
    return;
  }
  await selectEntry(entry, false);
}

async function selectEntry(entry: BrowseEntry, syncHash = true): Promise<void> {
  selected.value = entry;
  pathMissing.value = false;
  detail.value = null;
  usage.value = null;
  detailError.value = "";
  detailLoading.value = true;
  if (syncHash) {
    replaceBrowseRoute(browseHash(props.repo, entry.path, props.source));
  }
  const token = ++selectionToken;
  try {
    if (entry.leaf) {
      const loaded = await fetchBrowseDetail(props.repo, entry.path, props.source);
      if (token !== selectionToken) return;
      detail.value = loaded;
    }
    const renderedUsage = await usageDetailForEntry(usageContext(), entry, detail.value);
    if (token !== selectionToken) return;
    usage.value = renderedUsage;
  } catch (error) {
    if (token === selectionToken) {
      detailError.value = (error as Error)?.message || String(error);
    }
  } finally {
    if (token === selectionToken) detailLoading.value = false;
  }
}

async function onDeleted(): Promise<void> {
  const deletedPath = selected.value?.path ?? "";
  selected.value = null;
  detail.value = null;
  usage.value = null;
  await tree.value?.refresh();
  if (deletedPath) {
    const entry = await tree.value?.expandTo(deletedPath);
    if (entry) {
      await selectEntry(entry, true);
      return;
    }
  }
  replaceBrowseRoute(browseHash(props.repo));
}

function openDelete(): void {
  if (selected.value) deleteDialog.value?.open();
}

function advancedSearch(): void {
  navigate(searchHash(repository.value?.format ?? "", ""));
}

function backToCatalog(): void {
  navigate(`${BROWSE_PREFIX}browse`);
}

onMounted(() => {
  void loadSelection();
});

watch(
  () => [props.repo, props.path, props.source] as const,
  (current, previous) => {
    const [repo, path, source] = current;
    const [previousRepo, , previousSource] = previous ?? current;
    // Tree selection already updated the component and the URL; do not reload it.
    if (repo === previousRepo && source === previousSource && path === selected.value?.path) return;
    void loadSelection();
  },
);

// Deep links can render before the repository catalog arrives; re-run once the
// catalog (and its format/connector settings) is available.
watch(
  () => props.repositories.length,
  (length) => {
    if (length > 0) void loadSelection();
  },
);
</script>

<template>
  <div class="kk-browse-bar">
    <nav class="kk-browse-crumbs" aria-label="Breadcrumb">
      <button type="button" class="kk-location kk-browse-crumbs__root" @click="backToCatalog">
        {{ t("Browse") }}
      </button>
      <span class="kk-browse-crumbs__sep" aria-hidden="true">/</span>
      <span
        v-if="repository"
        :class="formatLogoClass(repository.format)"
        class="kk-browse-crumbs__format"
        aria-hidden="true"
      ></span>
      <span class="kk-browse-crumbs__repo">{{ props.repo }}</span>
    </nav>
    <div class="kk-browse-bar__actions">
      <a
        class="micl-button-text-s"
        :href="htmlViewUrl"
        target="_blank"
        rel="noopener noreferrer"
      >{{ t("HTML View") }}</a>
      <button type="button" class="micl-button-text-s" @click="advancedSearch">
        {{ t("Advanced search…") }}
      </button>
    </div>
  </div>

  <NotFoundView
    v-if="repositoryMissing"
    title="Repository not found"
    description="The repository may have been deleted or renamed."
    :path="props.repo"
    action-label="Back to browse"
    :action-href="catalogHash"
  />

  <NotFoundView
    v-else-if="!treeRootState.loading && treeRootState.empty"
    icon="inbox"
    title="This repository is empty."
    description="Push or upload content to this repository to browse it here."
    action-label="Back to browse"
    :action-href="catalogHash"
  />

  <section
    v-else-if="treeRootState.loading"
    class="kk-empty-state"
    role="status"
    aria-live="polite"
  >
    <span class="kk-tree-spinner kk-empty-state__spinner" aria-hidden="true"></span>
    <p class="kk-empty-state__body">{{ t("Loading…") }}</p>
  </section>

  <!-- Kept mounted while hidden so the tree can load the first level that
       decides between the loading, empty and split layouts. -->
  <div
    v-show="!repositoryMissing && !treeRootState.loading && !treeRootState.empty"
    ref="splitEl"
    class="kk-browse-split"
    :style="{ '--kk-browse-tree-width': `${treeWidth}%` }"
  >
    <div class="kk-browse-tree-pane">
      <BrowseTree
        ref="tree"
        :repository="props.repo"
        :source="props.source"
        :format="repository?.format"
        :selected-path="selected?.path ?? props.path"
        @select="selectEntry"
        @root-state="treeRootState = $event"
      />
    </div>

    <div
      class="kk-browse-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin="65"
      aria-valuemax="70"
      :aria-valuenow="Math.round(treeWidth)"
      :aria-label="t('Resize tree and detail panes')"
      tabindex="0"
      @pointerdown="startResize"
      @keydown="onResizerKeydown"
      @dblclick="resetTreeWidth"
    ></div>

    <div class="kk-browse-detail-wrap">
      <p v-if="detailError" class="kk-form-error" role="alert">{{ detailError }}</p>
      <NotFoundView
        v-if="!selected && pathMissing"
        icon="search_off"
        title="Path not found"
        :path="props.path"
        action-label="Go to repository root"
        :action-href="repoRootHash"
      />
      <div v-else-if="!selected" class="kk-browse-placeholder">
        {{ t("Select a component or file in the tree to view details.") }}
      </div>
      <BrowseDetailPane
        v-else
        :repository-name="props.repo"
        :repository-format="repository?.format"
        :entry="selected"
        :detail="detail"
        :loading="detailLoading"
        :usage="usage"
        :can-delete="canDeleteSelected"
        @delete="openDelete"
      />
    </div>
  </div>

  <BrowseDeleteDialog
    ref="deleteDialog"
    :repository="props.repo"
    :repository-format="repository?.format"
    :repository-type="repository?.type"
    :entry="selected"
    @deleted="onDeleted"
  />
</template>
