<script setup lang="ts">
/**
 * Delete confirmation for the browse detail pane.
 *
 * Assets use the shared M3 dialog. Directory contents on a hosted repository
 * first load a server-side deletion preview, then require the exact directory
 * path to be typed before the destructive action is enabled — the same flow as
 * the legacy console. The parent owns navigation and refresh: this component
 * only reports `deleted` after the API call succeeds.
 */
import { computed, nextTick, ref } from "vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import { t } from "../../shared/i18n";
import type { BrowseEntry, BrowseRepository, DirectoryDeletionPreview } from "../browseModel";
import {
  canDeleteBrowseDirectory,
  confirmDirectoryDeletion,
  deleteBrowseEntry,
  previewDirectoryDeletion,
} from "../delete";
import { formatBytes } from "../formatters";

const props = defineProps<{
  repository: string;
  repositoryFormat?: string | null;
  repositoryType?: string | null;
  entry: BrowseEntry | null;
}>();

const emit = defineEmits<{ deleted: [path: string] }>();

const mode = ref<"asset" | "directory" | null>(null);
const assetDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const directoryDialog = ref<HTMLDialogElement | null>(null);

const assetTarget = ref<BrowseEntry | null>(null);
const assetRepository = ref("");
const busy = ref(false);
const error = ref("");

const preview = ref<DirectoryDeletionPreview | null>(null);
const reviewing = ref(false);
const invalidated = ref(false);
const confirmation = ref("");
/** Repository and path captured when the preview was requested. */
const reviewed = ref<{ repository: string; path: string } | null>(null);

const repositoryInfo = computed<Pick<BrowseRepository, "format" | "type">>(() => ({
  format: props.repositoryFormat ?? null,
  type: props.repositoryType ?? null,
}));

const assetTitle = computed(() => t(assetTarget.value?.leaf ? "Delete file?" : "Delete component?"));

const assetDescription = computed(() => {
  if (props.repositoryFormat === "gitlfs") {
    return t("Deleting this LFS object may break checkouts of Git commits that reference it.");
  }
  return assetTarget.value?.leaf
    ? t("The selected file will be removed. Depending on the package format, associated files may also be deleted. Builds and clients that depend on them may fail.")
    : t("The selected component and its associated files will be removed. Builds and clients that depend on them may fail.");
});

const assetSourceRepository = computed(() => assetTarget.value?.sourceRepository || assetRepository.value);

const confirmDisabled = computed(() => busy.value
  || reviewing.value
  || invalidated.value
  || !preview.value
  || confirmation.value !== preview.value.path);

const showReviewAgain = computed(() => !busy.value && !reviewing.value && Boolean(error.value));

function describeError(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : String(cause);
}

async function open(): Promise<void> {
  const target = props.entry;
  if (!target) return;
  busy.value = false;
  error.value = "";
  if (canDeleteBrowseDirectory(repositoryInfo.value, target)) {
    mode.value = "directory";
    await nextTick();
    await openDirectory(target);
    return;
  }
  mode.value = "asset";
  assetTarget.value = target;
  assetRepository.value = props.repository;
  await nextTick();
  assetDialog.value?.open();
}

async function confirmAssetDelete(): Promise<void> {
  const target = assetTarget.value;
  if (!target || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await deleteBrowseEntry(assetRepository.value, target);
    assetDialog.value?.close();
    emit("deleted", target.path);
  } catch (cause) {
    error.value = describeError(cause);
  } finally {
    busy.value = false;
  }
}

function onAssetCancel(): void {
  error.value = "";
}

async function openDirectory(target: BrowseEntry): Promise<void> {
  preview.value = null;
  confirmation.value = "";
  reviewing.value = false;
  invalidated.value = false;
  error.value = "";
  reviewed.value = { repository: props.repository, path: target.path };
  if (!directoryDialog.value?.open) directoryDialog.value?.showModal();
  await loadPreview();
}

async function loadPreview(): Promise<void> {
  const current = reviewed.value;
  if (!current) return;
  reviewing.value = true;
  invalidated.value = false;
  error.value = "";
  preview.value = null;
  confirmation.value = "";
  try {
    preview.value = await previewDirectoryDeletion(current.repository, current.path);
  } catch (cause) {
    invalidated.value = true;
    error.value = describeError(cause);
  } finally {
    reviewing.value = false;
  }
}

async function confirmDirectoryDelete(): Promise<void> {
  const current = preview.value;
  const review = reviewed.value;
  if (!current || !review || busy.value || invalidated.value) return;
  if (confirmation.value !== current.path) return;
  busy.value = true;
  error.value = "";
  const deletedPath = current.path;
  try {
    await confirmDirectoryDeletion(review.repository, current.path, confirmation.value, current.selectionToken ?? null);
    directoryDialog.value?.close();
    emit("deleted", deletedPath);
  } catch (cause) {
    invalidated.value = true;
    error.value = describeError(cause);
  } finally {
    busy.value = false;
  }
}

function closeDirectory(): void {
  if (!busy.value) directoryDialog.value?.close();
}

function onDirectoryCancel(event: Event): void {
  event.preventDefault();
  closeDirectory();
}

defineExpose({ open });
</script>

