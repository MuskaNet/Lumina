<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";

interface AuditEntry {
  occurredAt?: string | null;
  actorSource?: string | null;
  actorUserId?: string | null;
  remoteAddr?: string | null;
  method?: string | null;
  path?: string | null;
  permission?: string | null;
  status?: number | null;
  outcome?: string | null;
  details?: unknown;
}

interface AuditPage {
  total: number;
  page: number;
  size: number;
  items: AuditEntry[];
}

const page = ref<AuditPage>({ total: 0, page: 0, size: 50, items: [] });
const loading = ref(true);
const filters = reactive({ q: "", actorUserId: "", outcome: "", from: "", to: "", size: 50 });

const columns: DataTableColumn[] = [
  { key: "occurredAt", label: "Time" },
  { key: "actor", label: "Actor" },
  { key: "remoteAddr", label: "Remote" },
  { key: "method", label: "Method" },
  { key: "path", label: "Path", cellClass: "kk-col-location" },
  { key: "permission", label: "Permission", cellClass: "kk-col-location" },
  { key: "status", label: "Status", align: "end" },
  { key: "outcome", label: "Outcome" },
];

const totalPages = () => Math.max(1, Math.ceil(page.value.total / Math.max(1, page.value.size)));

function timestamp(value?: string | null): string {
  if (!value) return "—";
  return String(value).replace("T", " ").replace(/(\.\d{3})\d*/, "$1");
}

function actor(entry: AuditEntry): string {
  if (!entry.actorUserId) return "system";
  return entry.actorSource ? `${entry.actorSource}/${entry.actorUserId}` : entry.actorUserId;
}

async function load(target = 0) {
  loading.value = true;
  const params = new URLSearchParams({
    page: String(Math.max(0, target)),
    size: String(filters.size),
  });
  for (const key of ["q", "actorUserId", "outcome", "from", "to"] as const) {
    const value = String(filters[key] ?? "").trim();
    if (value) params.set(key, value);
  }
  try {
    const payload = await api.get<AuditPage>(`/internal/security/audit-log?${params.toString()}`);
    page.value = {
      total: Number(payload.total) || 0,
      page: Number(payload.page) || 0,
      size: Number(payload.size) || filters.size,
      items: payload.items ?? [],
    };
  } catch (error) {
    showToast(`${t("Failed to load audit log")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

function summary(): string {
  if (page.value.total === 0) return "0";
  const first = page.value.page * page.value.size + 1;
  const last = Math.min(page.value.total, (page.value.page + 1) * page.value.size);
  return `${first}–${last} / ${page.value.total}`;
}

onMounted(() => load(0));
</script>

<template>
<div class="kk-settings-page">
<section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">filter_list</span></span>
      <h2 class="kk-card-header__title">{{ t("Filters") }}</h2>
    </div>
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="load(0)">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">search</span>
      {{ t("Apply") }}
    </button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
      <label for="audit-q">{{ t("Search") }}</label>
      <input id="audit-q" v-model="filters.q" type="search" autocomplete="off">
    </div>
      <div class="micl-textfield-outlined kk-filter">
      <label for="audit-actor">{{ t("Actor") }}</label>
      <input id="audit-actor" v-model="filters.actorUserId" type="search" autocomplete="off">
    </div>
      <div class="micl-textfield-outlined kk-filter">
      <label for="audit-outcome">{{ t("Outcome") }}</label>
      <input id="audit-outcome" v-model="filters.outcome" type="search" autocomplete="off">
    </div>
      <div class="micl-textfield-outlined kk-filter">
      <label for="audit-from">{{ t("From") }}</label>
      <input id="audit-from" v-model="filters.from" type="datetime-local">
    </div>
      <div class="micl-textfield-outlined kk-filter">
      <label for="audit-to">{{ t("To") }}</label>
      <input id="audit-to" v-model="filters.to" type="datetime-local">
    </div>
    </div>
  </div>
</section>

  <div class="kk-toolbar kk-action-bar">
    <span class="kk-muted">{{ summary() }}</span>
    <span class="kk-muted kk-toolbar__spacer">{{ t("Page") }} {{ page.page + 1 }} / {{ totalPages() }}</span>
    <button type="button" class="micl-button-tonal-s" :disabled="page.page <= 0" @click="load(page.page - 1)">
      {{ t("Previous") }}
    </button>
    <button
      type="button"
      class="micl-button-tonal-s"
      :disabled="page.page >= totalPages() - 1"
      @click="load(page.page + 1)"
    >
      {{ t("Next") }}
    </button>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">receipt_long</span></span>
      <h2 class="kk-card-header__title">{{ t("Audit Log") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="page.items"
    :row-key="(row: AuditEntry, index?: number) => `${row.occurredAt}-${row.path}-${index}`"
    :loading="loading"
    :empty-text="t('No audit records.')"
    :aria-label="t('Audit log')"
  >
    <template #cell-occurredAt="{ row }"><code class="kk-mono">{{ timestamp(row.occurredAt) }}</code></template>
    <template #cell-actor="{ row }">{{ actor(row) }}</template>
    <template #cell-remoteAddr="{ row }"><code class="kk-mono">{{ row.remoteAddr || "—" }}</code></template>
    <template #cell-method="{ row }"><code class="kk-mono">{{ row.method || "—" }}</code></template>
    <template #cell-path="{ row }"><code class="kk-mono" :title="row.path ?? undefined">{{ row.path || "—" }}</code></template>
    <template #cell-permission="{ row }"><code class="kk-mono" :title="row.permission ?? undefined">{{ row.permission || "—" }}</code></template>
    <template #cell-status="{ row }">{{ row.status ?? "—" }}</template>
    <template #cell-outcome="{ row }">
      <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-badge" :class="row.outcome === 'allow' ? 'kk-badge--ok' : 'kk-badge--bad'">
        {{ t(String(row.outcome || '—')) }}
      </span></span>
    </template>
  </M3DataTable>
</section>
</div>
</template>

