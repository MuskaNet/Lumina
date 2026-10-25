<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3Tabs from "../../shared/components/M3Tabs.vue";

interface CleanupPolicy {
  id?: number;
  name?: string;
  format?: string;
  notes?: string | null;
  revision?: number;
  criteria?: Record<string, unknown> | null;
  scanLimitPerRepository?: number | null;
  deleteLimitPerRepository?: number | null;
}

interface TargetRepository {
  id?: number;
  name?: string;
}

interface CleanupSchedule {
  cronExpression?: string | null;
  timeZone?: string | null;
  enabled?: boolean;
}

interface PolicyView {
  policy?: CleanupPolicy;
  repositories?: TargetRepository[];
  schedule?: CleanupSchedule | null;
  capability?: Record<string, unknown> | null;
}

interface PolicyPage {
  items?: PolicyView[];
  nextAfter?: number | null;
}

interface RunView {
  id?: number;
  policyId?: number | null;
  policyName?: string | null;
  mode?: string | null;
  status?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  scanned?: number | null;
  deleted?: number | null;
}

interface RunRepository {
  id?: number;
  repositoryId?: number;
  repositoryName?: string | null;
  name?: string | null;
  state?: string | null;
  scanned?: number | null;
  matched?: number | null;
  deleted?: number | null;
}

interface RunDetail {
  run?: RunView;
  repositories?: RunRepository[];
  itemsByRepository?: Record<string, { path?: string | null; deleted?: boolean }[]> | null;
}

interface RunPage {
  items?: RunView[];
  nextBefore?: number | null;
}

interface Repository {
  id?: number | null;
  name: string;
  format?: string | null;
}

const TABS = [
  { id: "policies", label: "Policies" },
  { id: "runs", label: "Runs" },
];

const tab = ref("policies");
const policies = ref<PolicyView[]>([]);
const runs = ref<RunView[]>([]);
const repositories = ref<Repository[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const policyRows = computed(() => policies.value);

const policyColumns: DataTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "format", label: "Format" },
  { key: "targets", label: "Repositories", align: "end" },
  { key: "schedule", label: "Schedule" },
  { key: "revision", label: "Revision", align: "end" },
  { key: "actions", label: "Actions", align: "end" },
];

