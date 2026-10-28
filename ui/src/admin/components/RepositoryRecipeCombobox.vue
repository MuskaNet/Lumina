<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { t } from "../../shared/i18n";
import M3List from "../../shared/components/M3List.vue";
import M3ListItem from "../../shared/components/M3ListItem.vue";
import { formatLogoClass } from "../repositoryIcons";
import { filterRecipes, findRecipeOption, type RecipeOption } from "../repositoryRecipes";

/**
 * Searchable recipe picker matching the upstream console: a trigger showing the
 * format logo, human format name and repository type badge, plus a filtered list
 * with keyboard support. Unlike a native select the options can show logos.
 */
const props = withDefaults(
  defineProps<{
    options: RecipeOption[];
    modelValue: string;
    disabled?: boolean;
    label?: string;
    fieldId?: string;
  }>(),
  {
    disabled: false,
    label: "Recipe",
    fieldId: "repo-recipe",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const popover = ref<HTMLElement | null>(null);

const open = ref(false);
const query = ref("");
const activeValue = ref("");
const position = ref({ left: 0, top: 0, width: 0 });

/** Native popover keeps the list above dialogs and out of scroll containers. */
const popoverSupported = typeof HTMLElement !== "undefined"
  && typeof (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover === "function";

const selected = computed(() => findRecipeOption(props.options, props.modelValue));
const filtered = computed(() => filterRecipes(props.options, query.value));

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
  const viewportWidth = window.innerWidth;
  const width = Math.min(rect.width, Math.max(0, viewportWidth - 16));
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

function scrollActiveIntoView() {
  const index = filtered.value.findIndex((option) => option.value === activeValue.value);
  if (index < 0) return;
  const node = popover.value?.querySelector<HTMLElement>(`[data-option-index="${index}"]`);
  if (node && typeof node.scrollIntoView === "function") {
    node.scrollIntoView({ block: "nearest" });
  }
}

function show() {
  if (props.disabled || !props.options.length) return;
  query.value = "";
  activeValue.value = selected.value?.value ?? props.options[0]?.value ?? "";
  open.value = true;
  bindListeners();
  void nextTick(() => {
    const element = popover.value;
    if (element && popoverSupported) {
      try {
        element.showPopover();
      } catch {
        // Already open (or unsupported); the inline position still applies.
      }
    }
    positionPopover();
    search.value?.focus();
    scrollActiveIntoView();
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

function select(option: RecipeOption) {
  emit("update:modelValue", option.value);
  close(true);
}

function moveActive(delta: number) {
  const items = filtered.value;
  if (!items.length) return;
  const index = items.findIndex((option) => option.value === activeValue.value);
  const next = index < 0
    ? (delta > 0 ? 0 : items.length - 1)
    : (index + delta + items.length) % items.length;
  activeValue.value = items[next]!.value;
  void nextTick(() => scrollActiveIntoView());
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
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const active = filtered.value.find((option) => option.value === activeValue.value)
      ?? filtered.value[0];
    if (active) select(active);
  } else if (event.key === "Escape") {
    event.preventDefault();
    close(true);
  }
}

watch(query, () => {
  activeValue.value = filtered.value[0]?.value ?? "";
});

watch(
  () => props.options,
  (options) => {
    if (!options.length) {
      close();
      return;
    }
    if (!options.some((option) => option.value === props.modelValue)) {
      emit("update:modelValue", options[0]!.value);
    }
    if (open.value && !options.some((option) => option.value === activeValue.value)) {
      activeValue.value = options[0]!.value;
    }
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      close();
    }
  },
);

onBeforeUnmount(unbindListeners);
</script>

<template>
  <div ref="root" class="kk-recipe-field" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <label :id="`${fieldId}-label`" class="kk-recipe-label">{{ t(label) }}</label>
    <button
      :id="`${fieldId}-trigger`"
      ref="trigger"
      type="button"
      class="kk-recipe-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${fieldId}-popover`"
      :aria-labelledby="`${fieldId}-label`"
      :disabled="disabled || !options.length"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span v-if="selected" class="kk-recipe-selection">
        <span :class="formatLogoClass(selected.format)" aria-hidden="true"></span>
        <span class="kk-recipe-name">{{ selected.displayName }}</span>
      </span>
      <span v-else class="kk-recipe-placeholder">
        {{ options.length ? t("Select a recipe") : t("No recipes available") }}
      </span>
      <span v-if="selected" class="micl-chips kk-chip-host kk-recipe-selected-type">
        <span class="micl-chip-assist kk-recipe-type">{{ selected.typeLabel }}</span>
      </span>
      <span class="material-symbols-outlined kk-recipe-caret" aria-hidden="true">arrow_drop_down</span>
    </button>

    <div
      v-if="open"
      :id="`${fieldId}-popover`"
      ref="popover"
      class="kk-recipe-popover"
      :popover="popoverSupported ? 'manual' : undefined"
      :style="{ left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px` }"
    >
      <div class="micl-textfield-filled kk-recipe-search">
        <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
        <label :for="`${fieldId}-search`">{{ t("Filter recipes") }}</label>
        <input
          :id="`${fieldId}-search`"
          ref="search"
          v-model="query"
          type="search"
          autocomplete="off"
          :aria-label="t('Filter recipes')"
          @keydown="onSearchKeydown"
        >
      </div>
      <M3List class="kk-recipe-options" :aria-label="t('Recipes')">
        <M3ListItem
          v-for="(option, index) in filtered"
          :id="`${fieldId}-option-${index}`"
          :key="option.value"
          class="kk-recipe-option"
          :data-recipe-value="option.value"
          :data-option-index="index"
          :tabindex="-1"
          clickable
          :selected="option.value === modelValue"
          :class="{ 'is-active': option.value === activeValue }"
          :aria-selected="option.value === modelValue"
          role="option"
          @click="select(option)"
          @mousemove="activeValue = option.value"
        >
          <template #leading>
            <span :class="formatLogoClass(option.format)" aria-hidden="true"></span>
          </template>
          <template #headline>{{ option.displayName }}</template>
          <template #trailing>
            <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-recipe-type">{{ option.typeLabel }}</span></span>
          </template>
        </M3ListItem>
        <li v-if="!filtered.length" class="kk-recipe-empty">{{ t("No matching recipes") }}</li>
      </M3List>
    </div>
  </div>
</template>

<style scoped>
/* ---- Repository recipe combobox --------------------------------------- */

.kk-recipe-field {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-block-start: calc(var(--md-sys-typescale-body-small-line-height, 16px) / 2);
}

.kk-recipe-label {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 10px;
  z-index: 1;
  padding-inline: 4px;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
  font-size: var(--md-sys-typescale-body-small-size, 0.75rem);
  line-height: 1;
  pointer-events: none;
}

.kk-recipe-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-block-size: 52px;
  padding: 8px 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-extra-small, 4px);
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.kk-recipe-trigger:hover {
  border-color: var(--md-sys-color-on-surface);
}

.kk-recipe-field.is-open .kk-recipe-trigger,
.kk-recipe-trigger:focus-visible {
  padding: 7px 11px;
  border: 2px solid var(--md-sys-color-primary);
  outline: none;
}

.kk-recipe-field.is-open .kk-recipe-label {
  color: var(--md-sys-color-primary);
}

.kk-recipe-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kk-recipe-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
  flex: 1 1 auto;
}

.kk-recipe-selected-type {
  margin-inline-start: auto;
  flex: 0 0 auto;
}

.kk-recipe-selection .format-logo {
  inline-size: 20px;
  block-size: 20px;
  flex: 0 0 20px;
}

.kk-recipe-name {
  overflow: hidden;
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kk-recipe-placeholder {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

.kk-recipe-caret {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 22px;
  transition: transform 120ms ease;
}

.kk-recipe-field.is-open .kk-recipe-caret {
  transform: rotate(180deg);
}

.kk-recipe-type {
  flex: 0 0 auto;
  --md-comp-assist-chip-label-text-color: var(--md-sys-color-on-secondary-container);
  --md-comp-assist-chip-outline-color: transparent;
  --md-comp-assist-chip-elevated-container-color: var(--md-sys-color-secondary-container);
}

.kk-recipe-popover {
  box-sizing: border-box;
  position: fixed;
  inset: auto;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-block-size: min(420px, 60vh);
  margin: 0;
  padding: 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-high);
  box-shadow: var(--md-sys-elevation-level3, 0 6px 20px rgb(0 0 0 / 24%));
}

.kk-recipe-search {
  --md-comp-text-field-container-height: 40px;
  --md-comp-text-field-icon-size: 20px;
  --md-comp-text-field-input-space: 12px;
  margin: 0;
}

.kk-recipe-options {
  flex: 1 1 auto;
  max-block-size: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  /* Compact rows for a picker list (MICL defaults to 56px for one line). */
  --md-comp-list-item-one-line-container-height: 40px;
}

.kk-recipe-option {
  margin-block: 2px;
}

.kk-recipe-option[aria-selected="true"] {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.kk-recipe-option.is-active:not([aria-selected="true"]) {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, var(--md-sys-color-surface-container-high));
}

.kk-recipe-option .format-logo {
  inline-size: 18px;
  block-size: 18px;
  flex: 0 0 18px;
}

.kk-recipe-empty {
  padding: 16px 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
  text-align: center;
  list-style: none;
}
</style>
