<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../../shared/i18n";
import M3List from "../../shared/components/M3List.vue";
import M3ListItem from "../../shared/components/M3ListItem.vue";
import {
  addMemberNames,
  availableMembers,
  moveMember,
  removeMemberNames,
  toggleMemberHighlight,
} from "../repositoryMembers";

export interface TransferOption {
  name: string;
  supportingText?: string;
}

const props = withDefaults(defineProps<{
  modelValue: string[];
  options: TransferOption[];
  availableTitle?: string;
  selectedTitle?: string;
  selectedHint?: string;
  filterId?: string;
  availableEmpty?: string;
  selectedEmpty?: string;
  reorder?: boolean;
}>(), {
  availableTitle: "Available",
  selectedTitle: "Selected",
  selectedHint: "Priority (top → bottom)",
  filterId: "member-transfer-filter",
  availableEmpty: "No matches",
  selectedEmpty: "Nothing selected",
  reorder: true,
});

const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();
const filter = ref("");
const availableHighlight = ref<string[]>([]);
const selectedHighlight = ref<string[]>([]);

const available = computed(() => availableMembers(props.options, props.modelValue, filter.value));
const selected = computed(() => props.modelValue);
const showReorder = computed(() => props.reorder);

function update(value: string[]): void {
  emit("update:modelValue", value);
}

function select(side: "available" | "selected", name: string, event: MouseEvent | KeyboardEvent): void {
  const mouse = event instanceof MouseEvent ? event : null;
  const additive = Boolean(mouse && (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey));
  const target = side === "available" ? availableHighlight : selectedHighlight;
  const other = side === "available" ? selectedHighlight : availableHighlight;
  target.value = toggleMemberHighlight(target.value, name, additive);
  if (!additive) other.value = [];
}

function addSelected(): void {
  update(addMemberNames(props.modelValue, availableHighlight.value));
  selectedHighlight.value = [...availableHighlight.value];
  availableHighlight.value = [];
}

function addAll(): void {
  const names = available.value.map((option) => option.name);
  update(addMemberNames(props.modelValue, names));
  selectedHighlight.value = names;
  availableHighlight.value = [];
}

function removeSelected(): void {
  update(removeMemberNames(props.modelValue, selectedHighlight.value));
  availableHighlight.value = [...selectedHighlight.value];
  selectedHighlight.value = [];
}

function removeAll(): void {
  update([]);
  availableHighlight.value = [...props.modelValue];
  selectedHighlight.value = [];
}

function reorder(name: string, offset: number): void {
  update(moveMember(props.modelValue, name, offset));
  selectedHighlight.value = [name];
}
</script>

<template>
  <div class="kk-member-transfer">
    <section class="kk-member-pane" :aria-labelledby="`${filterId}-available-title`">
      <header class="kk-member-pane__head">
        <span :id="`${filterId}-available-title`">{{ t(availableTitle) }}</span>
        <span class="kk-member-count">{{ available.length }}</span>
      </header>
      <div class="micl-textfield-outlined kk-member-filter">
        <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
        <label :for="filterId">{{ t("Filter") }}</label>
        <input :id="filterId" v-model="filter" type="search" autocomplete="off">
      </div>
      <M3List class="kk-member-list" :aria-label="t(availableTitle)">
        <M3ListItem
          v-for="option in available"
          :key="option.name"
          :headline="option.name"
          :supporting-text="option.supportingText"
          clickable
          class="kk-member-list-item"
          :class="{ 'is-selected': availableHighlight.includes(option.name) }"
          :selected="availableHighlight.includes(option.name)"
          @click="select('available', option.name, $event)"
        />
        <li v-if="!available.length" class="kk-member-empty" role="status">
          <span class="material-symbols-outlined kk-member-empty__icon" aria-hidden="true">person_off</span>
          <span>{{ t(filter.trim() ? availableEmpty : "No eligible members") }}</span>
        </li>
      </M3List>
    </section>

    <div class="micl-buttongroup kk-member-actions" role="group" :aria-label="t('Selection actions')">
      <button type="button" class="micl-iconbutton-standard-s" :disabled="!available.length" :title="t('Add all')" @click="addAll"><span class="material-symbols-outlined" aria-hidden="true">keyboard_double_arrow_right</span></button>
      <button type="button" class="micl-iconbutton-standard-s" :disabled="!availableHighlight.length" :title="t('Add selected')" @click="addSelected"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
      <button type="button" class="micl-iconbutton-standard-s" :disabled="!selectedHighlight.length" :title="t('Remove selected')" @click="removeSelected"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
      <button type="button" class="micl-iconbutton-standard-s" :disabled="!selected.length" :title="t('Remove all')" @click="removeAll"><span class="material-symbols-outlined" aria-hidden="true">keyboard_double_arrow_left</span></button>
    </div>

    <section class="kk-member-pane" :aria-labelledby="`${filterId}-selected-title`">
      <header class="kk-member-pane__head">
        <span :id="`${filterId}-selected-title`">{{ t(selectedTitle) }}</span>
        <span class="kk-member-count">{{ selected.length }}</span>
      </header>
      <p v-if="selectedHint" class="kk-member-hint">{{ t(selectedHint) }}</p>
      <M3List class="kk-member-list" :aria-label="t(selectedTitle)">
        <M3ListItem
          v-for="(name, index) in selected"
          :key="name"
          :headline="name"
          clickable
          class="kk-member-list-item"
          :class="{ 'is-selected': selectedHighlight.includes(name) }"
          :selected="selectedHighlight.includes(name)"
          @click="select('selected', name, $event)"
        >
          <template #trailing>
            <span v-if="showReorder" class="kk-member-option__actions">
              <span class="kk-member-option__index">{{ index + 1 }}</span>
              <button type="button" class="micl-iconbutton-standard-s kk-member-order" :disabled="index === 0" :title="t('Move up')" @click.stop="reorder(name, -1)"><span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span></button>
              <button type="button" class="micl-iconbutton-standard-s kk-member-order" :disabled="index === selected.length - 1" :title="t('Move down')" @click.stop="reorder(name, 1)"><span class="material-symbols-outlined" aria-hidden="true">arrow_downward</span></button>
            </span>
          </template>
        </M3ListItem>
        <li v-if="!selected.length" class="kk-member-empty" role="status">
          <span class="material-symbols-outlined kk-member-empty__icon" aria-hidden="true">inbox</span>
          <span>{{ t(selectedEmpty) }}</span>
        </li>
      </M3List>
    </section>
  </div>
