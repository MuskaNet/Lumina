<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";

interface ApiKeyView {
  id: number;
  displayName?: string | null;
  status?: string | null;
  tokenPrefix?: string | null;
  scopes?: string[];
  createdAt?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

const keys = ref<ApiKeyView[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "displayName", label: "Name" },
  { key: "tokenPrefix", label: "Token" },
  { key: "status", label: "Status" },
  { key: "expiresAt", label: "Expires" },
  { key: "lastUsedAt", label: "Last used" },
  { key: "actions", label: "Actions", align: "end" },
];

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function load() {
  loading.value = true;
  try {
    keys.value = await api.get<ApiKeyView[]>("/internal/security/api-keys/current");
  } catch (cause) {
    showToast(`${t("Failed to load API keys")}: ${(cause as Error).message}`, "error");
    keys.value = [];
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const draft = reactive<Record<string, unknown>>({ displayName: "", scopes: ["nexus:repository-view:*"], expiresAt: "" });
function openCreate() {
  Object.assign(draft, { displayName: "", scopes: ["nexus:repository-view:*"], expiresAt: "" });
  error.value = "";
  dialog.value?.open();
}

const createdToken = ref("");
const tokenDialog = ref<InstanceType<typeof M3Dialog> | null>(null);

async function create() {
  if (!String(draft.displayName ?? "").trim()) {
    error.value = t("Display name is required.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const created = await api.send<{ token?: string }>("/internal/security/api-keys/current", "POST", {
      displayName: String(draft.displayName).trim(),
      scopes: draft.scopes ?? [],
      status: "active",
      expiresAt: draft.expiresAt ? new Date(String(draft.expiresAt)).toISOString() : null,
    });
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

async function reset(key: ApiKeyView) {
  try {
    const result = await api.send<{ token?: string }>(
      `/internal/security/api-keys/current/${encodeURIComponent(String(key.id))}/reset`,
      "POST",
    );
    createdToken.value = result?.token ?? "";
    if (createdToken.value) tokenDialog.value?.open();
    await load();
  } catch (cause) {
    showToast(`${t("Reset failed")}: ${(cause as Error).message}`, "error");
  }
}

async function remove(key: ApiKeyView) {
  try {
    await api.delete(`/internal/security/api-keys/current/${encodeURIComponent(String(key.id))}`);
    showToast(t("API key deleted."), "ok");
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.value);
    showToast(t("Copied to clipboard."), "ok");
  } catch {
    showToast(t("Could not copy to clipboard."), "error");
  }
}

onMounted(load);
</script>

<template>
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-m" @click="openCreate">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">vpn_key</span>
      {{ t("Create token") }}
    </button>
    <button type="button" class="micl-button-outlined-m kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <p class="kk-muted">
    {{ t("Access keys authenticate clients such as Maven, npm or Docker without exposing your password.") }}
  </p>

  <M3DataTable
    :columns="columns"
    :rows="keys"
    :row-key="(row: ApiKeyView) => String(row.id)"
    :loading="loading"
    :empty-text="t('No tokens yet.')"
    :aria-label="t('My tokens')"
  >
    <template #cell-displayName="{ row }">{{ row.displayName || "—" }}</template>
    <template #cell-tokenPrefix="{ row }"><code class="kk-mono">{{ row.tokenPrefix }}…</code></template>
    <template #cell-status="{ row }">
      <span class="kk-badge" :class="row.status === 'active' ? 'kk-badge--ok' : 'kk-badge--warn'">
        {{ row.status || "active" }}
      </span>
    </template>
    <template #cell-expiresAt="{ row }">{{ dateLabel(row.expiresAt) }}</template>
    <template #cell-lastUsedAt="{ row }">{{ dateLabel(row.lastUsedAt) }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="reset(row)">{{ t("Reset") }}</button>
        <button type="button" class="micl-button-text-s" @click="remove(row)">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>

  <M3Dialog ref="dialog" :title="t('Create token')" :busy="busy" :error="error" @confirm="create">
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="token-name">{{ t("Display name") }}</label>
        <input id="token-name" v-model="draft.displayName" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="token-expires">{{ t("Expires at") }}</label>
        <input id="token-expires" v-model="draft.expiresAt" type="datetime-local">
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="token-scopes">{{ t("Scopes") }}</label>
        <textarea
          id="token-scopes"
          rows="3"
          :value="String((draft.scopes as string[]).join('\n'))"
          @input="draft.scopes = ($event.target as HTMLTextAreaElement).value.split('\n').map((item) => item.trim()).filter(Boolean)"
        ></textarea>
      </div>
    </div>
  </M3Dialog>

  <M3Dialog
    ref="tokenDialog"
    :title="t('Copy the new token now')"
    :subtitle="t('The token is shown once and cannot be recovered later.')"
    :confirm-label="t('Copy token')"
    @confirm="copyToken"
  >
    <code class="kk-code">{{ createdToken }}</code>
  </M3Dialog>
</template>

