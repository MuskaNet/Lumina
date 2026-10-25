<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3Tabs from "../../shared/components/M3Tabs.vue";
import CleanupRepositoryPicker from "../components/CleanupRepositoryPicker.vue";
import {
  buildCleanupFormatOptions,
  buildCleanupPolicyPayload,
  cleanupFormatLabel,
  cleanupPolicyDraftFromView,
  createCleanupPolicyDraft,
  validateCleanupPolicyDraft,
  type CleanupCapability,
  type CleanupFormatOption,
  type CleanupPolicyDraft,
} from "../cleanupPolicy";

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
  capability?: CleanupCapability | null;
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
  type?: string | null;
  online?: boolean;
}

const TABS = [
  { id: "policies", label: "Policies" },
  { id: "runs", label: "Runs" },
];

const tab = ref("policies");
const policies = ref<PolicyView[]>([]);
const runs = ref<RunView[]>([]);
const repositories = ref<Repository[]>([]);
const capabilities = ref<CleanupCapability[]>([]);
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
    const [page, runPage, repoList, capabilityList] = await Promise.all([
      api.get<PolicyPage>("/internal/cleanup/policies?after=0&limit=50"),
      api.getOrNull<RunPage>("/internal/cleanup/runs?before=0&limit=20"),
      api.getOrNull<Repository[]>("/internal/repositories?purpose=admin"),
      api.getOrNull<CleanupCapability[]>("/internal/cleanup/capabilities"),
    ]);
    policies.value = page.items ?? [];
    runs.value = runPage?.items ?? [];
    repositories.value = repoList ?? [];
    capabilities.value = capabilityList ?? [];
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<PolicyView | null>(null);
const draft = reactive<CleanupPolicyDraft>(createCleanupPolicyDraft());
const repositoryError = ref(false);
const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const timeZoneOptions = computed(() => {
  const values = new Set<string>(["UTC", resolvedTimeZone]);
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      for (const zone of Intl.supportedValuesOf("timeZone")) values.add(zone);
    } catch {
      // Older engines may not enumerate zones; the text input still works.
    }
  }
  return [...values].sort();
});

const formatOptions = computed<CleanupFormatOption[]>(() =>
  buildCleanupFormatOptions(capabilities.value, [
    ...repositories.value.map((repository) => repository.format ?? ""),
    ...policies.value.map((view) => policyOf(view).format ?? ""),
  ]),
);

const selectedCapability = computed(() =>
  capabilities.value.find(
    (capability) => capability.format.toLowerCase() === draft.format.toLowerCase(),
  ),
);
const editingPolicy = computed(() => editing.value?.policy ?? null);
const editingSchedule = computed(() => editing.value?.schedule ?? null);
const supportsRetainCount = computed(() => selectedCapability.value?.retainCountSupported !== false);
const supportsLastDownloaded = computed(
  () => selectedCapability.value?.lastDownloadedSupported !== false,
);
const executeHelp = computed(() => {
  if (selectedCapability.value?.executeSupported === false) {
    return t("Try Run is available. Actual deletion and schedule enablement stay blocked until this format's protocol adapter passes deletion validation.");
  }
  return editingPolicy.value
    ? t("Changing cleanup rules or target repositories pauses automatic execution until you review and re-enable it.")
    : "";
});

const previewTitle = ref(t("Manual execution only"));
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewSequence = 0;

function formatPreviewTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  const cronExpression = draft.cronExpression.trim();
  if (!cronExpression) {
    previewTitle.value = t("Manual execution only");
    return;
  }
  if (!draft.timeZone.trim()) {
    previewTitle.value = t("Choose a time zone to preview this schedule.");
    return;
  }
  const sequence = ++previewSequence;
  previewTitle.value = t("Checking the next two runs…");
  previewTimer = setTimeout(async () => {
    try {
      const preview = await api.send<{ nextRuns?: string[]; timeZone?: string | null }>(
        "/internal/cleanup/schedules/preview",
        "POST",
        { cronExpression, timeZone: draft.timeZone, enabled: false },
      );
      if (sequence !== previewSequence) return;
      const runs = (preview?.nextRuns ?? []).map((value) =>
        formatPreviewTime(value, preview?.timeZone ?? draft.timeZone),
      );
      previewTitle.value = runs.length
        ? `${runs.length > 1 ? t("Next runs") : t("Next run")}: ${runs.join(" · ")}`
        : t("Schedule has no future fire time.");
    } catch (cause) {
      if (sequence !== previewSequence) return;
      previewTitle.value = `${t("Check the run schedule")}: ${(cause as Error).message}`;
    }
  }, 300);
}

function applyCapabilityConstraints() {
  if (!supportsRetainCount.value) draft.retainCount = null;
  if (!supportsLastDownloaded.value) draft.lastDownloadedOlderThanDays = null;
}

watch(
  () => draft.format,
  () => {
    applyCapabilityConstraints();
    repositoryError.value = false;
  },
);

watch([() => draft.cronExpression, () => draft.timeZone], schedulePreview);

function openCreate() {
  editing.value = null;
  repositoryError.value = false;
  Object.assign(
    draft,
    createCleanupPolicyDraft(formatOptions.value[0]?.value ?? "maven2", resolvedTimeZone),
  );
  error.value = "";
  schedulePreview();
  dialog.value?.open();
}

