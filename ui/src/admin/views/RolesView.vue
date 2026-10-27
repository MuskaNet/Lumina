<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";
import {
  addMemberNames,
  availableMembers,
  moveMember,
  removeMemberNames,
  toggleMemberHighlight,
} from "../repositoryMembers";

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
const privileges = ref<{ privilegeId: string }[]>([]);
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
    privileges.value = await api.get<{ privilegeId: string }[]>("/internal/security/privileges");
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
const privilegeFilter = ref("");
const roleFilter = ref("");
const highlightedPrivileges = ref<string[]>([]);
const highlightedRoles = ref<string[]>([]);

const availablePrivilegeNames = computed(() => {
  const selected = Array.isArray(draft.privileges) ? draft.privileges as string[] : [];
  return availableMembers(
    privileges.value.map((item) => ({ name: item.privilegeId })),
    selected,
    privilegeFilter.value,
  ).map((item) => item.name);
});
const availableRoleNames = computed(() => {
  const selected = Array.isArray(draft.roles) ? draft.roles as string[] : [];
  return availableMembers(
    roles.value.map((item) => ({ name: item.roleId })),
    selected,
    roleFilter.value,
  ).filter((item) => item.name !== draft.roleId).map((item) => item.name);
});

function selectedNames(key: "privileges" | "roles"): string[] {
  return Array.isArray(draft[key]) ? draft[key] as string[] : [];
}

function setSelected(key: "privileges" | "roles", values: string[]): void {
  draft[key] = values;
}

function toggleHighlight(key: "privileges" | "roles", name: string, event: MouseEvent): void {
  const target = key === "privileges" ? highlightedPrivileges : highlightedRoles;
  target.value = toggleMemberHighlight(target.value, name, event.ctrlKey || event.metaKey);
}

function addHighlighted(key: "privileges" | "roles"): void {
  const target = key === "privileges" ? highlightedPrivileges : highlightedRoles;
  setSelected(key, addMemberNames(selectedNames(key), target.value));
  target.value = [];
}

function removeHighlighted(key: "privileges" | "roles"): void {
  const target = key === "privileges" ? highlightedPrivileges : highlightedRoles;
  setSelected(key, removeMemberNames(selectedNames(key), target.value));
  target.value = [];
}

function reorderRole(offset: number): void {
  if (highlightedRoles.value.length !== 1) return;
  setSelected("roles", moveMember(selectedNames("roles"), highlightedRoles.value[0], offset));
}

function resetHighlights(): void {
  highlightedPrivileges.value = [];
  highlightedRoles.value = [];
}
const fields = computed<FieldDef[]>(() => [
  { key: "roleId", label: "Role ID", type: "text", required: true, readOnly: Boolean(editing.value) },
  { key: "name", label: "Name", type: "text" },
  { key: "description", label: "Description", type: "text" },
]);

const basicFields = computed<FieldDef[]>(() => fields.value);

function openCreate() {
  editing.value = null;
  Object.assign(draft, { roleId: "", name: "", description: "", privileges: [], roles: [] });
  resetHighlights();
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
  resetHighlights();
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
<M3SchemaForm :fields="basicFields" :model="draft" />
      <div class="kk-field-grid">
        <div class="kk-member-transfer kk-field--wide">
          <div class="kk-member-pane">
            <div class="kk-member-pane__head"><span>{{ t("Available privileges") }}</span><span class="kk-member-count">{{ availablePrivilegeNames.length }}</span></div>
            <div class="micl-textfield-outlined kk-member-filter"><label for="role-privilege-filter">{{ t("Filter") }}</label><input id="role-privilege-filter" v-model="privilegeFilter" type="search"></div>
            <ul class="kk-member-list" role="listbox" aria-multiselectable="true">
              <li v-for="name in availablePrivilegeNames" :key="name" class="kk-member-option" :class="{ 'is-selected': highlightedPrivileges.includes(name) }" role="option" :aria-selected="highlightedPrivileges.includes(name)" @click="toggleHighlight('privileges', name, $event)">{{ name }}</li>
              <li v-if="!availablePrivilegeNames.length" class="kk-member-hint">{{ t("No matching privileges") }}</li>
            </ul>
          </div>
          <div class="kk-member-actions">
            <button type="button" class="micl-button-text-s" :disabled="!highlightedPrivileges.length" @click="addHighlighted('privileges')">›</button>
            <button type="button" class="micl-button-text-s" :disabled="!highlightedPrivileges.length" @click="removeHighlighted('privileges')">‹</button>
          </div>
          <div class="kk-member-pane">
            <div class="kk-member-pane__head"><span>{{ t("Selected privileges") }}</span><span class="kk-member-count">{{ selectedNames("privileges").length }}</span></div>
            <ul class="kk-member-list" role="listbox" aria-multiselectable="true">
              <li v-for="name in selectedNames('privileges')" :key="name" class="kk-member-option" :class="{ 'is-selected': highlightedPrivileges.includes(name) }" role="option" :aria-selected="highlightedPrivileges.includes(name)" @click="toggleHighlight('privileges', name, $event)">{{ name }}</li>
              <li v-if="!selectedNames('privileges').length" class="kk-member-hint">{{ t("No privileges selected") }}</li>
            </ul>
          </div>
        </div>

        <div class="kk-member-transfer kk-field--wide">
          <div class="kk-member-pane">
            <div class="kk-member-pane__head"><span>{{ t("Available roles") }}</span><span class="kk-member-count">{{ availableRoleNames.length }}</span></div>
            <div class="micl-textfield-outlined kk-member-filter"><label for="role-nested-filter">{{ t("Filter") }}</label><input id="role-nested-filter" v-model="roleFilter" type="search"></div>
            <ul class="kk-member-list" role="listbox" aria-multiselectable="true">
              <li v-for="name in availableRoleNames" :key="name" class="kk-member-option" :class="{ 'is-selected': highlightedRoles.includes(name) }" role="option" :aria-selected="highlightedRoles.includes(name)" @click="toggleHighlight('roles', name, $event)">{{ name }}</li>
              <li v-if="!availableRoleNames.length" class="kk-member-hint">{{ t("No matching roles") }}</li>
            </ul>
          </div>
          <div class="kk-member-actions">
            <button type="button" class="micl-button-text-s" :disabled="!highlightedRoles.length" @click="addHighlighted('roles')">›</button>
            <button type="button" class="micl-button-text-s" :disabled="!highlightedRoles.length" @click="removeHighlighted('roles')">‹</button>
            <button type="button" class="micl-button-text-s" :disabled="highlightedRoles.length !== 1" @click="reorderRole(-1)">↑</button>
            <button type="button" class="micl-button-text-s" :disabled="highlightedRoles.length !== 1" @click="reorderRole(1)">↓</button>
          </div>
          <div class="kk-member-pane">
            <div class="kk-member-pane__head"><span>{{ t("Selected roles") }}</span><span class="kk-member-count">{{ selectedNames("roles").length }}</span></div>
            <ul class="kk-member-list" role="listbox" aria-multiselectable="true">
              <li v-for="name in selectedNames('roles')" :key="name" class="kk-member-option" :class="{ 'is-selected': highlightedRoles.includes(name) }" role="option" :aria-selected="highlightedRoles.includes(name)" @click="toggleHighlight('roles', name, $event)">{{ name }}</li>
              <li v-if="!selectedNames('roles').length" class="kk-member-hint">{{ t("No nested roles") }}</li>
            </ul>
          </div>
        </div>
      </div>
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
