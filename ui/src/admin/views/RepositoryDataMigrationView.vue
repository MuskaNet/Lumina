<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";

interface RepositoryStatus {
  id?: number;
  sourceRepositoryName?: string | null;
  targetRepositoryName?: string | null;
  format?: string | null;
  status?: string | null;
  totalAssets?: number;
  migratedAssets?: number;
  failedAssets?: number;
  pendingAssets?: number;
  lastError?: string | null;
}

interface MigrationStatus {
  jobId: number;
  status?: string | null;
  startedAt?: string | null;
  sourceNexusVersion?: string | null;
  sourceBaseUrl?: string | null;
  repositories?: number;
  totalAssets?: number;
  migratedAssets?: number;
  failedAssets?: number;
  pendingAssets?: number;
  packageMigrationEnabled?: boolean;
  active?: boolean;
  repositoryJobs?: RepositoryStatus[] | null;
}

const draft = reactive({
  sourceBaseUrl: "",
  sourceUsername: "",
  sourcePassword: "",
  pageSize: 100,
  concurrency: 4,
  checksumValidation: true,
  metadataSince: "",
  backupProxyText: "",
});

const busy = ref(false);
const jobs = ref<MigrationStatus[]>([]);
const selected = ref<MigrationStatus | null>(null);
const loadingJobs = ref(true);

const jobColumns: DataTableColumn[] = [
  { key: "jobId", label: "Job", align: "end" },
  { key: "status", label: "Status" },
  { key: "repositories", label: "Repos", align: "end" },
  { key: "migratedAssets", label: "Migrated", align: "end" },
  { key: "failedAssets", label: "Failed", align: "end" },
  { key: "startedAt", label: "Started" },
  { key: "actions", label: "Actions", align: "end" },
];

const repoColumns: DataTableColumn[] = [
  { key: "sourceRepositoryName", label: "Source" },
  { key: "targetRepositoryName", label: "Target" },
  { key: "format", label: "Format" },
  { key: "status", label: "Status" },
  { key: "totalAssets", label: "Total", align: "end" },
  { key: "migratedAssets", label: "Migrated", align: "end" },
  { key: "failedAssets", label: "Failed", align: "end" },
  { key: "pendingAssets", label: "Pending", align: "end" },
];

function timestamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

const progress = computed(() => {
  const job = selected.value;
  if (!job || !job.totalAssets) return 0;
  return Math.min(100, Math.round(((job.migratedAssets ?? 0) / job.totalAssets) * 100));
});

const summaryEntries = computed(() => {
  const job = selected.value;
  if (!job) return [];
  return [
    { label: t("Status"), value: t(job.status ?? "—") },
    { label: t("Source"), value: job.sourceBaseUrl ?? "—" },
    { label: t("Nexus version"), value: job.sourceNexusVersion ?? "—" },
    { label: t("Repositories"), value: String(job.repositories ?? 0) },
    { label: t("Total assets"), value: String(job.totalAssets ?? 0) },
    { label: t("Migrated"), value: String(job.migratedAssets ?? 0) },
    { label: t("Failed"), value: String(job.failedAssets ?? 0) },
    { label: t("Pending"), value: String(job.pendingAssets ?? 0) },
    { label: t("Package stage"), value: job.packageMigrationEnabled ? t("Enabled") : t("Disabled") },
    { label: t("Active"), value: job.active ? t("Yes") : t("No") },
  ];
});

function validate(): boolean {
  if (!draft.sourceBaseUrl.trim() || !draft.sourceUsername.trim() || !draft.sourcePassword) {
    showToast(t("Source URL, username and password are required."), "error");
    return false;
  }
  return true;
}

async function loadJobs() {
  loadingJobs.value = true;
  try {
    jobs.value = await api.get<MigrationStatus[]>("/internal/migration/nexus/repository-data/jobs");
    if (!selected.value && jobs.value.length) selected.value = jobs.value[0];
  } catch (cause) {
    showToast(`${t("Failed to load migration jobs")}: ${(cause as Error).message}`, "error");
  } finally {
    loadingJobs.value = false;
  }
}