const runColumns: DataTableColumn[] = [
  { key: "id", label: "Run", align: "end" },
  { key: "policyName", label: "Policy" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" },
  { key: "scanned", label: "Scanned", align: "end" },
  { key: "deleted", label: "Deleted", align: "end" },
  { key: "startedAt", label: "Started" },
];

function policyOf(view: PolicyView): CleanupPolicy {
  return view.policy ?? {};
}

function scheduleLabel(view: PolicyView): string {
  const schedule = view.schedule;
  if (!schedule?.cronExpression) return t("Manual");
  return `${schedule.cronExpression} (${schedule.timeZone ?? "UTC"})${schedule.enabled ? "" : ` · ${t("disabled")}`}`;
}

function timestamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [page, runPage, repoList] = await Promise.all([
      api.get<PolicyPage>("/internal/cleanup/policies?after=0&limit=50"),
      api.getOrNull<RunPage>("/internal/cleanup/runs?before=0&limit=20"),
      api.getOrNull<Repository[]>("/internal/repositories?purpose=admin"),
    ]);
    policies.value = page.items ?? [];
    runs.value = runPage?.items ?? [];
    repositories.value = repoList ?? [];
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<CleanupPolicy | null>(null);
const draft = reactive<Record<string, unknown>>({
  name: "",
  format: "",
  notes: "",
  pattern: "",
  patternType: "REGEX",
  publishedOlderThanDays: "",
  lastDownloadedOlderThanDays: "",
  retainCount: "",
  scanLimitPerRepository: 100,
  deleteLimitPerRepository: 100,
  repositoryIds: [] as number[],
  cronExpression: "",
  timeZone: "UTC",
  scheduleEnabled: false,
});

const formatOptions = computed(() => {
  const formats = new Set<string>();
  for (const repo of repositories.value) {
    if (repo.format) formats.add(repo.format);
  }
  for (const view of policies.value) {
    const format = policyOf(view).format;
    if (format) formats.add(format);
  }
  return [...formats].sort();
});

function openCreate() {
  editing.value = null;
  Object.assign(draft, {
    name: "",
    format: formatOptions.value[0] ?? "",
    notes: "",
    pattern: "",
    patternType: "REGEX",
    publishedOlderThanDays: "",
    lastDownloadedOlderThanDays: "",
    retainCount: "",
    scanLimitPerRepository: 100,
    deleteLimitPerRepository: 100,
    repositoryIds: [],
    cronExpression: "",
    timeZone: "UTC",
    scheduleEnabled: false,
  });
  error.value = "";
  dialog.value?.open();
}

function openEdit(view: PolicyView) {
  const policy = policyOf(view);
  editing.value = policy;
  const criteria = (policy.criteria ?? {}) as Record<string, unknown>;
  Object.assign(draft, {
    name: policy.name ?? "",
    format: policy.format ?? "",
    notes: policy.notes ?? "",
    pattern: String(criteria.pattern ?? ""),
    patternType: String(criteria.patternType ?? "REGEX"),
    publishedOlderThanDays: criteria.publishedOlderThanDays ?? "",
    lastDownloadedOlderThanDays: criteria.lastDownloadedOlderThanDays ?? "",
    retainCount: criteria.retainCount ?? "",
    scanLimitPerRepository: policy.scanLimitPerRepository ?? 100,
    deleteLimitPerRepository: policy.deleteLimitPerRepository ?? 100,
    repositoryIds: (view.repositories ?? []).map((repo) => Number(repo.id)).filter((id) => Number.isFinite(id)),
    cronExpression: view.schedule?.cronExpression ?? "",
    timeZone: view.schedule?.timeZone ?? "UTC",
    scheduleEnabled: Boolean(view.schedule?.enabled),
  });
  error.value = "";
  dialog.value?.open();
}

function toggleRepository(id: number) {
  const list = draft.repositoryIds as number[];
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else list.push(id);
}

function optionalNumber(key: string): number | undefined {
  const raw = draft[key];
  if (raw === "" || raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function buildCriteria(): Record<string, unknown> {
  const criteria: Record<string, unknown> = {};
  const pattern = String(draft.pattern ?? "").trim();
  if (pattern) {
    criteria.pattern = pattern;
    criteria.patternType = draft.patternType;
  }
  const published = optionalNumber("publishedOlderThanDays");
  if (published != null) criteria.publishedOlderThanDays = published;
  const downloaded = optionalNumber("lastDownloadedOlderThanDays");
  if (downloaded != null) criteria.lastDownloadedOlderThanDays = downloaded;
  const retain = optionalNumber("retainCount");
  if (retain != null) criteria.retainCount = retain;
  return criteria;
}

async function save() {
  if (!String(draft.name ?? "").trim()) {
    error.value = t("Policy name is required.");
    return;
  }
  const cronExpression = String(draft.cronExpression ?? "").trim();
  const payload = {
    name: String(draft.name).trim(),
    format: draft.format || null,
    notes: draft.notes || null,
    criteria: buildCriteria(),
    repositoryIds: draft.repositoryIds ?? [],
    scanLimitPerRepository: optionalNumber("scanLimitPerRepository") ?? null,
    deleteLimitPerRepository: optionalNumber("deleteLimitPerRepository") ?? null,
    schedule: cronExpression
      ? { cronExpression, timeZone: draft.timeZone || "UTC", enabled: Boolean(draft.scheduleEnabled) }
      : null,
    revision: editing.value?.revision ?? null,
  };
  busy.value = true;
  error.value = "";
  try {
    if (editing.value?.id != null) {
      await api.send(`/internal/cleanup/policies/${editing.value.id}`, "PUT", payload);
    } else {
      await api.send("/internal/cleanup/policies", "POST", payload);
    }
    showToast(t("Cleanup policy saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<CleanupPolicy | null>(null);

function askDelete(policy: CleanupPolicy) {
  deleteTarget.value = policy;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target?.id) return;
  busy.value = true;
  try {
    await api.delete(
      `/internal/cleanup/policies/${target.id}?revision=${encodeURIComponent(String(target.revision ?? 0))}`,
    );
    showToast(t("Cleanup policy deleted."), "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

async function runNow(view: PolicyView, mode: "TRY_RUN" | "DELETE") {
  const policy = policyOf(view);
  if (policy.id == null) return;
  busy.value = true;
  try {
    const run = await api.send<{ run?: RunView }>(`/internal/cleanup/policies/${policy.id}/runs`, "POST", {
      mode,
      expectedPolicyRevision: policy.revision ?? null,
      scanLimitPerRepository: policy.scanLimitPerRepository ?? null,
    });
    showToast(
      `${mode === "TRY_RUN" ? t("Try run") : t("Cleanup")} ${t("queued as run")} #${run?.run?.id ?? "?"}.`,
      "ok",
    );
    tab.value = "runs";
    await load();
  } catch (cause) {
    showToast(`${t("Run failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

/* ---- Run detail -------------------------------------------------------- */

const detailDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const runDetail = ref<RunDetail | null>(null);
const detailLoading = ref(false);

async function openRunDetail(run: RunView) {
  if (run.id == null) return;
  detailLoading.value = true;
  runDetail.value = null;
  detailDialog.value?.open();
  try {
    runDetail.value = await api.get<RunDetail>(
      `/internal/cleanup/runs/${encodeURIComponent(String(run.id))}/details?itemsPerRepository=20`,
    );
  } catch (cause) {
    showToast(`${t("Failed to load run")}: ${(cause as Error).message}`, "error");
  } finally {
    detailLoading.value = false;
  }
}

async function cancelRun(run: RunView) {
  if (run.id == null) return;
  busy.value = true;
  try {
    await api.send(`/internal/cleanup/runs/${encodeURIComponent(String(run.id))}/cancel`, "POST");
    showToast(t("Cancellation requested."), "ok");
    await load();
    if (runDetail.value?.run?.id === run.id) await openRunDetail(run);
  } catch (cause) {
    showToast(`${t("Cancel failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-m" @click="openCreate">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">add</span>
      {{ t("Create policy") }}
    </button>
    <button type="button" class="micl-button-outlined-m kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <M3Tabs :tabs="TABS" :active="tab" @select="tab = $event" />

  <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>

  <M3DataTable
    v-if="tab === 'policies'"
    :columns="policyColumns"
    :rows="policyRows"
    :row-key="(row: PolicyView, index?: number) => String(policyOf(row).id ?? index)"
    :loading="loading"
    :empty-text="t('No cleanup policies found.')"
    :aria-label="t('Cleanup policies')"
  >
    <template #cell-name="{ row }">{{ policyOf(row).name }}</template>
    <template #cell-format="{ row }">{{ policyOf(row).format }}</template>
    <template #cell-targets="{ row }">{{ (row.repositories ?? []).length }}</template>
    <template #cell-schedule="{ row }">{{ scheduleLabel(row) }}</template>
    <template #cell-revision="{ row }">{{ policyOf(row).revision ?? "—" }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" :disabled="busy" @click="runNow(row, 'TRY_RUN')">
          {{ t("Try run") }}
        </button>
        <button type="button" class="micl-button-text-s" @click="askDelete(policyOf(row))">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>

  <M3DataTable
    v-else
    :columns="runColumns"
    :rows="runs"
    :row-key="(row: RunView, index?: number) => `${row.id ?? index}`"
    :loading="loading"
    :empty-text="t('No cleanup runs found.')"
    :aria-label="t('Cleanup runs')"
  >
    <template #cell-status="{ row }">
      <span class="kk-badge" :class="row.status === 'COMPLETED' ? 'kk-badge--ok' : 'kk-badge--warn'">
        {{ row.status || "—" }}
      </span>
    </template>
    <template #cell-startedAt="{ row }">{{ timestamp(row.startedAt) }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openRunDetail(row)">{{ t("Details") }}</button>
        <button
          type="button"
          class="micl-button-text-s"
          :disabled="busy || row.status === 'COMPLETED' || row.status === 'CANCELLED'"
          @click="cancelRun(row)"
        >
          {{ t("Cancel") }}
        </button>
      </div>
    </template>
  </M3DataTable>

  <M3Dialog
    ref="dialog"
    wide
    :title="editing ? t('Edit cleanup policy') : t('Create cleanup policy')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-name">{{ t("Name") }}</label>
        <input id="cleanup-name" v-model="draft.name" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-format">{{ t("Format") }}</label>
        <select id="cleanup-format" v-model="draft.format">
          <option value="">{{ t("None") }}</option>
          <option v-for="format in formatOptions" :key="format" :value="format">{{ format }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="cleanup-notes">{{ t("Notes") }}</label>
        <input id="cleanup-notes" v-model="draft.notes" type="text" autocomplete="off">
      </div>
    </div>

    <h3 class="kk-schema-form__group">{{ t("Criteria") }}</h3>
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-pattern">{{ t("Path pattern") }}</label>
        <input id="cleanup-pattern" v-model="draft.pattern" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-pattern-type">{{ t("Pattern type") }}</label>
        <select id="cleanup-pattern-type" v-model="draft.patternType">
          <option value="REGEX">REGEX</option>
          <option value="GLOB">GLOB</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-published-days">{{ t("Published older than (days)") }}</label>
        <input id="cleanup-published-days" v-model="draft.publishedOlderThanDays" type="number" min="0">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-downloaded-days">{{ t("Last downloaded older than (days)") }}</label>
        <input id="cleanup-downloaded-days" v-model="draft.lastDownloadedOlderThanDays" type="number" min="0">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-retain">{{ t("Retain last N versions") }}</label>
        <input id="cleanup-retain" v-model="draft.retainCount" type="number" min="0">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-scan-limit">{{ t("Scan limit per repository") }}</label>
        <input id="cleanup-scan-limit" v-model="draft.scanLimitPerRepository" type="number" min="1">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-delete-limit">{{ t("Delete limit per repository") }}</label>
        <input id="cleanup-delete-limit" v-model="draft.deleteLimitPerRepository" type="number" min="1">
      </div>
    </div>

    <h3 class="kk-schema-form__group">{{ t("Target repositories") }}</h3>
    <div class="kk-actions-row">
      <label v-for="repo in repositories" :key="repo.name" class="kk-checkbox-row">
        <input
          class="micl-checkbox"
          type="checkbox"
          :checked="(draft.repositoryIds as number[]).includes(Number(repo.id))"
          @change="toggleRepository(Number(repo.id))"
        >
        <span>{{ repo.name }}</span>
      </label>
    </div>

    <h3 class="kk-schema-form__group">{{ t("Schedule") }}</h3>
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-cron">{{ t("Cron expression") }}</label>
        <input id="cleanup-cron" v-model="draft.cronExpression" type="text" placeholder="0 0 2 * * ?" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-timezone">{{ t("Time zone") }}</label>
        <input id="cleanup-timezone" v-model="draft.timeZone" type="text" autocomplete="off">
      </div>
      <label class="kk-checkbox-row">
        <input v-model="draft.scheduleEnabled" class="micl-checkbox" type="checkbox">
        <span>{{ t("Enable schedule") }}</span>
      </label>
    </div>
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    :title="t('Delete cleanup policy?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <code class="kk-mono">{{ deleteTarget?.name }}</code>
  </M3Dialog>

  <M3Dialog
    ref="detailDialog"
    wide
    hide-cancel
    :title="`${t('Cleanup run')} #${runDetail?.run?.id ?? ''}`"
    :subtitle="t('Per-repository progress and matched items.')"
    :confirm-label="t('Close')"
    @confirm="detailDialog?.close()"
  >
    <p v-if="detailLoading" class="kk-muted">{{ t("Loading…") }}</p>
    <template v-else-if="runDetail">
      <div class="kk-summary">
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Status") }}</span>
          <strong class="kk-summary__value">{{ runDetail.run?.status ?? "—" }}</strong>
        </div>
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Mode") }}</span>
          <strong class="kk-summary__value">{{ runDetail.run?.mode ?? "—" }}</strong>
        </div>
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Scanned") }}</span>
          <strong class="kk-summary__value">{{ runDetail.run?.scanned ?? 0 }}</strong>
        </div>
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Deleted") }}</span>
          <strong class="kk-summary__value">{{ runDetail.run?.deleted ?? 0 }}</strong>
        </div>
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Started") }}</span>
          <strong class="kk-summary__value">{{ timestamp(runDetail.run?.startedAt) }}</strong>
        </div>
        <div class="kk-summary__item">
          <span class="kk-summary__label">{{ t("Finished") }}</span>
          <strong class="kk-summary__value">{{ timestamp(runDetail.run?.finishedAt) }}</strong>
        </div>
      </div>

      <M3DataTable
        :columns="[
          { key: 'name', label: 'Repository' },
          { key: 'state', label: 'State' },
          { key: 'scanned', label: 'Scanned', align: 'end' },
          { key: 'matched', label: 'Matched', align: 'end' },
          { key: 'deleted', label: 'Deleted', align: 'end' },
        ]"
        :rows="runDetail.repositories ?? []"
        :row-key="(row: RunRepository, index?: number) => `${row.id ?? row.repositoryId ?? index}`"
        :empty-text="t('No repositories in this run.')"
        :aria-label="t('Run repositories')"
      >
        <template #cell-name="{ row }">{{ row.repositoryName ?? row.name ?? "—" }}</template>
        <template #cell-state="{ row }">
          <span class="kk-badge" :class="row.state === 'COMPLETED' ? 'kk-badge--ok' : 'kk-badge--warn'">
            {{ row.state || "—" }}
          </span>
        </template>
        <template #cell-scanned="{ row }">{{ row.scanned ?? 0 }}</template>
        <template #cell-matched="{ row }">{{ row.matched ?? 0 }}</template>
        <template #cell-deleted="{ row }">{{ row.deleted ?? 0 }}</template>
      </M3DataTable>
    </template>
  </M3Dialog>
</template>
