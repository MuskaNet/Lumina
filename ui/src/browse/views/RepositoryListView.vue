<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, {
  type DataTableColumn,
  type DataTableSort,
} from "../../shared/components/M3DataTable.vue";
import { formatLogoClass, typeIconName } from "../../shared/formatIcons";
import { writeClipboard } from "../../shared/clipboard";
import { repositoryClientUrl, type Repository } from "../repositoryUrls";

/**
 * Browser-level repository catalog: the entry point restored from the legacy
 * browse console. Each row opens the repository content tree; the URL column
 * keeps the client endpoint (Docker connector address or `/repository/<name>/`)
 * copyable for `docker login`, `npm config set registry`, ... setup.
 */
const props = defineProps<{ repositories: Repository[] }>();
const emit = defineEmits<{ open: [repo: string] }>();

interface RepositoryRow {
  repository: Repository;
  name: string;
  type: string;
  format: string;
  status: string;
  url: string;
  typeIcon: string;
  formatClass: string;
}

const filter = ref("");
const sort = ref<DataTableSort>({ key: "name", direction: "asc" });
const copied = ref("");
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null;

const columns: DataTableColumn[] = [
  { key: "icon", label: "" },
  { key: "name", label: "Name", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "format", label: "Format", sortable: true },
  { key: "status", label: "Status" },
  { key: "url", label: "URL" },
];

const SORT_KEYS: Readonly<Record<string, keyof Pick<RepositoryRow, "name" | "type" | "format">>> = {
  name: "name",
  type: "type",
  format: "format",
};

function sortValue(row: RepositoryRow, key: string): string {
  const field = SORT_KEYS[key] ?? "name";
  return row[field];
}

function sortRows(rows: RepositoryRow[], key: string, direction: DataTableSort["direction"]): RepositoryRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const primary = sortValue(left, key).localeCompare(sortValue(right, key), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    const fallback = left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return (primary || fallback) * factor;
  });
}

const rows = computed<RepositoryRow[]>(() => {
  const needle = filter.value.trim().toLowerCase();
  const projected = props.repositories.map((repository) => {
    const type = String(repository.type ?? "").toLowerCase();
    const format = String(repository.format ?? "").toLowerCase();
    return {
      repository,
      name: repository.name,
      type,
      format,
      status: repository.online ? t("Online") : t("Offline"),
      url: repositoryClientUrl(repository),
      typeIcon: typeIconName(type),
      formatClass: formatLogoClass(format),
    } satisfies RepositoryRow;
  });
  const visible = needle
    ? projected.filter((row) =>
        `${row.name} ${row.type} ${row.format} ${row.status}`.toLowerCase().includes(needle),
      )
    : projected;
  return sortRows(visible, sort.value.key, sort.value.direction);
});

function openRow(row: RepositoryRow, event: MouseEvent | KeyboardEvent): void {
  const target = event.target as Element | null;
  // Links and the copy button keep their own behaviour instead of opening the tree.
  if (target?.closest?.("a,button")) return;
  emit("open", row.name);
}

async function copyUrl(row: RepositoryRow): Promise<void> {
  try {
    await writeClipboard(row.url);
  } catch {
    showToast(t("Unable to copy repository URL"), "error");
    return;
  }
  copied.value = row.name;
  if (copiedResetTimer) clearTimeout(copiedResetTimer);
  copiedResetTimer = setTimeout(() => {
    copied.value = "";
    copiedResetTimer = null;
  }, 1200);
  showToast(t("Repository URL copied"), "ok");
}

/**
 * Clipboard writes live in `shared/clipboard.ts` so the repository catalog and
 * the content detail pane share the secure-context fallback.
 */
onUnmounted(() => {
  if (copiedResetTimer) clearTimeout(copiedResetTimer);
});
</script>

<template>
  <div class="kk-browse-filter-bar">
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="repository-filter">{{ t("Filter") }}</label>
      <input id="repository-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    <span class="kk-tonal-chip" role="status">
      <span class="material-symbols-outlined kk-tonal-chip__icon" aria-hidden="true">database</span>
      <span>{{ t("Matching repositories") }}: {{ rows.length }}</span>
    </span>
  </div>

  <div class="kk-table-card-container">
    <M3DataTable
      v-model:sort="sort"
      :columns="columns"
      :rows="rows"
      :row-key="(row: RepositoryRow) => row.name"
      :empty-text="t('No repositories found.')"
      :aria-label="t('Repositories')"
      clickable
      @row-click="openRow"
    >
      <template #cell-icon="{ row }">
        <span class="material-symbols-outlined kk-format-icon" aria-hidden="true">{{ row.typeIcon }}</span>
      </template>
      <template #cell-name="{ row }">
        <span class="kk-repo-name">{{ row.name }}</span>
      </template>
      <template #cell-type="{ row }">{{ row.type || "—" }}</template>
      <template #cell-format="{ row }">
        <span class="format-cell">
          <span :class="row.formatClass" aria-hidden="true"></span>
          <span class="format-cell-label">{{ row.format || "—" }}</span>
        </span>
      </template>
      <template #cell-status="{ row }">
        <span class="kk-badge kk-status-chip" :class="row.repository.online ? 'kk-badge--ok' : 'kk-badge--bad'">
          {{ row.status }}
        </span>
      </template>
      <template #cell-url="{ row }">
        <span class="kk-repo-url">
          <a
            class="kk-repo-url__link"
            :href="row.url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >{{ row.url }}</a>
          <button
            type="button"
            class="micl-iconbutton-standard-s kk-repo-url__copy"
            :title="copied === row.name ? t('Copied') : t('Copy repository URL')"
            :aria-label="copied === row.name ? t('Copied') : t('Copy repository URL')"
            @click.stop="copyUrl(row)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              {{ copied === row.name ? "check" : "content_copy" }}
            </span>
          </button>
        </span>
      </template>
    </M3DataTable>
  </div>
</template>