async function refreshJob(jobId?: number) {
  const id = jobId ?? selected.value?.jobId;
  if (id == null) return;
  try {
    selected.value = await api.get<MigrationStatus>(
      `/internal/migration/nexus/repository-data/jobs/${encodeURIComponent(String(id))}`,
    );
    await loadJobs();
  } catch (cause) {
    showToast(`${t("Failed to load job")}: ${(cause as Error).message}`, "error");
  }
}

async function start() {
  if (!validate()) return;
  busy.value = true;
  try {
    const created = await api.send<{ jobId?: number; id?: number }>(
      "/internal/migration/nexus/repository-data/start",
      "POST",
      {
        sourceBaseUrl: draft.sourceBaseUrl.trim(),
        sourceUsername: draft.sourceUsername.trim(),
        sourcePassword: draft.sourcePassword,
        pageSize: Number(draft.pageSize) || null,
        concurrency: Number(draft.concurrency) || null,
        checksumValidation: draft.checksumValidation,
        metadataSince: draft.metadataSince ? new Date(draft.metadataSince).toISOString() : null,
        backupProxyRepositories: draft.backupProxyText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    );
    const id = created?.jobId ?? created?.id ?? null;
    showToast(t("Repository data migration started."), "ok");
    await loadJobs();
    if (id != null) await refreshJob(id);
  } catch (cause) {
    showToast(`${t("Start failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

async function jobAction(jobId: number, action: "metadata/start" | "packages/start" | "packages/retry-failed") {
  busy.value = true;
  try {
    await api.send(
      `/internal/migration/nexus/repository-data/jobs/${encodeURIComponent(String(jobId))}/${action}`,
      "POST",
    );
    showToast(t("Job step started."), "ok");
    await refreshJob(jobId);
  } catch (cause) {
    showToast(`${t("Action failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

function selectJob(row: MigrationStatus) {
  selected.value = row;
  void refreshJob(row.jobId);
}

onMounted(loadJobs);
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" :disabled="busy" @click="start">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">play_arrow</span>
      {{ busy ? t("Starting…") : t("Start repository data migration") }}
    </button>
    <button type="button" class="micl-button-tonal-s" :disabled="selected == null" @click="refreshJob()">
      {{ t("Refresh job") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="loadJobs">
      {{ t("Reload jobs") }}
    </button>
  </div>

  <p class="kk-muted">
    {{ t("Copies repository blobs from a Nexus instance. Metadata and packages run as separate stages so each can be resumed.") }}
  </p>

  <section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Source") }}</h2>
    </div>
<div class="kk-field-grid">
    <div class="micl-textfield-outlined kk-field--wide">
      <label for="rdm-url">{{ t("Source URL") }}</label>
      <input id="rdm-url" v-model="draft.sourceBaseUrl" type="url" placeholder="https://nexus.example.com" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="rdm-user">{{ t("Source username") }}</label>
      <input id="rdm-user" v-model="draft.sourceUsername" type="text" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="rdm-password">{{ t("Source password") }}</label>
      <input id="rdm-password" v-model="draft.sourcePassword" type="password" autocomplete="new-password">
    </div>
    <div class="micl-textfield-outlined">
      <label for="rdm-page-size">{{ t("Page size") }}</label>
      <input id="rdm-page-size" v-model.number="draft.pageSize" type="number" min="1">
    </div>
    <div class="micl-textfield-outlined">
      <label for="rdm-concurrency">{{ t("Concurrency") }}</label>
      <input id="rdm-concurrency" v-model.number="draft.concurrency" type="number" min="1">
    </div>
    <div class="micl-textfield-outlined">
      <label for="rdm-since">{{ t("Metadata since") }}</label>
      <input id="rdm-since" v-model="draft.metadataSince" type="datetime-local">
    </div>
    <label class="kk-switch-row">
      <input v-model="draft.checksumValidation" class="micl-switch" type="checkbox" role="switch">
      <span>{{ t("Validate checksums") }}</span>
    </label>
    <div class="micl-textfield-outlined kk-field--wide">
      <label for="rdm-backup">{{ t("Backup proxy repositories") }}</label>
      <textarea
        id="rdm-backup"
        :value="draft.backupProxyText"
        rows="2"
        @input="draft.backupProxyText = ($event.target as HTMLTextAreaElement).value"
      ></textarea>
    </div>
  </div>
</section>



  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">compare_arrows</span></span>
      <h2 class="kk-card-header__title">{{ t("Migration jobs") }}</h2>
    </div>
<M3DataTable
    :columns="jobColumns"
    :rows="jobs"
    :row-key="(row: MigrationStatus) => String(row.jobId)"
    :loading="loadingJobs"
    :empty-text="t('No migration jobs yet.')"
    :aria-label="t('Migration jobs')"
  >
    <template #cell-status="{ row }">
      <span class="kk-badge" :class="row.active ? 'kk-badge--warn' : 'kk-badge--ok'">{{ t(String(row.status || '—')) }}</span>
    </template>
    <template #cell-startedAt="{ row }">{{ timestamp(row.startedAt) }}</template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="selectJob(row)">{{ t("Details") }}</button>
      </div>
    </template>
  </M3DataTable>
</section>

  <section class="kk-surface-card" v-if="selected">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Job") }} {{ selected.jobId }}</h2>
    </div>

    <div class="kk-summary">
      <div v-for="entry in summaryEntries" :key="entry.label" class="kk-summary__item">
        <span class="kk-summary__label">{{ entry.label }}</span>
        <strong class="kk-summary__value">{{ entry.value }}</strong>
      </div>
    </div>

    <div class="kk-progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
      <div class="kk-progress__bar" :style="{ inlineSize: `${progress}%` }"></div>
    </div>
    <span class="kk-muted">{{ progress }}% {{ t("migrated") }}</span>

    <div class="kk-toolbar kk-action-bar">
      <button
        type="button"
        class="micl-button-outlined-s"
        :disabled="busy"
        @click="jobAction(selected.jobId, 'metadata/start')"
      >
        {{ t("Start metadata stage") }}
      </button>
      <button
        type="button"
        class="micl-button-outlined-s"
        :disabled="busy"
        @click="jobAction(selected.jobId, 'packages/start')"
      >
        {{ t("Start package stage") }}
      </button>
      <button
        type="button"
        class="micl-button-outlined-s"
        :disabled="busy"
        @click="jobAction(selected.jobId, 'packages/retry-failed')"
      >
        {{ t("Retry failed packages") }}
      </button>
    </div>

    <section class="kk-table-region">
<M3DataTable
      :columns="repoColumns"
      :rows="selected.repositoryJobs ?? []"
      :row-key="(row: RepositoryStatus, index?: number) => `${row.id ?? row.sourceRepositoryName ?? index}`"
      :empty-text="t('No repositories in this job.')"
      :aria-label="t('Job repositories')"
    >
      <template #cell-sourceRepositoryName="{ row }">{{ row.sourceRepositoryName || "—" }}</template>
      <template #cell-targetRepositoryName="{ row }">{{ row.targetRepositoryName || "—" }}</template>
      <template #cell-format="{ row }">{{ row.format || "—" }}</template>
      <template #cell-status="{ row }">
        <span class="kk-badge" :class="row.status === 'COMPLETED' ? 'kk-badge--ok' : 'kk-badge--warn'">
          {{ t(String(row.status || '—')) }}
        </span>
        <small v-if="row.lastError" class="kk-secondary" :title="row.lastError">{{ row.lastError }}</small>
      </template>
      <template #cell-totalAssets="{ row }">{{ row.totalAssets ?? 0 }}</template>
      <template #cell-migratedAssets="{ row }">{{ row.migratedAssets ?? 0 }}</template>
      <template #cell-failedAssets="{ row }">{{ row.failedAssets ?? 0 }}</template>
      <template #cell-pendingAssets="{ row }">{{ row.pendingAssets ?? 0 }}</template>
    </M3DataTable>
</section>
  </section>
</div>
</template>
