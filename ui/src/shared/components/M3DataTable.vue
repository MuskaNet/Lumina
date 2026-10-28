<script setup lang="ts" generic="TRow">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { t } from "../i18n";
import { beginTask, endTask } from "../progress";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "start" | "end";
  /** Extra class for both header and body cells, e.g. a width hint. */
  cellClass?: string;
}

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
  key: string;
  direction: SortDirection;
}

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[];
    rows: TRow[];
    rowKey: (row: TRow) => string;
    sort?: DataTableSort | null;
    loading?: boolean;
    linearProgress?: boolean;
    emptyText?: string;
    emptyIcon?: string;
    ariaLabel?: string;
    variant?: "default" | "segmented" | "card";
    density?: "compact" | "comfortable" | "spacious";
    clickable?: boolean;
    selectedKey?: string | null;
  }>(),
  {
    sort: null,
    loading: false,
    linearProgress: false,
    emptyText: "No results found.",
    emptyIcon: "inbox",
    ariaLabel: undefined,
    variant: "default",
    density: "comfortable",
    clickable: false,
    selectedKey: null,
  },
);

const emit = defineEmits<{
  "update:sort": [sort: DataTableSort];
  "row-click": [row: TRow, event: MouseEvent | KeyboardEvent];
}>();

const showEmpty = computed(() => !props.loading && props.rows.length === 0);

function ariaSort(column: DataTableColumn): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) return undefined;
  if (props.sort?.key !== column.key) return "none";
  return props.sort.direction === "asc" ? "ascending" : "descending";
}

function indicator(column: DataTableColumn): string {
  if (props.sort?.key !== column.key) return "unfold_more";
  return props.sort.direction === "asc" ? "arrow_upward" : "arrow_downward";
}

function toggleSort(column: DataTableColumn) {
  if (!column.sortable) return;
  const current = props.sort;
  const direction: SortDirection = current?.key === column.key && current.direction === "asc" ? "desc" : "asc";
  emit("update:sort", { key: column.key, direction });
}

function onRowClick(row: TRow, event: MouseEvent | KeyboardEvent) {
  if (!props.clickable) return;
  emit("row-click", row, event);
}

let hasActiveTask = false;

onMounted(() => {
  if (props.loading) {
    beginTask();
    hasActiveTask = true;
  }
});

watch(
  () => props.loading,
  (isLoading) => {
    if (isLoading && !hasActiveTask) {
      beginTask();
      hasActiveTask = true;
    } else if (!isLoading && hasActiveTask) {
      endTask();
      hasActiveTask = false;
    }
  },
);

onUnmounted(() => {
  if (hasActiveTask) {
    endTask();
    hasActiveTask = false;
  }
});
</script>

<template>
  <div class="kk-table-card-container">
  <div
    class="kk-table-frame"
    :class="[
      `kk-table-frame--${density}`,
      variant !== 'default' ? `kk-table-frame--${variant}` : undefined,
    ]"
  >
    <div v-if="loading && linearProgress" class="kk-table-progress" role="progressbar" :aria-label="t('Loading')">
      <div class="kk-table-progress__bar"></div>
    </div>
    <table class="kk-table" :aria-label="ariaLabel">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="[column.cellClass, column.align === 'end' ? 'is-end' : undefined]"
            :aria-sort="ariaSort(column)"
            scope="col"
          >
            <button
              v-if="column.sortable"
              type="button"
              class="kk-sort-button"
              :class="{ 'is-active': sort?.key === column.key }"
              @click="toggleSort(column)"
            >
              <span class="material-symbols-outlined kk-sort-icon" aria-hidden="true">{{ indicator(column) }}</span>
              <span>{{ t(column.label) }}</span>
            </button>
            <template v-else>{{ t(column.label) }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading && rows.length === 0">
          <td :colspan="columns.length" class="kk-table__placeholder">
            <div class="kk-table-loading">
              <div class="kk-table-spinner" aria-hidden="true"></div>
              <span class="kk-inline-progress" role="status">{{ t("Loading…") }}</span>
            </div>
          </td>
        </tr>
        <tr v-else-if="showEmpty">
          <td :colspan="columns.length" class="kk-table__placeholder">
            <slot name="empty">
              <div class="kk-table-empty">
                <span class="material-symbols-outlined kk-table-empty__icon" aria-hidden="true">{{ emptyIcon }}</span>
                <span class="kk-table-empty__text">{{ t(emptyText) }}</span>
              </div>
            </slot>
          </td>
        </tr>
        <template v-else>
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            :class="{
              'is-clickable': clickable,
              'is-selected': selectedKey !== null && selectedKey === rowKey(row),
            }"
            :tabindex="clickable ? 0 : undefined"
            @click="onRowClick(row, $event)"
            @keydown.enter="onRowClick(row, $event)"
            @keydown.space.prevent="onRowClick(row, $event)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[column.cellClass, column.align === 'end' ? 'is-end' : undefined]"
            >
              <slot :name="`cell-${column.key}`" :row="row" :column="column">
                {{ (row as Record<string, unknown>)[column.key] }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
  </div>
</template>  

<style>
/* Deliberately unscoped: cell contents come from slot props, so scoped
 * attributes would not reach the slotted markup. */
.kk-table-card-container {
  background-color: var(--md-sys-color-surface-container);
  border-radius: 24px;
  padding: 16px;
  overflow: hidden;
}

.kk-table-card-container .kk-table-frame {
  border: none;
  box-shadow: none;
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-low);
  min-inline-size: 0;
}

