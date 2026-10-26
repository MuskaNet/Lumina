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
