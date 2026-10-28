<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";

interface DockerConnector {
  repository?: string;
  name?: string;
  type?: string;
  port?: number | null;
  publicUrl?: string | null;
  state?: string | null;
  active?: boolean | null;
  connectorEnabled?: boolean | null;
  connectorPort?: number | null;
  connectorPublicUrl?: string | null;
}

interface DockerConnectors {
  connectors?: DockerConnector[];
  repositories?: DockerConnector[];
  summary?: Record<string, unknown>;
  transfer?: Record<string, unknown>;
  [key: string]: unknown;
}

const payload = ref<DockerConnectors>({});
const status = ref("");
const loading = ref(true);

const connectors = computed<DockerConnector[]>(
  () => payload.value.connectors ?? payload.value.repositories ?? [],
);

const columns: DataTableColumn[] = [
  { key: "repository", label: "Repository" },
  { key: "type", label: "Type" },
  { key: "port", label: "Port", align: "end" },
  { key: "publicUrl", label: "Public URL" },
  { key: "state", label: "State" },
  { key: "active", label: "Active" },
];

const rows = computed(() =>
  connectors.value.map((item) => ({
    ...item,
    repository: item.repository ?? item.name ?? "—",
    port: item.port ?? item.connectorPort ?? null,
    publicUrl: item.publicUrl ?? item.connectorPublicUrl ?? null,
    active: item.active ?? item.connectorEnabled ?? false,
  })),
);

const summaryEntries = computed(() => {
  const summary = payload.value.summary ?? {};
  return Object.entries(summary).map(([key, value]) => ({ key, value: String(value ?? "—") }));
});

const transferEntries = computed(() => {
  const transfer = payload.value.transfer ?? {};
  return Object.entries(transfer).map(([key, value]) => ({ key, value: String(value ?? "—") }));
});

async function load() {
  loading.value = true;
  try {
    payload.value = await api.get<DockerConnectors>("/internal/docker/connectors");
    status.value = "";
  } catch (error) {
    status.value = (error as Error).message;
    payload.value = {};
  } finally {
    loading.value = false;
  }
}

async function refreshConnectors() {
  try {
    await api.send("/internal/docker/connectors/refresh", "POST");
    showToast(t("Docker connectors refreshed."), "ok");
    await load();
  } catch (error) {
    showToast(`${t("Refresh failed")}: ${(error as Error).message}`, "error");
  }
}

async function clearCache() {
  try {
    await api.send("/internal/docker/cache/clear", "POST");
    showToast(t("Docker cache cleared."), "ok");
  } catch (error) {
    showToast(`${t("Clear failed")}: ${(error as Error).message}`, "error");
  }
}

onMounted(load);
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="refreshConnectors">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Refresh connectors") }}
    </button>
    <button type="button" class="micl-button-outlined-s" @click="clearCache">{{ t("Clear Docker cache") }}</button>
    <button type="button" class="micl-button-tonal-s" @click="load">{{ t("Reload") }}</button>
  </div>

  <p v-if="status" class="kk-form-error" role="alert">{{ status }}</p>

  <div class="kk-summary">
    <div v-for="entry in summaryEntries" :key="entry.key" class="kk-summary__item">
      <span class="kk-summary__label">{{ t(entry.key) }}</span>
      <strong class="kk-summary__value">{{ entry.value }}</strong>
    </div>
    <div v-if="!summaryEntries.length" class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Connector runtime") }}</span>
      <strong class="kk-summary__value">{{ rows.length }}</strong>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">deployed_code</span></span>
      <h2 class="kk-card-header__title">{{ t("Docker Registry") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: DockerConnector) => String(row.repository)"
    :loading="loading"
    :empty-text="t('No Docker connectors configured.')"
    :aria-label="t('Docker connectors')"
  >
    <template #cell-state="{ row }">
      <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-badge" :class="row.state === 'running' ? 'kk-badge--ok' : 'kk-badge--warn'">
        {{ t(String(row.state || '—')) }}
      </span></span>
    </template>
    <template #cell-active="{ row }">{{ row.active ? t("Yes") : t("No") }}</template>
  </M3DataTable>
</section>

  <div v-if="transferEntries.length" class="kk-summary">
    <div v-for="entry in transferEntries" :key="entry.key" class="kk-summary__item">
      <span class="kk-summary__label">{{ t(entry.key) }}</span>
      <strong class="kk-summary__value">{{ entry.value }}</strong>
    </div>
  </div>
</div>
</template>