</template>

<style scoped>
.kk-member-transfer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
  block-size: clamp(320px, 42vh, 420px);
  max-block-size: calc(100vh - 280px);
}

.kk-member-pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  block-size: 100%;
  min-block-size: 0;
  min-inline-size: 0;
  max-block-size: 100%;
  padding: 8px;
  overflow: hidden;
  border: 0;
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container);
}

.kk-member-pane__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-inline-size: 0;
  margin-block-end: 2px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface);
  font-size: .875rem;
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
}

.kk-member-pane__head > span:first-child {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kk-member-count {
  flex: 0 0 auto;
  min-inline-size: 1.5rem;
  padding-inline: 6px;
  border-radius: 9999px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-size: .6875rem;
  font-weight: 700;
  text-align: center;
}

.kk-member-filter {
  margin-block-start: 4px;
}

.kk-member-filter.micl-textfield-outlined {
  --md-comp-text-field-container-height: 40px;
  --md-comp-text-field-icon-size: 20px;
  --md-comp-text-field-input-space: 12px;
  margin-block-start: 4px;
}

.kk-member-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-block-size: 0;
  max-block-size: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.kk-member-hint {
  margin: 0 0 2px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: .75rem;
  line-height: 1.35;
}

.kk-member-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-block-size: 100px;
  margin: auto 0;
  padding: 16px 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: .8125rem;
  line-height: 1.35;
  text-align: center;
}

.kk-member-empty__icon {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 28px;
  opacity: .55;
}

.kk-member-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.kk-member-option__actions {
  display: inline-flex;
  flex: 0 0 auto;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin-inline-start: auto;
  padding-inline-start: 6px;
  white-space: nowrap;
}

.kk-member-option__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-inline-size: 20px;
  block-size: 20px;
  margin-inline-end: 2px;
  padding-inline: 4px;
  border-radius: 9999px;
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface-variant);
  font-size: .6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.kk-member-option__actions .kk-member-order {
  --micl-width: 28px;
  --micl-height: 28px;
  flex: 0 0 auto;
  color: var(--md-sys-color-on-surface-variant);
}

.kk-member-option__actions .kk-member-order .material-symbols-outlined {
  font-size: 18px;
}

.kk-member-option__actions .kk-member-order:not(:disabled):hover {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.kk-member-option__actions .kk-member-order:disabled {
  opacity: .38;
}

:deep(.kk-member-pane .micl-list-item-one) {
  display: flex;
  align-items: center;
  min-inline-size: 0;
  min-block-size: 34px;
  padding-block: 3px;
  padding-inline: 6px;
}

.kk-member-list-item.is-selected {
  border-radius: var(--md-sys-shape-corner-small, 8px);
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

:deep(.kk-member-pane .micl-list-item__text) {
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow: hidden;
}

:deep(.kk-member-pane .micl-list-item__headline),
:deep(.kk-member-pane .micl-list-item__supporting-text) {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.kk-member-pane .kk-member-option__actions) {
  flex: 0 0 auto;
  margin-inline-start: auto;
}

@media (max-width: 768px) {
  .kk-member-transfer {
    grid-template-columns: 1fr;
    block-size: auto;
    max-block-size: none;
  }

  .kk-member-pane {
    min-block-size: 220px;
  }

  .kk-member-actions {
    flex-direction: row;
    justify-content: center;
    --md-comp-button-group-standard-small-between-space: 4px;
  }
}
</style>
