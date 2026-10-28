<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";

interface RoutingRule {
  name: string;
  mode?: string;
  matchers?: string[];
  description?: string;
}

const API = "/service/rest/v1/routing-rules";
const rules = ref<RoutingRule[]>([]);
const repositories = ref<Record<string, string[]>>({});
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editingName = ref<string | null>(null);
const deleteTarget = ref<RoutingRule | null>(null);
const draft = reactive({ name: "", mode: "BLOCK", matchers: "", description: "" });
const previewPath = ref("");
const previewStatus = ref("");
const previewMatches = ref<string[]>([]);

const columns: DataTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "mode", label: "Mode" },
  { key: "matchers", label: "Matchers", cellClass: "kk-col-location" },
  { key: "description", label: "Description" },
  { key: "usedBy", label: "Used by" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return rules.value.filter((rule) => !needle || [rule.name, rule.mode, rule.description, ...(rule.matchers ?? [])]
    .some((value) => String(value ?? "").toLowerCase().includes(needle)));
});

function usedBy(rule: RoutingRule): string {
  return (repositories.value[rule.name] ?? []).join(", ") || "—";
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rules.value = await api.get<RoutingRule[]>(API);
    const entries = await Promise.all(rules.value.map(async (rule) => [rule.name, await api.get<string[]>(`/internal/routing-rules/${encodeURIComponent(rule.name)}/repositories`)] as const));
    repositories.value = Object.fromEntries(entries);
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingName.value = null;
  Object.assign(draft, { name: "", mode: "BLOCK", matchers: "", description: "" });
  previewPath.value = "";
  previewStatus.value = "";
  previewMatches.value = [];
  dialog.value?.open();
}

function openEdit(rule: RoutingRule) {
  editingName.value = rule.name;
  Object.assign(draft, { name: rule.name, mode: rule.mode ?? "BLOCK", matchers: (rule.matchers ?? []).join("\n"), description: rule.description ?? "" });
  previewPath.value = "";
  previewStatus.value = "";
  previewMatches.value = [];
  dialog.value?.open();
}

async function preview() {
  previewStatus.value = "";
  previewMatches.value = [];
  if (!previewPath.value.trim().startsWith("/")) {
    previewStatus.value = t("Enter a repository-relative path starting with /.");
    return;
  }
  try {
    const result = await api.send<{ allowed: boolean; matchingExpressions: string[] }>(
      "/internal/routing-rules/preview",
      "POST",
      { mode: draft.mode, matchers: draft.matchers.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), path: previewPath.value.trim() },
    );
    previewMatches.value = result?.matchingExpressions ?? [];
    previewStatus.value = result?.allowed ? t("Path allowed.") : t("Path blocked.");
  } catch (cause) {
    previewStatus.value = (cause as Error).message;
  }
}

async function save() {
  const name = draft.name.trim();
  const matchers = draft.matchers.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (!name || !matchers.length) {
    error.value = t("Name and at least one matcher are required.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const payload = { name, mode: draft.mode, matchers, description: draft.description.trim() };
    await api.send(editingName.value ? `${API}/${encodeURIComponent(editingName.value)}` : API, editingName.value ? "PUT" : "POST", payload);
    showToast(t("Routing rule saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

function askDelete(rule: RoutingRule) {
  deleteTarget.value = rule;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  busy.value = true;
  try {
    await api.delete(`${API}/${encodeURIComponent(deleteTarget.value.name)}`);
    showToast(t("Routing rule deleted."), "ok");
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
        <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>{{ t("Create routing rule") }}
      </button>
      <button type="button" class="micl-button-tonal-s" @click="load">
        <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>{{ t("Refresh") }}
      </button>
      <div class="kk-toolbar__filters">
        <div class="micl-textfield-outlined kk-filter">
          <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
          <label for="routing-rule-filter">{{ t("Filter") }}</label>
          <input id="routing-rule-filter" v-model="filter" type="search" autocomplete="off">
        </div>
      </div>
    </div>
    <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>
    <section class="kk-table-surface">
      <div class="kk-card-header"><span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">list_alt</span></span><h2 class="kk-card-header__title">{{ t("Routing Rules") }}</h2></div>
      <M3DataTable :columns="columns" :rows="rows" :row-key="(row: RoutingRule) => row.name" :loading="loading" :empty-text="t('No routing rules found.')" :aria-label="t('Routing rules')">
        <template #cell-name="{ row }"><code class="kk-mono">{{ row.name }}</code></template>
        <template #cell-matchers="{ row }"><code class="kk-mono">{{ (row.matchers ?? []).join(", ") || "—" }}</code></template>
        <template #cell-description="{ row }">{{ row.description || "—" }}</template>
        <template #cell-usedBy="{ row }">{{ usedBy(row) }}</template>
        <template #cell-actions="{ row }"><div class="micl-buttongroup kk-row-actions" role="group" :aria-label="t('Actions')"><button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button><button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button></div></template>
      </M3DataTable>
    </section>
    <M3Dialog ref="dialog" :title="editingName ? t('Edit routing rule') : t('Create routing rule')" :subtitle="t('Routing rules control which requests a repository accepts.')" :busy="busy" :error="error" @confirm="save">
      <div class="kk-field-grid">
        <div class="micl-textfield-outlined"><label for="routing-rule-name">{{ t("Name") }}</label><input id="routing-rule-name" v-model="draft.name" type="text" :readonly="Boolean(editingName)" autocomplete="off"></div>
        <div class="micl-textfield-outlined"><label for="routing-rule-mode">{{ t("Mode") }}</label><select id="routing-rule-mode" v-model="draft.mode"><option value="BLOCK">{{ t("Block matching paths") }}</option><option value="ALLOW">{{ t("Allow matching paths") }}</option></select></div>
        <div class="micl-textfield-outlined kk-field--wide"><label for="routing-rule-matchers">{{ t("Matchers") }}</label><textarea id="routing-rule-matchers" v-model="draft.matchers" rows="6" class="kk-mono"></textarea></div>
        <div class="micl-textfield-outlined kk-field--wide"><label for="routing-rule-description">{{ t("Description") }}</label><input id="routing-rule-description" v-model="draft.description" type="text" autocomplete="off"></div>
        <div class="micl-textfield-outlined kk-field--wide"><label for="routing-rule-test-path">{{ t("Test a path") }}</label><input id="routing-rule-test-path" v-model="previewPath" type="text" placeholder="/com/company/app/1.0/app-1.0.jar" spellcheck="false"></div>
      </div>
      <div class="kk-toolbar kk-action-bar">
        <button type="button" class="micl-button-outlined-s" @click="preview"><span class="micl-button__icon material-symbols-outlined" aria-hidden="true">search</span>{{ t("Test path") }}</button>
        <span class="kk-muted" role="status" aria-live="polite">{{ previewStatus }}</span>
      </div>
      <ul v-if="previewMatches.length" class="kk-list"><li v-for="match in previewMatches" :key="match"><code class="kk-mono">{{ match }}</code></li></ul>
    </M3Dialog>
    <M3Dialog ref="deleteDialog" icon="delete" destructive :title="t('Delete routing rule?')" :confirm-label="t('Delete')" :busy="busy" @confirm="confirmDelete"><p class="kk-dialog-message">{{ t("Repositories using this rule must be updated before deletion.") }}</p></M3Dialog>
  </div>
</template>
