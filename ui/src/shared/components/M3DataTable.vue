<script setup lang="ts" generic="TRow">
import { computed } from "vue";
import { t } from "../i18n";

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
    emptyText?: string;
    ariaLabel?: string;
  }>(),
  {
    sort: null,
    loading: false,
    emptyText: "No results found.",
    ariaLabel: undefined,
  },
);

const emit = defineEmits<{
  "update:sort": [sort: DataTableSort];
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
</script>

<template>
  <div class="kk-table-frame">
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
        <tr v-if="loading">
          <td :colspan="columns.length" class="kk-table__placeholder">
            <span class="kk-inline-progress" role="status">{{ t("Loading…") }}</span>
          </td>
        </tr>
        <tr v-else-if="showEmpty">
          <td :colspan="columns.length" class="kk-table__placeholder">{{ t(emptyText) }}</td>
        </tr>
        <template v-else>
          <tr v-for="row in rows" :key="rowKey(row)">
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
</template>
