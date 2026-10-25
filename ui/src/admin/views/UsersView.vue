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

interface UserView {
  id?: number | null;
  source: string;
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  status?: string | null;
  externalId?: string | null;
  external?: boolean;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

const users = ref<UserView[]>([]);
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "userId", label: "User ID" },
  { key: "source", label: "Realm" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "roles", label: "Roles" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return users.value;
  return users.value.filter((user) =>
    [user.userId, user.source, user.firstName, user.lastName, user.email, user.status, ...(user.roles ?? [])]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

async function load() {
  loading.value = true;
  try {
    users.value = await api.get<UserView[]>("/internal/security/users");
  } catch (cause) {
    showToast(`${t("Failed to load users")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<UserView | null>(null);
const draft = reactive<Record<string, unknown>>({
  source: "default",
  userId: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  status: "active",
  roles: [],
  attributes: "",
});

const fields = computed<FieldDef[]>(() => [
  { key: "userId", label: "User ID", type: "text", required: true, readOnly: Boolean(editing.value) },
  { key: "source", label: "Realm", type: "text", readOnly: Boolean(editing.value) },
  { key: "firstName", label: "First name", type: "text" },
  { key: "lastName", label: "Last name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "password", label: editing.value ? "New password" : "Password", type: "password" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" },
    ],
  },
  { key: "roles", label: "Roles", type: "list", listSeparator: "comma", placeholder: "nx-admin, nx-anonymous" },
  { key: "attributes", label: "Attributes (JSON)", type: "textarea", group: "Advanced" },
]);

function openCreate() {
  editing.value = null;
  Object.assign(draft, {
    source: "default",
    userId: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    status: "active",
    roles: [],
    attributes: "",
  });
  error.value = "";
  dialog.value?.open();
}

function openEdit(user: UserView) {
  editing.value = user;
  Object.assign(draft, {
    source: user.source,
    userId: user.userId,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email ?? "",
    password: "",
    status: user.status ?? "active",
    roles: user.roles ?? [],
    attributes: formatJsonObject(user.attributes),
  });
  error.value = "";
  dialog.value?.open();
}

async function save() {
  if (!String(draft.userId ?? "").trim()) {
    error.value = t("User ID is required.");
    return;
  }
  let attributes: Record<string, unknown> | undefined;
  try {
    attributes = parseJsonObject(String(draft.attributes ?? ""));
  } catch (cause) {
    error.value = `${t("Attributes must be a JSON object")}: ${(cause as Error).message}`;
    return;
  }
  const payload = {
    source: String(draft.source || "default"),
    userId: String(draft.userId).trim(),
    firstName: draft.firstName || null,
    lastName: draft.lastName || null,
    email: draft.email || null,
    password: draft.password || null,
    status: draft.status || "active",
    roles: draft.roles ?? [],
    attributes: attributes ?? null,
  };
  busy.value = true;
  error.value = "";
  try {
    if (editing.value) {
      const path = `/internal/security/users/${encodeURIComponent(editing.value.source)}/${encodeURIComponent(editing.value.userId)}`;
      await api.send(path, "PUT", payload);
    } else {
      await api.send("/internal/security/users", "POST", payload);
    }
    showToast(t("User saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<UserView | null>(null);

function askDelete(user: UserView) {
  deleteTarget.value = user;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(
      `/internal/security/users/${encodeURIComponent(target.source)}/${encodeURIComponent(target.userId)}`,
    );
    showToast(`${t("User")} ${target.userId} ${t("deleted.")}`, "ok");
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
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">person_add</span>
      {{ t("Create user") }}
    </button>
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="user-filter">{{ t("Filter") }}</label>
      <input id="user-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    <button type="button" class="micl-button-outlined-s kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: UserView) => `${row.source}/${row.userId}`"
    :loading="loading"
    :empty-text="t('No users found.')"
    :aria-label="t('Users')"
  >
    <template #cell-name="{ row }">{{ [row.firstName, row.lastName].filter(Boolean).join(" ") || "—" }}</template>
    <template #cell-email="{ row }">{{ row.email || "—" }}</template>
    <template #cell-status="{ row }">
      <span class="kk-badge" :class="row.status === 'disabled' ? 'kk-badge--warn' : 'kk-badge--ok'">
        {{ row.status || "active" }}
      </span>
    </template>
    <template #cell-roles="{ row }">{{ (row.roles ?? []).join(", ") || "—" }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" :disabled="row.external" @click="askDelete(row)">
          {{ t("Delete") }}
        </button>
      </div>
    </template>
  </M3DataTable>

  <M3Dialog
    ref="dialog"
    wide
    :title="editing ? t('Edit user') : t('Create user')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <M3SchemaForm :fields="fields" :model="draft" />
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="person_off"
    destructive
    :title="t('Delete user?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <p class="kk-dialog-message">
      {{ t("Are you sure you want to delete user") }} <strong class="kk-mono">{{ deleteTarget?.source }}/{{ deleteTarget?.userId }}</strong>?
    </p>
  </M3Dialog>
</template>