.kk-table-card-container .kk-table {
  min-inline-size: 680px;
}

.kk-table-card-container .kk-table th,
.kk-table-card-container .kk-table td {
  padding-block: 16px;
  padding-inline: 18px;
}

.kk-table-card-container .kk-table thead th {
  background-color: var(--md-sys-color-surface-container-high);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-block-end: 1px solid var(--md-sys-color-outline-variant);
}

.kk-table-card-container .kk-table tbody tr {
  transition: background-color 150ms ease;
}

.kk-table-card-container .kk-table tbody tr:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.kk-table-frame {
  position: relative;
  overflow: auto;
  border: 1px solid var(--md-comp-data-table-divider-color);
  border-radius: var(--md-comp-data-table-container-shape);
  background: var(--md-comp-data-table-container-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition:
    border-color var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease,
    box-shadow var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease;
}

.kk-table-frame:focus-within {
  border-color: var(--md-sys-color-outline);
}

/* Linear progress indicator at the top of the table frame */
.kk-table-progress {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  block-size: 3px;
  background-color: var(--md-sys-color-surface-container-high);
  overflow: hidden;
  z-index: 3;
}

.kk-table-progress__bar {
  block-size: 100%;
  background-color: var(--md-sys-color-primary);
  border-radius: 9999px;
  animation: kk-table-indeterminate 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes kk-table-indeterminate {
  0% {
    margin-inline-start: 0%;
    inline-size: 0%;
  }
  50% {
    margin-inline-start: 25%;
    inline-size: 65%;
  }
  100% {
    margin-inline-start: 100%;
    inline-size: 0%;
  }
}

.kk-table {
  inline-size: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--md-sys-color-on-surface);
  font-family: var(--md-ref-typeface-plain);
  font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
  line-height: var(--md-sys-typescale-body-medium-line-height, 1.25rem);
}

.kk-table th,
.kk-table td,
.kk-table :is(th, td) * {
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}

.kk-table th,
.kk-table td {
  padding: var(--md-comp-data-table-cell-padding-block) var(--md-comp-data-table-cell-padding-inline);
  text-align: start;
  vertical-align: middle;
  border-block-end: 1px solid var(--md-comp-data-table-divider-color);
  transition:
    background-color var(--md-sys-motion-expressive-default-effects-duration, 200ms) var(--md-sys-motion-expressive-default-spatial),
    color var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease;
}

.kk-table thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background: var(--md-comp-data-table-header-color);
  color: var(--md-comp-data-table-header-text-color);
  font-size: var(--md-sys-typescale-label-large-size, 0.875rem);
  line-height: var(--md-sys-typescale-label-large-line-height, 1.25rem);
  font-weight: 600;
  letter-spacing: 0.0125rem;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}

.kk-table thead th:first-child {
  border-start-start-radius: calc(var(--md-comp-data-table-container-shape) - 1px);
}

.kk-table thead th:last-child {
  border-start-end-radius: calc(var(--md-comp-data-table-container-shape) - 1px);
}

.kk-table tbody tr {
  transition:
    background-color var(--md-sys-motion-expressive-default-effects-duration, 200ms) var(--md-sys-motion-expressive-default-spatial),
    color var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease;
}

.kk-table tbody tr:last-child td {
  border-block-end: 0;
}

.kk-table tbody tr:last-child td:first-child {
  border-end-start-radius: calc(var(--md-comp-data-table-container-shape) - 1px);
}

.kk-table tbody tr:last-child td:last-child {
  border-end-end-radius: calc(var(--md-comp-data-table-container-shape) - 1px);
}

.kk-table tbody tr:hover {
  background: var(--md-comp-data-table-row-hover-color);
}

.kk-table tbody tr:active {
  background: var(--md-comp-data-table-row-active-color);
}

.kk-table tbody tr.is-selected {
  background: var(--md-comp-data-table-row-selected-color);
  color: var(--md-comp-data-table-row-selected-text-color);
}

.kk-table tbody tr.is-clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.kk-table tbody tr.is-clickable:focus-visible {
  outline: var(--md-sys-state-focus-indicator-thickness, 3px) solid var(--md-sys-color-secondary);
  outline-offset: -3px;
}

/* Density variants */
.kk-table-frame--compact {
  --md-comp-data-table-cell-padding-block: 8px;
  --md-comp-data-table-cell-padding-inline: 12px;
}