<template>
  <M3Dialog
    v-if="mode === 'asset'"
    ref="assetDialog"
    icon="delete"
    destructive
    :title="assetTitle"
    :subtitle="assetDescription"
    :confirm-label="t('Delete')"
    :busy="busy"
    :error="error"
    @confirm="confirmAssetDelete"
    @cancel="onAssetCancel"
  >
    <dl class="kk-browse-delete-summary">
      <dt>{{ t("Repository") }}</dt>
      <dd><code class="kk-mono">{{ assetSourceRepository }}</code></dd>
      <dt>{{ t("Path") }}</dt>
      <dd><code class="kk-mono">{{ assetTarget?.path }}</code></dd>
    </dl>
  </M3Dialog>

  <dialog
    v-if="mode === 'directory'"
    ref="directoryDialog"
    class="micl-dialog kk-dialog has-icon"
    aria-labelledby="kk-browse-delete-directory-title"
    :aria-describedby="preview ? 'kk-browse-delete-directory-warning' : undefined"
    @cancel="onDirectoryCancel"
  >
    <div class="micl-dialog__headline">
      <span class="micl-dialog__icon material-symbols-outlined is-destructive" aria-hidden="true">warning</span>
      <div class="kk-dialog__title-block">
        <h2 id="kk-browse-delete-directory-title">{{ t("Delete directory contents?") }}</h2>
      </div>
    </div>

    <div class="micl-dialog__content kk-dialog__content">
      <p v-if="reviewing" class="kk-hint" role="status">{{ t("Reviewing…") }}</p>

      <template v-else-if="preview">
        <dl class="kk-browse-delete-summary">
          <dt>{{ t("Repository") }}</dt>
          <dd><code class="kk-mono">{{ reviewed?.repository }}</code></dd>
          <dt>{{ t("Directory") }}</dt>
          <dd><code class="kk-mono">{{ preview.path }}</code></dd>
          <dt>{{ t("Contents") }}</dt>
          <dd>
            <strong>{{ preview.assetCount }}</strong>
            {{ t(preview.assetCount === 1 ? "file" : "files") }}
            ·
            <strong>{{ preview.componentCount }}</strong>
            {{ t(preview.componentCount === 1 ? "component" : "components") }}
            · {{ formatBytes(preview.estimatedBytes) }}
          </dd>
        </dl>

        <p>{{ t("The selected files will be deleted, including files in subdirectories.") }}</p>
        <p id="kk-browse-delete-directory-warning" class="kk-browse-delete-warning">
          {{ t("Deletion is permanent. This action cannot be undone.") }}
        </p>
        <p v-if="preview.metadataAssetCount">
          <strong>{{ preview.metadataAssetCount }}</strong>
          {{ t("generated metadata files may remain or be regenerated by the package protocol.") }}
        </p>

        <details>
          <summary>{{ t("Review all affected paths") }}</summary>
          <ul class="kk-browse-delete-paths">
            <li v-for="item in preview.items ?? []" :key="item.path">
              <code>{{ item.path }}</code>
              <span v-if="item.action === 'PROTOCOL_METADATA'">{{ t("(protocol metadata)") }}</span>
            </li>
          </ul>
        </details>

        <label for="kk-browse-delete-confirm">{{ t("Type the exact directory path to confirm:") }}</label>
        <input
          id="kk-browse-delete-confirm"
          v-model="confirmation"
          class="kk-browse-delete-confirm"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :disabled="busy"
          @keydown.enter.prevent="confirmDirectoryDelete"
        >
        <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>
      </template>

      <p v-else-if="error" class="kk-form-error" role="alert">{{ error }}</p>
    </div>

    <div class="micl-dialog__actions">
      <button type="button" class="micl-button-text-s" :disabled="busy" @click="closeDirectory">
        {{ t("Cancel") }}
      </button>
      <button
        v-if="showReviewAgain"
        type="button"
        class="micl-button-text-s kk-browse-delete-review"
        :disabled="busy"
        @click="loadPreview"
      >
        {{ t("Review again") }}
      </button>
      <button
        type="button"
        class="micl-button-filled-s is-destructive"
        :disabled="confirmDisabled"
        @click="confirmDirectoryDelete"
      >
        <span v-if="busy" class="kk-button-spinner" aria-hidden="true"></span>
        {{ busy ? t("Deleting…") : t("Delete files") }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
/* ---- Browse: delete dialogs -------------------------------------------- */

.kk-browse-delete-summary {
  display: grid;
  grid-template-columns: minmax(6rem, auto) minmax(0, 1fr);
  gap: 6px 16px;
  margin: 0;
}

.kk-browse-delete-summary dt {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8125rem;
}

.kk-browse-delete-summary dd {
  margin: 0;
  min-inline-size: 0;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.kk-browse-delete-warning {
  margin: 0;
  color: var(--md-sys-color-error);
  font-size: 0.875rem;
  font-weight: 600;
}

.kk-browse-delete-paths {
  margin: 8px 0 0;
  padding-inline-start: 20px;
  max-block-size: 12rem;
  overflow: auto;
  font-size: 0.75rem;
}

.kk-browse-delete-paths li {
  margin-block-end: 2px;
  overflow-wrap: anywhere;
}

.kk-browse-delete-confirm {
  box-sizing: border-box;
  inline-size: 100%;
  min-block-size: 44px;
  padding: 8px 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-small, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
}

.kk-browse-delete-confirm:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 1px;
}

.kk-browse-delete-review {
  margin-inline-start: auto;
}
</style>
