<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3Tabs from "../../shared/components/M3Tabs.vue";

type ScanTab = "overview" | "tasks" | "findings" | "repositories" | "policies" | "waivers";

interface CursorPage<T> {
  items?: T[];
  nextAfter?: number | null;
}

interface ScannerSnapshot {
  engineName?: string | null;
  engineVersion?: string | null;
  vulnerabilityDatabaseRevision?: string | null;
  ready?: boolean;
  observedAt?: string | null;
}

interface ScanSummary {
  candidateBacklog?: number;
  pendingTasks?: number;
  runningTasks?: number;
  failedTasks?: number;
  partialAssets?: number;
  staleAssets?: number;
  criticalFindings?: number;
  highFindings?: number;
}

interface Overview {
  deploymentEnabled?: boolean;
  scanner?: ScannerSnapshot | null;
  summary?: ScanSummary | null;
  visibleRepositories?: number;
}

interface ScanTask {
  id: number;
  repository?: string | null;
  assetPath?: string | null;
  stage?: string | null;
  status?: string | null;
  attempts?: number;
  maxAttempts?: number;
}

interface ScanRepository {
  id: number;
  name: string;
  format?: string | null;
  type?: string | null;
  policyName?: string | null;
  policyEnabled?: boolean;
}

interface ScanPolicy {
  id: number;
  name: string;
  enabled: boolean;
  blockSeverity?: string | null;
  onlyFixable?: boolean;
  blockUnknownSeverity?: boolean;
  requireCompleteInventory?: boolean;
  maxResultAgeSeconds?: number | null;
  requiredPlatforms?: string[] | null;
  revision?: number;
}

type Row = Record<string, unknown>;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "findings", label: "Findings" },
  { id: "repositories", label: "Repositories" },
  { id: "policies", label: "Policies" },
  { id: "waivers", label: "Waivers" },
];