.kk-table-frame--compact .kk-table {
  font-size: var(--md-sys-typescale-body-small-size, 0.75rem);
}

.kk-table-frame--spacious {
  --md-comp-data-table-cell-padding-block: 16px;
  --md-comp-data-table-cell-padding-inline: 20px;
}

/* Segmented / Card variant */
.kk-table-frame--segmented {
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.kk-table-frame--segmented .kk-table {
  border-collapse: separate;
  border-spacing: 0 var(--md-comp-list-segment-gap, 4px);
}

.kk-table-frame--segmented .kk-table thead th {
  background: transparent;
  border-block-end: none;
  padding-block-end: 6px;
}

.kk-table-frame--segmented .kk-table tbody tr {
  background: var(--md-comp-data-table-container-color);
  border-radius: var(--md-sys-shape-corner-small, 8px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.kk-table-frame--segmented .kk-table tbody tr td {
  border: none;
  border-block-start: 1px solid var(--md-comp-data-table-divider-color);
  border-block-end: 1px solid var(--md-comp-data-table-divider-color);
}

.kk-table-frame--segmented .kk-table tbody tr td:first-child {
  border-inline-start: 1px solid var(--md-comp-data-table-divider-color);
  border-start-start-radius: var(--md-sys-shape-corner-small, 8px);
  border-end-start-radius: var(--md-sys-shape-corner-small, 8px);
}

.kk-table-frame--segmented .kk-table tbody tr td:last-child {
  border-inline-end: 1px solid var(--md-comp-data-table-divider-color);
  border-start-end-radius: var(--md-sys-shape-corner-small, 8px);
  border-end-end-radius: var(--md-sys-shape-corner-small, 8px);
}

.kk-table-frame--segmented .kk-table tbody tr:hover {
  background: var(--md-comp-data-table-row-hover-color);
}

.kk-table-frame--segmented .kk-table tbody tr:hover td:first-child {
  border-start-start-radius: var(--md-sys-shape-corner-medium, 12px);
  border-end-start-radius: var(--md-sys-shape-corner-medium, 12px);
}

.kk-table-frame--segmented .kk-table tbody tr:hover td:last-child {
  border-start-end-radius: var(--md-sys-shape-corner-medium, 12px);
  border-end-end-radius: var(--md-sys-shape-corner-medium, 12px);
}

.kk-table .is-end {
  text-align: end;
}

.kk-col-location {
  inline-size: 16rem;
  max-inline-size: 16rem;
}

.kk-col-location .kk-mono {
  overflow-wrap: anywhere;
}

.kk-table__placeholder {
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
  padding: 0 !important;
}

.kk-sort-button {
  display: flex;
  inline-size: max-content;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin: -4px -8px;
  border: 0;
  border-radius: var(--md-sys-shape-corner-small, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
  transition:
    background-color var(--md-sys-motion-expressive-default-effects-duration, 200ms) var(--md-sys-motion-expressive-default-spatial),
    color var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease;
}

.kk-table th.is-end .kk-sort-button {
  margin-inline-start: auto;
}

.kk-sort-button:hover {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.kk-sort-button:focus-visible {
  outline: var(--md-sys-state-focus-indicator-thickness, 3px) solid var(--md-sys-color-secondary);
  outline-offset: -1px;
}

.kk-sort-icon {
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  opacity: 0.55;
  transition:
    transform var(--md-sys-motion-expressive-default-effects-duration, 200ms) var(--md-sys-motion-expressive-fast-spatial),
    opacity 200ms ease,
    color 200ms ease;
}

.kk-sort-button.is-active {
  background: transparent;
  color: var(--md-sys-color-primary);
  font-weight: 700;
}

.kk-sort-button.is-active:hover {
  background: var(--md-sys-color-surface-container-high);
}

.kk-sort-button.is-active .kk-sort-icon {
  opacity: 1;
  color: var(--md-sys-color-primary);
}

/* Empty state */
.kk-table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: var(--md-sys-padding-xl, 32px) var(--md-sys-padding-m, 16px);
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
}

.kk-table-empty__icon {
  font-size: 36px;
  opacity: 0.7;
  color: var(--md-sys-color-primary);
}

.kk-table-empty__text {
  font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
  font-weight: var(--md-ref-typeface-weight-medium, 500);
}

/* Loading state */
.kk-table-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: var(--md-sys-padding-xl, 28px);
  color: var(--md-sys-color-on-surface-variant);
}

.kk-table-spinner {
  inline-size: 20px;
  block-size: 20px;
  border: 2.5px solid var(--md-sys-color-surface-container-high);
  border-top-color: var(--md-sys-color-primary);
  border-radius: 50%;
  animation: kk-table-spin 0.8s linear infinite;
}

@keyframes kk-table-spin {
  to { transform: rotate(360deg); }
}

.kk-inline-progress {
  color: var(--md-sys-color-on-surface-variant);
}
</style>
