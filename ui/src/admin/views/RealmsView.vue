<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { parseJsonObject, formatJsonObject } from "../../shared/json";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

interface RealmView {
  id?: number | null;
  realmId: string;
  type?: string | null;
  name?: string | null;
  enabled?: boolean;
  priority?: number;
  attributes?: Record<string, unknown>;
}

const realms = ref<RealmView[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "realmId", label: "Realm ID" },
  { key: "type", label: "Type" },
  { key: "name", label: "Name" },
  { key: "enabled", label: "Enabled" },
  { key: "priority", label: "Priority", align: "end" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => [...realms.value].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));

async function load() {
  loading.value = true;
  try {
    realms.value = await api.get<RealmView[]>("/internal/security/realms");
  } catch (cause) {
    showToast(`${t("Failed to load realms")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<RealmView | null>(null);
const draft = reactive<Record<string, unknown>>({
  realmId: "",
  type: "custom",
  name: "",
  enabled: true,
  priority: 0,
  attributes: "",
});

const fields = computed<FieldDef[]>(() => [
  { key: "realmId", label: "Realm ID", type: "text", required: true, readOnly: Boolean(editing.value) },
  { key: "type", label: "Type", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "enabled", label: "Enabled", type: "switch" },
  { key: "priority", label: "Priority", type: "number" },
  { key: "attributes", label: "Attributes (JSON)", type: "textarea", group: "Advanced" },
]);

function openCreate() {
  editing.value = null;
  Object.assign(draft, { realmId: "", type: "custom", name: "", enabled: true, priority: 0, attributes: "" });
  error.value = "";
  dialog.value?.open();
}

function openEdit(realm: RealmView) {
  editing.value = realm;
  Object.assign(draft, {
    realmId: realm.realmId,
    type: realm.type ?? "custom",
    name: realm.name ?? "",
    enabled: realm.enabled ?? true,
    priority: realm.priority ?? 0,
    attributes: formatJsonObject(realm.attributes),
  });
  error.value = "";
  dialog.value?.open();
}

async function save() {
  if (!String(draft.realmId ?? "").trim()) {
    error.value = t("Realm ID is required.");
    return;
  }
  let attributes: Record<string, unknown> | undefined;
  try {
    attributes = parseJsonObject(String(draft.attributes ?? ""));
  } catch (cause) {
    error.value = `${t("Attributes must be a JSON object")}: ${(cause as Error).message}`;
    return;
  }
  busy.value = true;
  error.value = "";
  const payload = {
    realmId: String(draft.realmId).trim(),
    type: draft.type || null,
    name: draft.name || null,
    enabled: Boolean(draft.enabled),
    priority: Number(draft.priority ?? 0),
    attributes: attributes ?? null,
  };
  try {
    if (editing.value) {
      await api.send(`/internal/security/realms/${encodeURIComponent(editing.value.realmId)}`, "PUT", payload);
    } else {
      await api.send("/internal/security/realms", "POST", payload);
    }
    showToast(t("Realm saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<RealmView | null>(null);

function askDelete(realm: RealmView) {
  deleteTarget.value = realm;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`/internal/security/realms/${encodeURIComponent(target.realmId)}`);
    showToast(`${t("Realm")} ${target.realmId} ${t("deleted.")}`, "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-s" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create realm") }}
    </button>
    <button type="button" class="micl-button-outlined-s kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: RealmView) => row.realmId"
    :loading="loading"
    :empty-text="t('No realms found.')"
    :aria-label="t('Realms')"
  >
    <template #cell-realmId="{ row }"><code class="kk-mono">{{ row.realmId }}</code></template>
    <template #cell-enabled="{ row }">
      <span class="kk-badge" :class="row.enabled ? 'kk-badge--ok' : 'kk-badge--warn'">
        {{ row.enabled ? t("Enabled") : t("Disabled") }}
      </span>
    </template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>

  <M3Dialog
    ref="dialog"
    :title="editing ? t('Edit realm') : t('Create realm')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <M3SchemaForm :fields="fields" :model="draft" />
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete realm?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <p class="kk-dialog-message">
      {{ t("Are you sure you want to delete realm") }} <strong class="kk-mono">{{ deleteTarget?.realmId }}</strong>?
    </p>
  </M3Dialog>
</template>