const SEVERITIES = ["UNKNOWN", "NEGLIGIBLE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const ENFORCEMENT_MODES = ["AUDIT", "ENFORCE"];
const POLICY_ACTIONS = ["ALLOW", "BLOCK"];

const tab = ref<ScanTab>("overview");
const overview = ref<Overview | null>(null);
const items = ref<Row[]>([]);
const repositories = ref<ScanRepository[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const search = ref("");
/**
 * The findings list defaults to scan results that still apply to the current
 * artifact content. The server keeps historical results available, so the
 * console asks for the current view explicitly and retains the user's choice.
 */
const currentOnly = ref(true);
const page = ref(0);
const nextAfter = ref<number | null>(null);
const pageHistory = ref<number[]>([0]);
/** Monotonic token so a superseded response cannot replace newer rows. */
let requestVersion = 0;

function timestamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function badgeTone(value?: string | null): string {
  const normal = String(value ?? "").toUpperCase();
  if (["COMPLETED", "SUCCEEDED", "HIGH", "CRITICAL", "BLOCK"].includes(normal)) return "kk-badge--bad";
  if (["RUNNING", "PENDING", "QUEUED", "MEDIUM"].includes(normal)) return "kk-badge--warn";
  if (["LOW", "NEGLIGIBLE", "ALLOW"].includes(normal)) return "kk-badge--ok";
  return "kk-badge--checking";
}

async function load(reset = false) {
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  if (reset) {
    page.value = 0;
    pageHistory.value = [0];
    nextAfter.value = null;
  }
  try {
    if (tab.value === "overview") {
      const data = await api.get<Overview>("/internal/security/scanning/summary");
      if (version !== requestVersion) return;
      overview.value = data;
      items.value = [];
      return;
    }
    const after = pageHistory.value[page.value] ?? 0;
    const params = new URLSearchParams({ after: String(after), limit: "25" });
    if (search.value.trim()) params.set("q", search.value.trim());
    if (tab.value === "findings") params.set("currentOnly", String(currentOnly.value));
    const payload = await api.get<CursorPage<Row>>(
      `/internal/security/scanning/${tab.value}?${params.toString()}`,
    );
    if (version !== requestVersion) return;
    items.value = payload.items ?? [];
    nextAfter.value = payload.nextAfter ?? null;
    overview.value = null;
    if (tab.value === "repositories") {
      repositories.value = items.value as unknown as ScanRepository[];
    }
  } catch (cause) {
    if (version !== requestVersion) return;
    error.value = (cause as Error).message;
    items.value = [];
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

function setCurrentOnly(checked: boolean) {
  if (currentOnly.value === checked) return;
  currentOnly.value = checked;
  if (tab.value === "findings") void load(true);
}

function onCurrentOnlyChange(event: Event) {
  setCurrentOnly((event.target as HTMLInputElement).checked);
}

function nextPage() {
  if (nextAfter.value == null) return;
  page.value += 1;
  pageHistory.value = [...pageHistory.value.slice(0, page.value), nextAfter.value];
  void load();
}

function previousPage() {
  if (page.value === 0) return;
  page.value -= 1;
  void load();
}

const overviewEntries = computed(() => {
  const data = overview.value;
  if (!data) return [];
  const summary = data.summary ?? {};
  return [
    { label: t("Scanning"), value: data.deploymentEnabled ? t("Enabled") : t("Disabled") },
    {
      label: t("Scanner"),
      value: data.scanner?.engineName
        ? `${data.scanner.engineName} ${data.scanner.engineVersion ?? ""}`.trim()
        : "—",
    },
    { label: t("Database"), value: data.scanner?.vulnerabilityDatabaseRevision ?? "—" },
    { label: t("Ready"), value: data.scanner?.ready ? t("Yes") : t("No") },
    { label: t("Repositories"), value: String(data.visibleRepositories ?? 0) },
    { label: t("Candidate backlog"), value: String(summary.candidateBacklog ?? 0) },
    { label: t("Pending tasks"), value: String(summary.pendingTasks ?? 0) },
    { label: t("Running tasks"), value: String(summary.runningTasks ?? 0) },
    { label: t("Failed tasks"), value: String(summary.failedTasks ?? 0) },
    { label: t("Partial assets"), value: String(summary.partialAssets ?? 0) },
    { label: t("Stale assets"), value: String(summary.staleAssets ?? 0) },
    { label: t("Critical findings"), value: String(summary.criticalFindings ?? 0) },
    { label: t("High findings"), value: String(summary.highFindings ?? 0) },
    { label: t("Observed"), value: timestamp(data.scanner?.observedAt) },
  ];
});

const columns = computed<DataTableColumn[]>(() => {
  switch (tab.value) {
    case "tasks":
      return [
        { key: "id", label: "Task", align: "end" },
        { key: "repository", label: "Repository" },
        { key: "assetPath", label: "Asset", cellClass: "kk-col-location" },
        { key: "stage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "attempts", label: "Attempts", align: "end" },
        { key: "actions", label: "Actions", align: "end" },
      ];
    case "findings":
      return [
        { key: "advisoryId", label: "Advisory" },
        { key: "packageName", label: "Package" },
        { key: "installedVersion", label: "Installed" },
        { key: "severity", label: "Severity" },
        { key: "affectedArtifactCount", label: "Artifacts", align: "end" },
        { key: "activeWaiverCount", label: "Waivers", align: "end" },
        { key: "actions", label: "Actions", align: "end" },
      ];
    case "repositories":
      return [
        { key: "name", label: "Repository" },
        { key: "format", label: "Format" },
        { key: "type", label: "Type" },
        { key: "policyName", label: "Policy" },
        { key: "policyEnabled", label: "Policy enabled" },
        { key: "actions", label: "Actions", align: "end" },
      ];
    case "policies":
      return [
        { key: "name", label: "Policy" },
        { key: "enabled", label: "Enabled" },
        { key: "blockSeverity", label: "Block severity" },
        { key: "onlyFixable", label: "Only fixable" },
        { key: "revision", label: "Revision", align: "end" },
        { key: "actions", label: "Actions", align: "end" },
      ];
    case "waivers":
      return [
        { key: "advisorySelector", label: "Advisory" },
        { key: "packageSelector", label: "Package" },
        { key: "scopeType", label: "Scope" },
        { key: "repository", label: "Repository" },
        { key: "active", label: "Active" },
        { key: "expiresAt", label: "Expires" },
        { key: "actions", label: "Actions", align: "end" },
      ];
    default:
      return [];
  }
});

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (!needle) return items.value;
  return items.value.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

async function rescanAsset(row: Row) {
  const assetId = row.assetId ?? row.id;
  if (assetId == null) return;
  busy.value = true;
  try {
    await api.send(`/internal/security/scanning/assets/${encodeURIComponent(String(assetId))}/rescan`, "POST");
    showToast(t("Rescan queued."), "ok");
    await load();
  } catch (cause) {
    showToast(`${t("Rescan failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

async function taskAction(row: Row, action: "retry" | "cancel") {
  const task = row as unknown as ScanTask;
  busy.value = true;
  try {
    await api.send(`/internal/security/scanning/tasks/${task.id}/${action}`, "POST");
    showToast(action === "retry" ? t("Task requeued.") : t("Task cancelled."), "ok");
    await load();
  } catch (cause) {
    showToast(`${t("Action failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

/* ---- Scan policy ------------------------------------------------------- */

const policyDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editingPolicy = ref<ScanPolicy | null>(null);
const policyDraft = reactive<Record<string, unknown>>({
  name: "",
  enabled: true,
  blockSeverity: "HIGH",
  onlyFixable: false,
  blockUnknownSeverity: true,
  requireCompleteInventory: false,
  maxResultAgeSeconds: null,
  requiredPlatforms: [],
});

function openPolicy(row?: Row) {
  const policy = row ? (row as unknown as ScanPolicy) : null;
  editingPolicy.value = policy;
  Object.assign(policyDraft, {
    name: policy?.name ?? "",
    enabled: policy?.enabled ?? true,
    blockSeverity: policy?.blockSeverity ?? "HIGH",
    onlyFixable: policy?.onlyFixable ?? false,
    blockUnknownSeverity: policy?.blockUnknownSeverity ?? true,
    requireCompleteInventory: policy?.requireCompleteInventory ?? false,
    maxResultAgeSeconds: policy?.maxResultAgeSeconds ?? null,
    requiredPlatforms: policy?.requiredPlatforms ?? [],
  });
  error.value = "";
  policyDialog.value?.open();
}

async function savePolicy() {
  if (!String(policyDraft.name ?? "").trim()) {
    error.value = t("Policy name is required.");
    return;
  }
  busy.value = true;
  error.value = "";
  const payload = {
    name: String(policyDraft.name).trim(),
    enabled: Boolean(policyDraft.enabled),
    blockSeverity: policyDraft.blockSeverity,
    onlyFixable: Boolean(policyDraft.onlyFixable),
    blockUnknownSeverity: Boolean(policyDraft.blockUnknownSeverity),
    requireCompleteInventory: Boolean(policyDraft.requireCompleteInventory),
    maxResultAgeSeconds:
      policyDraft.maxResultAgeSeconds === "" || policyDraft.maxResultAgeSeconds == null
        ? null
        : Number(policyDraft.maxResultAgeSeconds),
    requiredPlatforms: policyDraft.requiredPlatforms ?? [],
  };
  try {
    if (editingPolicy.value) {
      await api.send(`/internal/security/scanning/policies/${editingPolicy.value.id}`, "PUT", payload);
    } else {
      await api.send("/internal/security/scanning/policies", "POST", payload);
    }
    showToast(t("Scan policy saved."), "ok");
    policyDialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

/* ---- Repository scan config -------------------------------------------- */

const configDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const configRepo = ref<ScanRepository | null>(null);
const configDraft = reactive<Record<string, unknown>>({
  enabled: true,
  scanHostedContent: true,
  scanProxyContent: false,
  enforcementMode: "AUDIT",
  pendingAction: "ALLOW",
  failureAction: "ALLOW",
  partialAction: "ALLOW",
  maxResultAgeSeconds: null,
  policyId: null,
});

async function openConfig(row: Row) {
  const repo = row as unknown as ScanRepository;
  configRepo.value = repo;
  error.value = "";
  try {
    const config = await api.get<Record<string, unknown>>(
      `/internal/security/scanning/repositories/${repo.id}/config`,
    );
    Object.assign(configDraft, config);
  } catch (cause) {
    showToast(`${t("Failed to load scan config")}: ${(cause as Error).message}`, "error");
    return;
  }
  configDialog.value?.open();
}

async function saveConfig() {
  if (!configRepo.value) return;
  busy.value = true;
  error.value = "";
  try {
    await api.send(
      `/internal/security/scanning/repositories/${configRepo.value.id}/config`,
      "PUT",
      { ...configDraft },
    );
    showToast(t("Scan configuration saved."), "ok");
    configDialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

/* ---- Waiver ------------------------------------------------------------ */

const waiverDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const waiverDraft = reactive<Record<string, unknown>>({
  scopeType: "repository",
  repositoryId: null,
  advisorySelector: "",
  packageSelector: "",
  reason: "",
  expiresAt: "",
});

function openWaiver() {
  Object.assign(waiverDraft, {
    scopeType: "repository",
    repositoryId: null,
    advisorySelector: "",
    packageSelector: "",
    reason: "",
    expiresAt: "",
  });
  error.value = "";
  waiverDialog.value?.open();
}

async function saveWaiver() {
  const advisory = String(waiverDraft.advisorySelector ?? "").trim();
  const pkg = String(waiverDraft.packageSelector ?? "").trim();
  if (!String(waiverDraft.reason ?? "").trim()) {
    error.value = t("A waiver reason is required.");
    return;
  }
  if (!advisory && !pkg) {
    error.value = t("Provide an advisory or package selector.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await api.send("/internal/security/scanning/waivers", "POST", {
      scopeType: waiverDraft.scopeType,
      repositoryId: waiverDraft.repositoryId ?? null,
      assetId: null,
      findingId: null,
      advisorySelector: advisory || null,
      packageSelector: pkg || null,
      selector: {},
      reason: String(waiverDraft.reason),
      policyId: null,
      policyRevision: null,
      expiresAt: waiverDraft.expiresAt ? new Date(String(waiverDraft.expiresAt)).toISOString() : null,
    });
    showToast(t("Waiver created."), "ok");
    waiverDialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

/* ---- Delete ------------------------------------------------------------ */

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<Row | null>(null);

function askDelete(row: Row) {
  deleteTarget.value = row;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target || target.id == null) return;
  const collection = tab.value === "policies" ? "policies" : tab.value === "waivers" ? "waivers" : null;
  if (!collection) return;
  busy.value = true;
  try {
    await api.delete(`/internal/security/scanning/${collection}/${encodeURIComponent(String(target.id))}`);
    showToast(t("Deleted."), "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

watch(tab, () => {
  search.value = "";
  void load(true);
});

onMounted(() => load(true));
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button v-if="tab === 'policies'" type="button" class="micl-button-filled-m kk-primary-action" @click="openPolicy()">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create policy") }}
    </button>
    <button v-if="tab === 'waivers'" type="button" class="micl-button-filled-m kk-primary-action" @click="openWaiver">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create waiver") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load(true)">
      {{ t("Refresh") }}
    </button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
      <label for="scan-search">{{ t("Search") }}</label>
      <input id="scan-search" v-model="search" type="search" autocomplete="off" @keyup.enter="load(true)">
    </div>
      <label
      v-if="tab === 'findings'"
      class="kk-switch-row kk-current-findings"
      :title="t('Only findings from scans applicable to current artifact content. Uncheck to include historical findings.')"
    >
      <input class="micl-switch" type="checkbox" role="switch" :checked="currentOnly" @change="onCurrentOnlyChange">
      <span>{{ t("Current findings") }}</span>
    </label>
    </div>
  </div>

  <div class="kk-section-navigation"><M3Tabs :tabs="TABS" :active="tab" @select="tab = $event as ScanTab" /></div>

  <p v-if="error && !policyDialog && !waiverDialog && !configDialog" class="kk-form-error" role="alert">
    {{ error }}
  </p>

  <section v-if="tab === 'overview'" class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">security</span></span>
      <h2 class="kk-card-header__title">{{ t("Overview") }}</h2>
    </div>
    <div class="kk-summary">
      <div v-for="entry in overviewEntries" :key="entry.label" class="kk-summary__item">
        <span class="kk-summary__label">{{ entry.label }}</span>
        <strong class="kk-summary__value">{{ loading ? "…" : entry.value }}</strong>
      </div>
    </div>
  </section>

  <section class="kk-surface-card" v-else>
    <section class="kk-table-region">
<M3DataTable
      :columns="columns"
      :rows="filtered"
      :row-key="(row: Row, index?: number) => `${row.id ?? 'row'}-${index}`"
      :loading="loading"
      :empty-text="t('No records found.')"
      :aria-label="t('Scanning records')"
    >
      <template #cell-id="{ row }">{{ row.id }}</template>
      <template #cell-advisoryId="{ row }">
        <code class="kk-mono">{{ row.advisoryId ?? row.advisorySelector ?? "—" }}</code>
      </template>
      <template #cell-advisorySelector="{ row }">
        <code class="kk-mono">{{ row.advisorySelector || "—" }}</code>
      </template>
      <template #cell-packageSelector="{ row }">
        <code class="kk-mono">{{ row.packageSelector || "—" }}</code>
      </template>
      <template #cell-packageName="{ row }"><code class="kk-mono">{{ row.packageName || "—" }}</code></template>
      <template #cell-installedVersion="{ row }">{{ row.installedVersion || "—" }}</template>
      <template #cell-severity="{ row }">
        <span class="kk-badge" :class="badgeTone(String(row.severity ?? ''))">{{ t(String(row.severity || '—')) }}</span>
      </template>
      <template #cell-affectedArtifactCount="{ row }">{{ row.affectedArtifactCount ?? "—" }}</template>
      <template #cell-activeWaiverCount="{ row }">{{ row.activeWaiverCount ?? 0 }}</template>
      <template #cell-assetPath="{ row }">
        <code class="kk-mono" :title="String(row.assetPath ?? '')">{{ row.assetPath || "—" }}</code>
      </template>
      <template #cell-stage="{ row }">{{ t(String(row.stage || '—')) }}</template>
      <template #cell-status="{ row }">
        <span class="kk-badge" :class="badgeTone(String(row.status ?? ''))">{{ t(String(row.status || '—')) }}</span>
      </template>
      <template #cell-attempts="{ row }">{{ row.attempts ?? 0 }} / {{ row.maxAttempts ?? 0 }}</template>
      <template #cell-format="{ row }">{{ row.format || "—" }}</template>
      <template #cell-name="{ row }">{{ row.name || "—" }}</template>
      <template #cell-type="{ row }">{{ row.type || "—" }}</template>
      <template #cell-policyName="{ row }">{{ row.policyName || "—" }}</template>
      <template #cell-policyEnabled="{ row }">
        <span class="kk-badge" :class="row.policyEnabled ? 'kk-badge--ok' : 'kk-badge--warn'">
          {{ row.policyEnabled ? t("Yes") : t("No") }}
        </span>
      </template>
      <template #cell-enabled="{ row }">
        <span class="kk-badge" :class="row.enabled ? 'kk-badge--ok' : 'kk-badge--warn'">
          {{ row.enabled ? t("Yes") : t("No") }}
        </span>
      </template>
      <template #cell-blockSeverity="{ row }">
        <span class="kk-badge" :class="badgeTone(String(row.blockSeverity ?? ''))">{{ t(String(row.blockSeverity || '—')) }}</span>
      </template>
      <template #cell-onlyFixable="{ row }">{{ row.onlyFixable ? t("Yes") : t("No") }}</template>
      <template #cell-revision="{ row }">{{ row.revision ?? "—" }}</template>
      <template #cell-scopeType="{ row }">{{ t(String(row.scopeType || '—')) }}</template>
      <template #cell-repository="{ row }">{{ row.repository || "—" }}</template>
      <template #cell-active="{ row }">
        <span class="kk-badge" :class="row.active ? 'kk-badge--ok' : 'kk-badge--warn'">
          {{ row.active ? t("Yes") : t("No") }}
        </span>
      </template>
      <template #cell-expiresAt="{ row }">{{ timestamp(row.expiresAt as string) }}</template>

      <template #cell-actions="{ row }">
        <div class="kk-row-actions">
          <template v-if="tab === 'tasks'">
            <button type="button" class="micl-button-text-s" :disabled="busy" @click="taskAction(row, 'retry')">
              {{ t("Retry") }}
            </button>
            <button type="button" class="micl-button-text-s" :disabled="busy" @click="taskAction(row, 'cancel')">
              {{ t("Cancel") }}
            </button>
          </template>
          <template v-else-if="tab === 'findings'">
            <button type="button" class="micl-button-text-s" :disabled="busy" @click="rescanAsset(row)">
              {{ t("Rescan") }}
            </button>
          </template>
          <template v-else-if="tab === 'repositories'">
            <button type="button" class="micl-button-text-s" @click="openConfig(row)">
              {{ t("Configure") }}
            </button>
          </template>
          <template v-else-if="tab === 'policies'">
            <button type="button" class="micl-button-text-s" @click="openPolicy(row)">{{ t("Edit") }}</button>
            <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
          </template>
          <template v-else-if="tab === 'waivers'">
            <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
          </template>
        </div>
      </template>
    </M3DataTable>
</section>

    <div class="kk-toolbar kk-action-bar">
      <span class="kk-muted">{{ t("Page") }} {{ page + 1 }}</span>
      <div class="kk-toolbar__spacer"></div>
      <button type="button" class="micl-button-tonal-s" :disabled="page === 0 || loading" @click="previousPage">
        {{ t("Previous") }}
      </button>
      <button
        type="button"
        class="micl-button-tonal-s"
        :disabled="nextAfter == null || loading"
        @click="nextPage"
      >
        {{ t("Next") }}
      </button>
    </div>
  </section>

  <M3Dialog
    ref="policyDialog"
    :title="editingPolicy ? t('Edit scan policy') : t('Create scan policy')"
    :busy="busy"
    :error="error"
    @confirm="savePolicy"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="policy-name">{{ t("Name") }}</label>
        <input id="policy-name" v-model="policyDraft.name" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="policy-severity">{{ t("Block severity") }}</label>
        <select id="policy-severity" v-model="policyDraft.blockSeverity">
          <option v-for="value in SEVERITIES" :key="value" :value="value">{{ t(value) }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="policy-max-age">{{ t("Max result age (seconds)") }}</label>
        <input id="policy-max-age" v-model="policyDraft.maxResultAgeSeconds" type="number" min="0">
      </div>
      <label class="kk-switch-row">
        <input v-model="policyDraft.enabled" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Enabled") }}</span>
      </label>
      <label class="kk-switch-row">
        <input v-model="policyDraft.onlyFixable" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Only block fixable findings") }}</span>
      </label>
      <label class="kk-switch-row">
        <input v-model="policyDraft.blockUnknownSeverity" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Block unknown severity") }}</span>
      </label>
      <label class="kk-switch-row">
        <input v-model="policyDraft.requireCompleteInventory" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Require complete inventory") }}</span>
      </label>
    </div>
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="configDialog"
    :title="`${t('Scan configuration')} · ${configRepo?.name ?? ''}`"
    :busy="busy"
    :error="error"
    @confirm="saveConfig"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <label class="kk-switch-row">
        <input v-model="configDraft.enabled" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Scanning enabled") }}</span>
      </label>
      <label class="kk-switch-row">
        <input v-model="configDraft.scanHostedContent" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Scan hosted content") }}</span>
      </label>
      <label class="kk-switch-row">
        <input v-model="configDraft.scanProxyContent" class="micl-switch" type="checkbox" role="switch">
        <span>{{ t("Scan proxy content") }}</span>
      </label>
      <div class="micl-textfield-outlined">
        <label for="config-mode">{{ t("Enforcement mode") }}</label>
        <select id="config-mode" v-model="configDraft.enforcementMode">
          <option v-for="value in ENFORCEMENT_MODES" :key="value" :value="value">{{ t(value) }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="config-pending">{{ t("Pending action") }}</label>
        <select id="config-pending" v-model="configDraft.pendingAction">
                  <option v-for="value in POLICY_ACTIONS" :key="value" :value="value">{{ t(value) }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="config-failure">{{ t("Failure action") }}</label>
        <select id="config-failure" v-model="configDraft.failureAction">
                  <option v-for="value in POLICY_ACTIONS" :key="value" :value="value">{{ t(value) }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="config-partial">{{ t("Partial action") }}</label>
        <select id="config-partial" v-model="configDraft.partialAction">
                  <option v-for="value in POLICY_ACTIONS" :key="value" :value="value">{{ t(value) }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="config-max-age">{{ t("Max result age (seconds)") }}</label>
        <input id="config-max-age" v-model="configDraft.maxResultAgeSeconds" type="number" min="0">
      </div>
    </div>
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="waiverDialog"
    :title="t('Create waiver')"
    :subtitle="t('Waivers suppress matching findings until they expire.')"
    :busy="busy"
    :error="error"
    @confirm="saveWaiver"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="waiver-scope">{{ t("Scope") }}</label>
        <select id="waiver-scope" v-model="waiverDraft.scopeType">
          <option value="repository">{{ t('repository') }}</option>
          <option value="asset">{{ t('asset') }}</option>
          <option value="finding">{{ t('finding') }}</option>
        </select>
      </div>
      <div v-if="repositories.length" class="micl-textfield-outlined">
        <label for="waiver-repo">{{ t("Repository") }}</label>
        <select id="waiver-repo" v-model="waiverDraft.repositoryId">
          <option :value="null">{{ t("Any repository") }}</option>
          <option v-for="repo in repositories" :key="repo.id" :value="repo.id">{{ repo.name }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="waiver-advisory">{{ t("Advisory") }}</label>
        <input
          id="waiver-advisory"
          v-model="waiverDraft.advisorySelector"
          type="text"
          placeholder="CVE-2026-1234"
          autocomplete="off"
        >
      </div>
      <div class="micl-textfield-outlined">
        <label for="waiver-package">{{ t("Package") }}</label>
        <input
          id="waiver-package"
          v-model="waiverDraft.packageSelector"
          type="text"
          placeholder="pkg:maven/org.example/demo"
          autocomplete="off"
        >
      </div>
      <div class="micl-textfield-outlined">
        <label for="waiver-expires">{{ t("Expires at") }}</label>
        <input id="waiver-expires" v-model="waiverDraft.expiresAt" type="datetime-local">
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="waiver-reason">{{ t("Reason") }}</label>
        <input id="waiver-reason" v-model="waiverDraft.reason" type="text" autocomplete="off">
      </div>
    </div>
</section>
  </div></M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete record?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete this scan record") }}?
    </p>
  </div></M3Dialog>
</div>
</template>
