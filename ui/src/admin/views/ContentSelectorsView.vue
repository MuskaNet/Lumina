<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";

interface Selector {
  name: string;
  type: string;
  description?: string;
  expression?: string;
}

interface RepositoryOption {
  name: string;
  format: string;
  type: string;
}

interface Options {
  permissions: Record<string, boolean>;
  repositories: RepositoryOption[];
  usedBy: Record<string, string[]>;
}

interface PreviewAsset {
  repositoryName: string;
  format: string;
  name: string;
}

const API = "/service/rest/v1/security/content-selectors";

const selectors = ref<Selector[]>([]);
const options = ref<Options>({ permissions: {}, repositories: [], usedBy: {} });
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "expression", label: "Expression", cellClass: "kk-col-location" },
  { key: "description", label: "Description" },
  { key: "usedBy", label: "Used by" },
  { key: "actions", label: "Actions", align: "end" },
];

const editable = computed(() => Boolean(options.value.permissions.create || options.value.permissions.update));

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return selectors.value;
  return selectors.value.filter((item) =>
    [item.name, item.type, item.expression, item.description]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

function usedBy(selector: Selector): string {
  return (options.value.usedBy[selector.name] ?? []).join(", ") || "—";
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const nextOptions = await api.get<Options>("/internal/security/content-selectors/options");
    options.value = nextOptions;
    selectors.value = nextOptions.permissions.read
      ? await api.get<Selector[]>(API)
      : [];
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

/* ---- Selector form ----------------------------------------------------- */

const selectorDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editingName = ref<string | null>(null);
const draft = reactive({ name: "", type: "csel", description: "", expression: "", repository: "*" });
const previewRows = ref<PreviewAsset[]>([]);
const previewStatus = ref("");

const scopeOptions = computed(() => {
  const formats = [...new Set(options.value.repositories.map((item) => item.format))].sort();
  return [
    { value: "*", label: t("All repositories") },
    ...formats.map((format) => ({ value: `*-${format}`, label: `${t("All")} ${format} ${t("repositories")}` })),
    ...options.value.repositories
      .filter((item) => item.type !== "group")
      .map((item) => ({ value: item.name, label: `${item.name} (${item.format}, ${item.type})` })),
  ];
});

function openCreate() {
  editingName.value = null;
  Object.assign(draft, {
    name: "",
    type: "csel",
    description: "",
    expression: 'format == "raw" and path =^ "/team/"',
    repository: "*",
  });
  previewRows.value = [];
  previewStatus.value = "";
  error.value = "";
  selectorDialog.value?.open();
}

function openEdit(selector: Selector) {
  editingName.value = selector.name;
  Object.assign(draft, {
    name: selector.name,
    type: selector.type || "csel",
    description: selector.description ?? "",
    expression: selector.expression ?? "",
    repository: "*",
  });
  previewRows.value = [];
  previewStatus.value = "";
  error.value = "";
  selectorDialog.value?.open();
}

async function preview() {
  previewStatus.value = t("Loading preview…");
  try {
    const result = await api.send<{ results: PreviewAsset[]; truncated?: boolean }>(
      "/service/rest/internal/ui/content-selectors/preview",
      "POST",
      { repository: draft.repository, type: draft.type, expression: draft.expression },
    );
    previewRows.value = result?.results ?? [];
    previewStatus.value = result?.truncated
      ? t("Preview is limited. Narrow the expression or repository.")
      : previewRows.value.length
        ? t("Preview complete.")
        : t("No matching stored assets.");
  } catch (cause) {
    previewRows.value = [];
    previewStatus.value = (cause as Error).message;
  }
}

async function save() {
  if (!draft.name.trim() || !draft.expression.trim()) {
    error.value = t("Name and expression are required.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const path = editingName.value ? `${API}/${encodeURIComponent(editingName.value)}` : API;
    await api.send(path, editingName.value ? "PUT" : "POST", {
      name: draft.name.trim(),
      type: draft.type,
      description: draft.description,
      expression: draft.expression,
    });
    showToast(t("Content selector saved."), "ok");
    selectorDialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<Selector | null>(null);

function askDelete(selector: Selector) {
  deleteTarget.value = selector;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`${API}/${encodeURIComponent(target.name)}`);
    showToast(`${t("Content selector")} ${target.name} ${t("deleted.")}`, "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

/* ---- Privilege from selector ------------------------------------------- */

const privilegeDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const privilege = reactive({
  name: "",
  description: "",
  selector: "",
  scope: "*",
  actions: ["read"] as string[],
});
const ACTION_OPTIONS = ["read", "create", "update", "delete"];

function openPrivilege(selector: Selector) {
  Object.assign(privilege, {
    name: `${selector.name}-read`,
    description: "",
    selector: selector.name,
    scope: "*",
    actions: ["read"],
  });
  error.value = "";
  privilegeDialog.value?.open();
}

function toggleAction(action: string) {
  const index = privilege.actions.indexOf(action);
  if (index >= 0) privilege.actions.splice(index, 1);
  else privilege.actions.push(action);
}

async function savePrivilege() {
  if (!privilege.actions.length) {
    error.value = t("Select at least one action.");
    return;
  }
  let format = "*";
  let repository = privilege.scope;
  if (privilege.scope.startsWith("*-")) {
    format = privilege.scope.slice(2);
    repository = "*";
  } else if (privilege.scope !== "*") {
    const match = options.value.repositories.find((item) => item.name === privilege.scope);
    if (!match) {
      error.value = t("Repository no longer exists. Refresh and try again.");
      return;
    }
    format = match.format;
  }
  busy.value = true;
  try {
    await api.send("/service/rest/v1/security/privileges/repository-content-selector", "POST", {
      name: privilege.name,
      description: privilege.description,
      contentSelector: privilege.selector,
      format,
      repository,
      actions: privilege.actions,
    });
    showToast(t("Privilege created."), "ok");
    privilegeDialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" :disabled="!options.permissions.create" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create selector") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Refresh") }}
    </button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="selector-filter">{{ t("Filter") }}</label>
      <input id="selector-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    </div>
  </div>

  <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">filter_list</span></span>
      <h2 class="kk-card-header__title">{{ t("Content selectors") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: Selector) => row.name"
    :loading="loading"
    :empty-text="t('No content selectors found.')"
    :aria-label="t('Content selectors')"
  >
    <template #cell-name="{ row }"><code class="kk-mono">{{ row.name }}</code></template>
    <template #cell-expression="{ row }"><code class="kk-mono">{{ row.expression }}</code></template>
    <template #cell-description="{ row }">{{ row.description || "—" }}</template>
    <template #cell-usedBy="{ row }">{{ usedBy(row) }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">
          {{ options.permissions.update ? t("Edit") : t("View") }}
        </button>
        <button
          type="button"
          class="micl-button-text-s"
          :disabled="!options.permissions.createPrivilege"
          @click="openPrivilege(row)"
        >
          {{ t("Create privilege") }}
        </button>
        <button
          type="button"
          class="micl-button-text-s"
          :disabled="!options.permissions.delete"
          @click="askDelete(row)"
        >
          {{ t("Delete") }}
        </button>
      </div>
    </template>
  </M3DataTable>
</section>

  <M3Dialog
    ref="selectorDialog"
    wide
    :title="editingName ? t('Edit selector') : t('Create selector')"
    :subtitle="t('A selector matches stored assets by expression; privileges grant access to matches.')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="selector-name">{{ t("Name") }}</label>
        <input id="selector-name" v-model="draft.name" type="text" :readonly="Boolean(editingName)" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="selector-type">{{ t("Type") }}</label>
        <select id="selector-type" v-model="draft.type">
          <option value="csel">csel</option>
        </select>
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="selector-description">{{ t("Description") }}</label>
        <input id="selector-description" v-model="draft.description" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="selector-expression">{{ t("Expression") }}</label>
        <input id="selector-expression" v-model="draft.expression" type="text" class="kk-mono" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="selector-repository">{{ t("Preview scope") }}</label>
        <select id="selector-repository" v-model="draft.repository">
          <option v-for="option in scopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
    </div>
</section>

    <div class="kk-toolbar kk-action-bar">
      <button type="button" class="micl-button-outlined-s" :disabled="!editable" @click="preview">
        <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">search</span>
        {{ t("Preview") }}
      </button>
      <span class="kk-muted">{{ previewStatus }}</span>
    </div>

    <section v-if="previewRows.length" class="kk-table-surface">
<M3DataTable

      :columns="[
        { key: 'repositoryName', label: 'Repository' },
        { key: 'format', label: 'Format' },
        { key: 'name', label: 'Asset' },
      ]"
      :rows="previewRows"
      :row-key="(row: PreviewAsset) => `${row.repositoryName}/${row.name}`"
      :aria-label="t('Preview matches')"
    />
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="privilegeDialog"
    :title="t('Create content selector privilege')"
    :subtitle="t('Grants the selected actions on matching assets.')"
    :busy="busy"
    :error="error"
    @confirm="savePrivilege"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="priv-name">{{ t("Name") }}</label>
        <input id="priv-name" v-model="privilege.name" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="priv-selector">{{ t("Content selector") }}</label>
        <input id="priv-selector" v-model="privilege.selector" type="text" readonly>
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="priv-description">{{ t("Description") }}</label>
        <input id="priv-description" v-model="privilege.description" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="priv-scope">{{ t("Repository") }}</label>
        <select id="priv-scope" v-model="privilege.scope">
          <option v-for="option in scopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
    </div>
</section>
    <!-- A privilege grants any number of actions at once: a multi-select set, so checkboxes rather than switches. -->
    <div class="kk-actions-row">
      <label v-for="action in ACTION_OPTIONS" :key="action" class="kk-checkbox-row">
        <input
          class="micl-checkbox"
          type="checkbox"
          :checked="privilege.actions.includes(action)"
          @change="toggleAction(action)"
        >
        <span>{{ t(action) }}</span>
      </label>
    </div>
  </div></M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete content selector?')"
    :subtitle="t('Selectors referenced by privileges cannot be deleted.')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete content selector") }} <strong class="kk-mono">{{ deleteTarget?.name }}</strong>?
    </p>
  </div></M3Dialog>
</div>
</template>