function openEdit(view: PolicyView) {
  editing.value = view;
  Object.assign(draft, cleanupPolicyDraftFromView(view));
  if (!draft.format) draft.format = formatOptions.value[0]?.value ?? "maven2";
  applyCapabilityConstraints();
  repositoryError.value = false;
  error.value = "";
  schedulePreview();
  dialog.value?.open();
}

async function save() {
  const validation = validateCleanupPolicyDraft(draft);
  repositoryError.value = validation.repositories;
  if (validation.name) {
    error.value = t("Policy name is required.");
    return;
  }
  if (!draft.format || formatOptions.value.find((option) => option.value === draft.format)?.disabled) {
    error.value = t("Choose a format that supports automatic cleanup.");
    return;
  }
  if (validation.repositories) {
    error.value = t("Policy name and at least one target repository are required.");
    return;
  }
  if (validation.criteria) {
    error.value = t("Add at least one pattern, age, or retain rule.");
    return;
  }
  const payload = buildCleanupPolicyPayload(draft, {
    revision: editingPolicy.value?.revision ?? null,
    scanLimitPerRepository: editingPolicy.value?.scanLimitPerRepository ?? null,
    deleteLimitPerRepository: editingPolicy.value?.deleteLimitPerRepository ?? null,
    scheduleEnabled: Boolean(editingSchedule.value?.enabled),
  });
  busy.value = true;
  error.value = "";
  try {
    if (editingPolicy.value?.id != null) {
      await api.send(`/internal/cleanup/policies/${editingPolicy.value.id}`, "PUT", payload);
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
    <button type="button" class="micl-button-filled-s" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create policy") }}
    </button>
    <button type="button" class="micl-button-outlined-s kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
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
    <template #cell-format="{ row }">{{ cleanupFormatLabel(policyOf(row).format ?? "") }}</template>
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
    :title="editingPolicy ? `${t('Edit cleanup policy')} · ${editingPolicy.name}` : t('Create cleanup policy')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <h3 class="kk-schema-form__group">{{ t("Policy details") }}</h3>
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-name">{{ t("Name") }}</label>
        <input id="cleanup-name" v-model="draft.name" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-format">{{ t("Format") }}</label>
        <select id="cleanup-format" v-model="draft.format">
          <option
            v-for="option in formatOptions"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <CleanupRepositoryPicker
      v-model="draft.repositoryIds"
      :repositories="repositories"
      :format="draft.format"
      :error="repositoryError"
    />
    <p v-if="repositoryError" class="kk-form-error" role="alert">
      {{ t("Select at least one target repository.") }}
    </p>

    <h3 class="kk-schema-form__group">{{ t("Cleanup rules") }}</h3>
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-pattern-type">{{ t("Pattern type") }}</label>
        <select id="cleanup-pattern-type" v-model="draft.patternType">
          <option value="GLOB">{{ t("Wildcard") }}</option>
          <option value="REGEX">{{ t("Regular expression") }}</option>
        </select>
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-pattern">{{ t("Name/path pattern") }}</label>
        <input id="cleanup-pattern" v-model="draft.pattern" type="text" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-published-days">{{ t("Published older than (days)") }}</label>
        <input id="cleanup-published-days" v-model="draft.publishedOlderThanDays" type="number" min="0">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-downloaded-days">{{ t("Last downloaded older than (days)") }}</label>
        <input id="cleanup-downloaded-days" v-model="draft.lastDownloadedOlderThanDays" type="number" min="0" :disabled="!supportsLastDownloaded">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-retain">{{ t("Keep newest versions") }}</label>
        <input id="cleanup-retain" v-model="draft.retainCount" type="number" min="0" :disabled="!supportsRetainCount">
      </div>
    </div>
    <p class="kk-hint">
      {{ t("A pattern only narrows the scope; at least one age or retain rule is required and every configured rule must match.") }}
    </p>

    <h3 class="kk-schema-form__group">{{ t("Schedule") }}</h3>
    <div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="cleanup-cron">{{ t("Run schedule (cron)") }}</label>
        <input id="cleanup-cron" v-model="draft.cronExpression" type="text" placeholder="0 0 2 * * ?" autocomplete="off">
      </div>
      <div class="micl-textfield-outlined">
        <label for="cleanup-timezone">{{ t("Time zone") }}</label>
        <input
          id="cleanup-timezone"
          v-model="draft.timeZone"
          type="text"
          list="cleanup-time-zone-options"
          autocomplete="off"
          :disabled="!draft.cronExpression.trim()"
        >
        <datalist id="cleanup-time-zone-options">
          <option v-for="zone in timeZoneOptions" :key="zone" :value="zone"></option>
        </datalist>
      </div>
    </div>
    <p class="kk-hint" aria-live="polite">{{ previewTitle }}</p>
    <p v-if="executeHelp" class="kk-hint">{{ executeHelp }}</p>

    <h3 class="kk-schema-form__group">{{ t("Notes") }}</h3>
    <div class="micl-textfield-outlined kk-field--wide">
      <label for="cleanup-notes">{{ t("Notes") }}</label>
      <textarea id="cleanup-notes" v-model="draft.notes" rows="3" :placeholder="t('Why this policy exists, ownership, or rollback notes')"></textarea>
    </div>
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete cleanup policy?')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <p class="kk-dialog-message">
      {{ t("Are you sure you want to delete policy") }} <strong class="kk-mono">{{ deleteTarget?.name }}</strong>?
    </p>
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
