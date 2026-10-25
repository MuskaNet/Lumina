<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { t } from "../../shared/i18n";
import M3List from "../../shared/components/M3List.vue";
import { formatLogoClass } from "../repositoryIcons";
import { recipeTypeLabel } from "../repositoryRecipes";
import {
  cleanupFormatLabel,
  cleanupRepositoryCandidates,
  filterCleanupRepositories,
  pruneCleanupRepositoryIds,
  type CleanupRepositoryLike,
} from "../cleanupPolicy";

/**
 * Multi-select repository picker for cleanup policies. Only Hosted/Proxy
 * repositories of the policy format are candidates (the server rejects groups),
 * matching the upstream console picker.
 */
const props = withDefaults(
  defineProps<{
    repositories: CleanupRepositoryLike[];
    format: string;
    modelValue: number[];
    label?: string;
    fieldId?: string;
    error?: boolean;
  }>(),
  {
    label: "Repositories",
    fieldId: "cleanup-repositories",
    error: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number[]] }>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const popover = ref<HTMLElement | null>(null);

const open = ref(false);
const query = ref("");
const position = ref({ left: 0, top: 0, width: 0 });

const popoverSupported = typeof HTMLElement !== "undefined"
  && typeof (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover === "function";

const candidates = computed(() => cleanupRepositoryCandidates(props.repositories, props.format));
const selectedIds = computed(() => new Set(props.modelValue.map(Number)));
const visible = computed(() => filterCleanupRepositories(candidates.value, query.value));
const selectedCandidates = computed(() =>
  candidates.value.filter((repository) => selectedIds.value.has(Number(repository.id))),
);
const summaryChips = computed(() => selectedCandidates.value.slice(0, 2));
const hiddenCount = computed(() => Math.max(0, selectedCandidates.value.length - summaryChips.value.length));
const formatLabel = computed(() => cleanupFormatLabel(props.format));
const placeholder = computed(() =>
  `${t("Select one or more")} ${formatLabel.value} ${t("repositories")}`,
);
const emptyMessage = computed(() => {
  if (candidates.value.length === 0) {
    return `${t("No Hosted or Proxy repositories are available for this format. Create one first.")}`;
  }
  return `${t("No repositories match")} “${query.value.trim()}”.`;
});

function onDocumentPointerDown(event: Event) {
  const target = event.target as Node | null;
  if (!target) return;
  if (root.value?.contains(target)) return;
  if (popover.value?.contains(target)) return;
  close();
}

function positionPopover() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const width = Math.max(rect.width, 360);
  const viewportWidth = typeof window === "undefined" ? width : window.innerWidth;
  const left = Math.min(rect.left, Math.max(8, viewportWidth - width - 8));
  position.value = { left, top: rect.bottom + 6, width };
}

function bindListeners() {
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  window.addEventListener("resize", positionPopover);
  window.addEventListener("scroll", positionPopover, true);
}

function unbindListeners() {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  window.removeEventListener("resize", positionPopover);
  window.removeEventListener("scroll", positionPopover, true);
}

function show() {
  query.value = "";
  open.value = true;
  bindListeners();
  void nextTick(() => {
    const element = popover.value;
    if (element && popoverSupported) {
      try {
        element.showPopover();
      } catch {
        // Already open; inline position still applies.
      }
    }
    positionPopover();
    search.value?.focus();
  });
}

function close(focusTrigger = false) {
  if (!open.value) return;
  try {
    popover.value?.hidePopover();
  } catch {
    // Nothing to hide.
  }
  open.value = false;
  unbindListeners();
  if (focusTrigger) trigger.value?.focus();
}

function toggle() {
  if (open.value) close(true);
  else show();
}

function emitSelection(ids: number[]) {
  emit("update:modelValue", ids);
}

function toggleRepository(id: number | null | undefined) {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) return;
  const next = new Set(props.modelValue.map(Number));
  if (next.has(numeric)) next.delete(numeric);
  else next.add(numeric);
  emitSelection([...next]);
}

function selectVisible() {
  const next = new Set(props.modelValue.map(Number));
  for (const repository of visible.value) next.add(Number(repository.id));
  emitSelection([...next]);
}

function clearAll() {
  emitSelection([]);
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    show();
  } else if (event.key === "Escape" && open.value) {
    event.preventDefault();
    close(true);
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close(true);
  }
}

