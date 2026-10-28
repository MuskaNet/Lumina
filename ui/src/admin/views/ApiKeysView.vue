<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { writeClipboard } from "../../shared/clipboard";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

interface ApiKeyView {
  id: number;
  domain?: string | null;
  ownerSource?: string | null;
  ownerUserId?: string | null;
  displayName?: string | null;
  status?: string | null;
  tokenPrefix?: string | null;
  scopes?: string[];
  createdAt?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

const keys = ref<ApiKeyView[]>([]);
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "displayName", label: "Name" },
  { key: "owner", label: "Owner" },
  { key: "domain", label: "Domain" },
  { key: "tokenPrefix", label: "Token" },
  { key: "status", label: "Status" },
  { key: "expiresAt", label: "Expires" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return keys.value;
  return keys.value.filter((key) =>
    [key.displayName, key.ownerUserId, key.ownerSource, key.domain, key.tokenPrefix, key.status]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function load() {
  loading.value = true;
  try {
    keys.value = await api.get<ApiKeyView[]>("/internal/security/api-keys");
  } catch (cause) {
    showToast(`${t("Failed to load API keys")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const draft = reactive<Record<string, unknown>>({
  domain: "nexus",
  ownerSource: "default",
  ownerUserId: "",
  displayName: "",
  status: "active",
  scopes: ["nexus:repository-view:*"],
  expiresAt: "",
});

const fields: FieldDef[] = [
  { key: "displayName", label: "Display name", type: "text", required: true },
  { key: "ownerUserId", label: "Owner user ID", type: "text", required: true },
  { key: "ownerSource", label: "Owner realm", type: "text" },
  { key: "domain", label: "Domain", type: "text" },
  { key: "scopes", label: "Scopes", type: "list", placeholder: "nexus:repository-view:*" },
  { key: "expiresAt", label: "Expires at", type: "datetime-local" },
];

function openCreate() {
  Object.assign(draft, {
    domain: "nexus",
    ownerSource: "default",
    ownerUserId: "",
    displayName: "",
    status: "active",
    scopes: ["nexus:repository-view:*"],
    expiresAt: "",
  });
  error.value = "";
  dialog.value?.open();
}

const createdToken = ref("");
const tokenDialog = ref<InstanceType<typeof M3Dialog> | null>(null);

async function save() {
  if (!String(draft.displayName ?? "").trim() || !String(draft.ownerUserId ?? "").trim()) {
    error.value = t("Display name and owner user ID are required.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const payload = {
      domain: draft.domain || "nexus",
      ownerSource: draft.ownerSource || "default",
      ownerUserId: String(draft.ownerUserId).trim(),
      displayName: String(draft.displayName).trim(),
      status: draft.status || "active",
      scopes: draft.scopes ?? [],
      expiresAt: draft.expiresAt ? new Date(String(draft.expiresAt)).toISOString() : null,
    };
    const created = await api.send<{ apiKey?: ApiKeyView; token?: string }>(
      "/internal/security/api-keys",
      "POST",
      payload,
    );
    dialog.value?.close();
    createdToken.value = created?.token ?? "";
    if (createdToken.value) tokenDialog.value?.open();
    showToast(t("API key created."), "ok");
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<ApiKeyView | null>(null);

function askDelete(key: ApiKeyView) {
  deleteTarget.value = key;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`/internal/security/api-keys/${encodeURIComponent(String(target.id))}`);
    showToast(t("API key deleted."), "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

async function copyToken() {
  try {
    await writeClipboard(createdToken.value);
    showToast(t("Copied to clipboard."), "ok");
  } catch {
    showToast(t("Could not copy to clipboard."), "error");
  }
}

onMounted(load);
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">vpn_key</span>
      {{ t("Create API key") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load">{{ t("Refresh") }}</button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="apikey-filter">{{ t("Filter") }}</label>
      <input id="apikey-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">vpn_key</span></span>
      <h2 class="kk-card-header__title">{{ t("API Keys") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: ApiKeyView) => String(row.id)"
    :loading="loading"
    :empty-text="t('No API keys found.')"
    :aria-label="t('API keys')"
  >
    <template #cell-displayName="{ row }">{{ row.displayName || "—" }}</template>
    <template #cell-owner="{ row }">{{ row.ownerSource ? `${row.ownerSource}/` : "" }}{{ row.ownerUserId }}</template>
    <template #cell-domain="{ row }">{{ row.domain || "—" }}</template>
    <template #cell-tokenPrefix="{ row }"><code class="kk-mono">{{ row.tokenPrefix }}…</code></template>
    <template #cell-status="{ row }">
      <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-badge" :class="row.status === 'active' ? 'kk-badge--ok' : 'kk-badge--warn'">
        {{ t(row.status || 'active') }}
      </span></span>
    </template>
    <template #cell-expiresAt="{ row }">{{ dateLabel(row.expiresAt) }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>
</section>

  <M3Dialog ref="dialog" :title="t('Create API key')" :busy="busy" :error="error" @confirm="save">
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<M3SchemaForm :fields="fields" :model="draft" />
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="tokenDialog"
    :title="t('Copy the new token now')"
    :subtitle="t('The token is shown once and cannot be recovered later.')"
    :confirm-label="t('Copy token')"
    @confirm="copyToken"
  >
    <div class="kk-settings-page"><code class="kk-code">{{ createdToken }}</code>
  </div></M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete API key?')"
    :subtitle="t('Clients using this token lose access immediately.')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete API key") }} <strong class="kk-mono">{{ deleteTarget?.displayName }}</strong>?
    </p>
  </div></M3Dialog>
</div>
</template>
