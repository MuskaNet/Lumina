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

interface PrivilegeView {
  privilegeId: string;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  readOnly?: boolean;
  properties?: Record<string, unknown>;
  permission?: string | null;
}

const privileges = ref<PrivilegeView[]>([]);
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "privilegeId", label: "Privilege ID" },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "description", label: "Description" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return privileges.value;
  return privileges.value.filter((item) =>
    [item.privilegeId, item.name, item.type, item.description]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

async function load() {
  loading.value = true;
  try {
    privileges.value = await api.get<PrivilegeView[]>("/internal/security/privileges");
  } catch (cause) {
    showToast(`${t("Failed to load privileges")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<PrivilegeView | null>(null);
const draft = reactive<Record<string, unknown>>({
  privilegeId: "",
  name: "",
  description: "",
  type: "repository-view",
  properties: "",
});

const fields = computed<FieldDef[]>(() => [
  { key: "privilegeId", label: "Privilege ID", type: "text", required: true, readOnly: Boolean(editing.value) },
  { key: "name", label: "Name", type: "text" },
  { key: "type", label: "Type", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "properties", label: "Properties (JSON)", type: "textarea", group: "Properties" },
]);

function openCreate() {
  editing.value = null;
  Object.assign(draft, {
    privilegeId: "",
    name: "",
    description: "",
    type: "repository-view",
    properties: "{\n  \"format\": \"*\",\n  \"repository\": \"*\",\n  \"actions\": [\"read\"]\n}",
  });
  error.value = "";
  dialog.value?.open();
}

function openEdit(privilege: PrivilegeView) {
  editing.value = privilege;
  Object.assign(draft, {
    privilegeId: privilege.privilegeId,
    name: privilege.name ?? "",
    description: privilege.description ?? "",
    type: privilege.type ?? "",
    properties: formatJsonObject(privilege.properties),
  });
  error.value = "";
  dialog.value?.open();
}

async function save() {
  if (!String(draft.privilegeId ?? "").trim()) {
    error.value = t("Privilege ID is required.");
    return;
  }
  let properties: Record<string, unknown> | undefined;
  try {
    properties = parseJsonObject(String(draft.properties ?? ""));
  } catch (cause) {
    error.value = `${t("Properties must be a JSON object")}: ${(cause as Error).message}`;
    return;
  }
  busy.value = true;
  error.value = "";
  const payload = {
    privilegeId: String(draft.privilegeId).trim(),
    name: draft.name || null,
    description: draft.description || null,
    type: draft.type || null,
    readOnly: editing.value?.readOnly ?? false,
    properties: properties ?? null,
  };
  try {
    if (editing.value) {
      await api.send(`/internal/security/privileges/${encodeURIComponent(editing.value.privilegeId)}`, "PUT", payload);
    } else {
      await api.send("/internal/security/privileges", "POST", payload);
    }
    showToast(t("Privilege saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<PrivilegeView | null>(null);

function askDelete(privilege: PrivilegeView) {
  deleteTarget.value = privilege;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`/internal/security/privileges/${encodeURIComponent(target.privilegeId)}`);
    showToast(`${t("Privilege")} ${target.privilegeId} ${t("deleted.")}`, "ok");
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
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create privilege") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load">{{ t("Refresh") }}</button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="privilege-filter">{{ t("Filter") }}</label>
      <input id="privilege-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">key</span></span>
      <h2 class="kk-card-header__title">{{ t("Privileges") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: PrivilegeView) => row.privilegeId"
    :loading="loading"
    :empty-text="t('No privileges found.')"
    :aria-label="t('Privileges')"
  >
    <template #cell-privilegeId="{ row }"><code class="kk-mono">{{ row.privilegeId }}</code></template>
    <template #cell-description="{ row }">{{ row.description || "—" }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" :disabled="row.readOnly" @click="askDelete(row)">
          {{ t("Delete") }}
        </button>
      </div>
    </template>
  </M3DataTable>
</section>

  <M3Dialog
    ref="dialog"
    wide
    :title="editing ? t('Edit privilege') : t('Create privilege')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<M3SchemaForm :fields="fields" :model="draft" />
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete privilege?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete privilege") }} <strong class="kk-mono">{{ deleteTarget?.privilegeId }}</strong>?
    </p>
  </div></M3Dialog>
</div>
</template>