watch(
  () => props.format,
  () => {
    query.value = "";
    const pruned = pruneCleanupRepositoryIds(props.modelValue, candidates.value);
    if (pruned.length !== props.modelValue.length) emitSelection(pruned);
    if (open.value) void nextTick(positionPopover);
  },
);

watch(
  () => props.error,
  (invalid) => {
    if (invalid) void nextTick(() => trigger.value?.focus());
  },
);

onBeforeUnmount(unbindListeners);
</script>

<template>
  <div
    ref="root"
    class="kk-cleanup-repo-field"
    :class="{ 'is-open': open, 'is-invalid': error }"
  >
    <label :id="`${fieldId}-label`" class="kk-cleanup-repo-label">{{ t(label) }}</label>
    <button
      :id="`${fieldId}-trigger`"
      ref="trigger"
      type="button"
      class="kk-cleanup-repo-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${fieldId}-popover`"
      :aria-labelledby="`${fieldId}-label`"
      :aria-invalid="error"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span v-if="!selectedCandidates.length" class="kk-cleanup-repo-placeholder">
        {{ placeholder }}
      </span>
      <span v-else class="kk-cleanup-repo-chips">
        <span v-for="repository in summaryChips" :key="repository.name" class="kk-cleanup-repo-chip">
          {{ repository.name }}
        </span>
        <span v-if="hiddenCount > 0" class="kk-cleanup-repo-more">+{{ hiddenCount }} {{ t("more") }}</span>
      </span>
      <span class="material-symbols-outlined kk-cleanup-repo-caret" aria-hidden="true">arrow_drop_down</span>
    </button>

    <div
      v-if="open"
      :id="`${fieldId}-popover`"
      ref="popover"
      class="kk-recipe-popover kk-cleanup-repo-popover"
      :popover="popoverSupported ? 'manual' : undefined"
      :style="{ left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px` }"
    >
      <div class="kk-cleanup-repo-toolbar">
        <div class="micl-textfield-outlined kk-cleanup-repo-search">
          <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
          <label :for="`${fieldId}-search`">{{ t("Search repositories") }}</label>
          <input
            :id="`${fieldId}-search`"
            ref="search"
            v-model="query"
            type="search"
            autocomplete="off"
            :aria-label="t('Search repositories')"
            @keydown="onSearchKeydown"
          >
        </div>
        <div class="kk-cleanup-repo-actions">
          <button
            type="button"
            class="micl-button-text-s"
            :disabled="!visible.length"
            @click="selectVisible"
          >
            {{ t("Select visible") }}
          </button>
          <button
            type="button"
            class="micl-button-text-s"
            :disabled="!modelValue.length"
            @click="clearAll"
          >
            {{ t("Clear") }}
          </button>
        </div>
      </div>

      <!-- Choosing several repositories for one policy: a multi-select set, so checkboxes rather than switches. -->
      <M3List class="kk-cleanup-repo-options" :aria-label="t('Repositories')">
        <li v-for="repository in visible" :key="repository.id ?? repository.name">
          <label
            class="kk-cleanup-repo-option"
            :class="{ 'is-selected': selectedIds.has(Number(repository.id)) }"
          >
            <input
              class="micl-checkbox"
              type="checkbox"
              :checked="selectedIds.has(Number(repository.id))"
              :value="repository.id ?? undefined"
              @change="toggleRepository(repository.id)"
            >
            <span :class="formatLogoClass(repository.format)" aria-hidden="true"></span>
            <span class="kk-cleanup-repo-copy">
              <strong>{{ repository.name }}</strong>
              <small>{{ formatLabel }} · {{ repository.online === false ? t("Offline") : t("Online") }}</small>
            </span>
            <span class="kk-cleanup-repo-type">{{ t(recipeTypeLabel(repository.type)) }}</span>
          </label>
        </li>
        <li v-if="!visible.length" class="kk-cleanup-repo-empty">{{ emptyMessage }}</li>
      </M3List>

      <p class="kk-cleanup-repo-footer" aria-live="polite">
        {{ modelValue.length }} {{ t("selected") }} · {{ candidates.length }} {{ t("available") }}
      </p>
    </div>
  </div>
</template>
