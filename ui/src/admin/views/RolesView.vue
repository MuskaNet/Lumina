<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

interface RoleView {
  roleId: string;
  source?: string | null;
  name?: string | null;
  description?: string | null;
  readOnly?: boolean;
  privileges?: string[];
  roles?: string[];
}

const roles = ref<RoleView[]>([]);
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "roleId", label: "Role ID" },
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "privileges", label: "Privileges" },
  { key: "roles", label: "Nested roles" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return roles.value;
  return roles.value.filter((role) =>
    [role.roleId, role.name, role.description, ...(role.privileges ?? []), ...(role.roles ?? [])]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

async function load() {
  loading.value = true;
  try {
    roles.value = await api.get<RoleView[]>("/internal/security/roles");
  } catch (cause) {
    showToast(`${t("Failed to load roles")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<RoleView | null>(null);
const draft = reactive<Record<string, unknown>>({
  roleId: "",
  name: "",
  description: "",
  privileges: [],
  roles: [],
});

const fields = computed<FieldDef[]>(() => [
  { key: "roleId", label: "Role ID", type: "text", required: true, readOnly: Boolean(editing.value) },
  { key: "name", label: "Name", type: "text" },
  { key: "description", label: "Description", type: "text" },
  {
    key: "privileges",
    label: "Privileges",
    type: "list",
    listSeparator: "newline",
    placeholder: "nx-repository-view-*-*-read",
  },
  { key: "roles", label: "Nested roles", type: "list", listSeparator: "newline" },
]);

function openCreate() {
  editing.value = null;
  Object.assign(draft, { roleId: "", name: "", description: "", privileges: [], roles: [] });
  error.value = "";
  dialog.value?.open();
}

function openEdit(role: RoleView) {
  editing.value = role;
  Object.assign(draft, {
    roleId: role.roleId,
    name: role.name ?? "",
    description: role.description ?? "",
    privileges: role.privileges ?? [],
    roles: role.roles ?? [],
  });
  error.value = "";
  dialog.value?.open();
}

async function save() {
  if (!String(draft.roleId ?? "").trim()) {
    error.value = t("Role ID is required.");
    return;
  }
  busy.value = true;
  error.value = "";
  const payload = {
    roleId: String(draft.roleId).trim(),
    source: editing.value?.source ?? "default",
    name: draft.name || null,
    description: draft.description || null,
    readOnly: editing.value?.readOnly ?? false,
    privileges: draft.privileges ?? [],
    roles: draft.roles ?? [],
  };
  try {
    if (editing.value) {
      await api.send(`/internal/security/roles/${encodeURIComponent(editing.value.roleId)}`, "PUT", payload);
    } else {
      await api.send("/internal/security/roles", "POST", payload);
    }
    showToast(t("Role saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<RoleView | null>(null);

function askDelete(role: RoleView) {
  deleteTarget.value = role;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`/internal/security/roles/${encodeURIComponent(target.roleId)}`);
    showToast(`${t("Role")} ${target.roleId} ${t("deleted.")}`, "ok");
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
      {{ t("Create role") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load">{{ t("Refresh") }}</button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="role-filter">{{ t("Filter") }}</label>
      <input id="role-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">verified_user</span></span>
      <h2 class="kk-card-header__title">{{ t("Roles") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: RoleView) => row.roleId"
    :loading="loading"
    :empty-text="t('No roles found.')"
    :aria-label="t('Roles')"
  >
    <template #cell-roleId="{ row }"><code class="kk-mono">{{ row.roleId }}</code></template>
    <template #cell-description="{ row }">{{ row.description || "—" }}</template>
    <template #cell-privileges="{ row }">
      {{ (row.privileges ?? []).length }} {{ t("privileges") }}
      <small class="kk-secondary">{{ (row.privileges ?? []).join(", ") || "—" }}</small>
    </template>
    <template #cell-roles="{ row }">{{ (row.roles ?? []).join(", ") || "—" }}</template>
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
    :title="editing ? t('Edit role') : t('Create role')"
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
    :title="t('Delete role?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete role") }} <strong class="kk-mono">{{ deleteTarget?.roleId }}</strong>?
    </p>
  </div></M3Dialog>
</div>
</template>
