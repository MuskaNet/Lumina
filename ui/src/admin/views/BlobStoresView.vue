<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { formatInventoryBytes, inventoryValue, type InventorySnapshot } from "../../shared/inventory";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn, type DataTableSort } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";

interface BlobStore {
  id?: number | null;
  name: string;
  type?: string;
  engine?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  path?: string;
  resolvedPath?: string;
  credentialSource?: string;
  accessKey?: string;
  secretKey?: string;
  pathStyleAccess?: boolean;
  bucketExists?: boolean;
  configured?: boolean;
}

interface BlobStoreHealth {
  status: string;
  tone: "ok" | "warn" | "bad" | "checking";
  message: string;
}

const stores = ref<BlobStore[]>([]);
const usage = ref<InventorySnapshot | null | undefined>(undefined);
const health = reactive<Record<string, BlobStoreHealth>>({});
const filter = ref("");
const sort = ref<DataTableSort>({ key: "name", direction: "asc" });
const loading = ref(true);
const saving = ref(false);

const ENGINES = [
  { value: "aws-s3", label: "AWS S3 SDK" },
  { value: "oss-native", label: "OSS Native SDK" },
  { value: "file", label: "File" },
];

const columns: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true, cellClass: "kk-col-name" },
  { key: "engine", label: "Engine / Type", cellClass: "kk-col-engine" },
  { key: "health", label: "Health", cellClass: "kk-col-health" },
  { key: "blobCount", label: "Blob Count", sortable: true, align: "end" },
  { key: "totalBytes", label: "Stored size", sortable: true, align: "end" },
  { key: "pendingDeletionBytes", label: "Pending cleanup", sortable: true, align: "end" },
  { key: "location", label: "Storage location", cellClass: "kk-col-location" },
  { key: "actions", label: "Actions", align: "end" },
];

function isFileStore(store: BlobStore): boolean {
  return (store.engine || "").toLowerCase() === "file" || (store.type || "").toLowerCase() === "file";
}

function engineLabel(engine?: string): string {
  if (engine === "file") return "File";
  if (engine === "oss-native") return "OSS Native SDK";
  return "AWS S3 SDK";
}

/** Secondary location line; omitted when it would repeat the primary value. */
function locationDetail(store: BlobStore): string {
  if (isFileStore(store)) {
    return store.resolvedPath && store.resolvedPath !== store.path ? store.resolvedPath : "";
  }
  return [store.endpoint, store.prefix].filter(Boolean).join(" / ");
}

function storeHealth(store: BlobStore): BlobStoreHealth {
  const known = health[String(store.id)];
  if (known) return known;
  if (store.id == null) {
    return { status: "Not saved", tone: "warn", message: "Persist configuration before checking." };
  }
  return { status: "Checking", tone: "checking", message: "Running health check..." };
}

function sortValue(store: BlobStore, key: string): string | bigint | null {
  if (key === "name") return store.name ?? "";
  return inventoryValue(usage.value, store.id ?? "", key);
}

const filtered = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return stores.value;
  return stores.value.filter((store) => {
    const state = storeHealth(store);
    return [
      store.name,
      store.type,
      store.engine,
      state.status,
      state.message,
      store.bucket,
      store.prefix,
      store.endpoint,
      store.path,
      store.resolvedPath,
      store.pathStyleAccess ? "path style" : "virtual host",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
});

const rows = computed(() => {
  const direction = sort.value.direction === "asc" ? 1 : -1;
  return [...filtered.value].sort((left, right) => {
    const a = sortValue(left, sort.value.key);
    const b = sortValue(right, sort.value.key);
    if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
    const primary = typeof a === "bigint" || typeof b === "bigint"
      ? compareBigInt(BigInt(a), BigInt(b))
      : a.localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    const fallback = (left.name || "").localeCompare(right.name || "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return direction * (primary || fallback);
  });
});

function compareBigInt(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const totals = computed(() => {
  if (usage.value === undefined) return undefined;
  if (usage.value === null) return null;
  const keys = ["blobCount", "totalBytes", "pendingDeletionBytes"] as const;
  const sums: Record<string, bigint | null> = {};
  for (const key of keys) {
    const values = filtered.value.map((store) => inventoryValue(usage.value, store.id ?? "", key));
    sums[key] = values.some((value) => value == null) ? null : values.reduce<bigint>((a, b) => a + (b ?? 0n), 0n);
  }
  const anyUnknown = filtered.value.some(
    (store) => (inventoryValue(usage.value, store.id ?? "", "unknownSizeCount") ?? 0n) > 0n,
  );
  sums.unknownSizeCount = anyUnknown ? 1n : 0n;
  return sums;
});

const totalSnapshot = computed<InventorySnapshot | null | undefined>(() => {
  if (totals.value === undefined) return undefined;
  if (totals.value === null) return null;
  return { usage: { all: totals.value } };
});

const updatedLabel = computed(() => {
  if (usage.value === undefined) return t("Loading usage…");
  if (usage.value === null) return t("Usage unavailable. Refresh to retry.");
  const calculatedAt = usage.value.calculatedAt;
  if (!calculatedAt) return "—";
  const date = new Date(calculatedAt);
  return Number.isNaN(date.getTime()) ? calculatedAt : date.toLocaleString();
});

function metric(key: string, bytes = false): string {
  const snapshot = totalSnapshot.value;
  if (snapshot === undefined) return "…";
  const value = inventoryValue(snapshot, "all", key);
  if (value == null) return "—";
  return bytes ? formatInventoryBytes(value) : value.toLocaleString();
}

function storeMetric(store: BlobStore, key: string, bytes = false): string {
  if (usage.value === undefined) return "…";
  const value = inventoryValue(usage.value, store.id ?? "", key);
  if (value == null) return "—";
  if (bytes && key === "totalBytes" && (inventoryValue(usage.value, store.id ?? "", "unknownSizeCount") ?? 0n) > 0n) {
    return `≥ ${formatInventoryBytes(value)}`;
  }
  return bytes ? formatInventoryBytes(value) : value.toLocaleString();
}

async function refresh(options: { autoCheck?: boolean } = {}) {
  loading.value = true;
  usage.value = undefined;
  try {
    const payload = await api.get<{ stores?: BlobStore[] }>("/internal/blob-stores");
    stores.value = payload.stores ?? [];
    if (stores.value.length === 0) {
      usage.value = { usage: {}, calculatedAt: new Date().toISOString() };
    } else {
      void api
        .getOrNull<InventorySnapshot>("/internal/blob-stores/statistics/usage")
        .then((snapshot) => {
          usage.value = snapshot;
        });
    }
    if (options.autoCheck) {
      for (const store of stores.value) {
        if (store.id != null) void runCheck(store, false);
      }
    }
  } catch (error) {
    stores.value = [];
    usage.value = null;
    showToast(`${t("Failed to load blob stores")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function runCheck(store: BlobStore, notify = true) {
  if (store.id == null) return false;
  const key = String(store.id);
  health[key] = { status: "Checking", tone: "checking", message: "Running health check..." };
  if (notify) showToast(`${t("Checking")} ${store.name}...`);
  try {
    const result = await api.send<{ ok?: boolean; message?: string; summary?: Record<string, unknown> }>(
      `/internal/blob-stores/${encodeURIComponent(String(store.id))}/check`,
      "POST",
    );
    const summary = (result?.summary ?? {}) as { bucketExists?: boolean; message?: string };
    health[key] = result?.ok
      ? { status: "Healthy", tone: "ok", message: result?.message || summary.message || "Read/write check passed." }
      : {
          status: summary.bucketExists === false ? "Missing" : "Failed",
          tone: summary.bucketExists === false ? "warn" : "bad",
          message: result?.message || summary.message || "Health check failed.",
        };
    stores.value = stores.value.map((item) =>
      String(item.id) === key ? { ...item, bucketExists: Boolean(summary.bucketExists) } : item,
    );
    if (notify) {
      showToast(result?.message || t("Blob store check completed."), result?.ok ? "ok" : "error");
    }
    return Boolean(result?.ok);
  } catch (error) {
    health[key] = { status: "Failed", tone: "bad", message: (error as Error).message };
    if (notify) showToast(`${t("Check failed")}: ${(error as Error).message}`, "error");
    return false;
  }
}

async function copyLocation(value?: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showToast(t("Copied to clipboard."), "ok");
  } catch {
    showToast(t("Could not copy to clipboard."), "error");
  }
}

/* ---- Create / edit ----------------------------------------------------- */

const formOpen = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({
  name: "",
  engine: "aws-s3",
  endpoint: "",
  region: "",
  bucket: "",
  prefix: "",
  path: "",
  credentialSource: "default",
  accessKey: "",
  secretKey: "",
  pathStyleAccess: true,
});
const formDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const formError = ref("");

const isFileEngine = computed(() => form.engine === "file");
const isS3Engine = computed(() => !isFileEngine.value);
const credentialSource = computed(() => (form.engine === "aws-s3" ? form.credentialSource : "static"));
const showStaticCredentials = computed(() => isS3Engine.value && credentialSource.value === "static");

function resetForm() {
  Object.assign(form, {
    name: "",
    engine: "aws-s3",
    endpoint: "",
    region: "",
    bucket: "",
    prefix: "",
    path: "",
    credentialSource: "default",
    accessKey: "",
    secretKey: "",
    pathStyleAccess: true,
  });
  formError.value = "";
}

function openCreate() {
  resetForm();
  editingId.value = null;
  formOpen.value = true;
  formDialog.value?.open();
}

function openEdit(store: BlobStore) {
  resetForm();
  editingId.value = store.id ?? null;
  Object.assign(form, {
    name: store.name ?? "",
    engine: store.engine || (isFileStore(store) ? "file" : "aws-s3"),
    endpoint: store.endpoint ?? "",
    region: store.region ?? "",
    bucket: store.bucket ?? "",
    prefix: store.prefix ?? "",
    path: store.path ?? "",
    credentialSource: store.credentialSource || "default",
    accessKey: store.accessKey ?? "",
    secretKey: store.secretKey ?? "",
    pathStyleAccess: store.pathStyleAccess ?? true,
  });
  formOpen.value = true;
  formDialog.value?.open();
}

function closeForm() {
  formOpen.value = false;
  formDialog.value?.close();
}

function validate(): string {
  if (!form.name.trim()) return t("Name is required.");
  if (isS3Engine.value) {
    if (!form.endpoint.trim()) return t("Endpoint is required.");
    if (!form.region.trim()) return t("Region is required.");
    if (!form.bucket.trim()) return t("Bucket is required.");
    if (showStaticCredentials.value) {
      if (!form.accessKey.trim()) return t("Access key is required.");
      if (!form.secretKey) return t("Secret key is required.");
    }
  } else if (!form.path.trim()) {
    return t("Path is required.");
  }
  return "";
}

async function save() {
  const problem = validate();
  if (problem) {
    formError.value = problem;
    return;
  }
  if (editingId.value == null && stores.value.some((store) => store.name === form.name.trim())) {
    formError.value = t("Blob store name already exists.");
    return;
  }
  saving.value = true;
  formError.value = "";
  const payload = {
    name: form.name.trim(),
    type: isFileEngine.value ? "file" : "s3",
    engine: form.engine,
    endpoint: isFileEngine.value ? "" : form.endpoint.trim(),
    region: isFileEngine.value ? "" : form.region.trim(),
    bucket: isFileEngine.value ? "" : form.bucket.trim(),
    prefix: isFileEngine.value ? "" : form.prefix.trim(),
    path: form.path.trim(),
    credentialSource: credentialSource.value,
    accessKey: credentialSource.value === "static" ? form.accessKey.trim() : "",
    secretKey: credentialSource.value === "static" ? form.secretKey : "",
    pathStyleAccess: form.pathStyleAccess,
  };
  const path = editingId.value == null
    ? "/internal/blob-stores"
    : `/internal/blob-stores/${encodeURIComponent(String(editingId.value))}`;
  try {
    await api.send(path, editingId.value == null ? "POST" : "PUT", payload);
    showToast(editingId.value == null ? t("Blob store created.") : t("Blob store updated."), "ok");
    closeForm();
    await refresh();
  } catch (error) {
    formError.value = (error as Error).message;
  } finally {
    saving.value = false;
  }
}

/* ---- Delete ------------------------------------------------------------ */

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<BlobStore | null>(null);
const deleting = ref(false);

function askDelete(store: BlobStore) {
  deleteTarget.value = store;
  deleteDialog.value?.open();
}

function cancelDelete() {
  deleteTarget.value = null;
  deleteDialog.value?.close();
}

async function confirmDelete() {
  const store = deleteTarget.value;
  if (!store) return;
  deleting.value = true;
  try {
    await api.delete(`/internal/blob-stores/${encodeURIComponent(String(store.id))}`);
    showToast(`${t("Blob store")} ${store.name} ${t("deleted.")}`, "ok");
    cancelDelete();
    await refresh();
  } catch (error) {
    showToast(`${t("Delete failed")}: ${(error as Error).message}`, "error");
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void refresh({ autoCheck: true });
});
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create blob store") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="refresh({ autoCheck: false })">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Refresh") }}
    </button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="blobstore-filter">{{ t("Filter") }}</label>
      <input id="blobstore-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    </div>
  </div>

  <div class="kk-summary" aria-live="polite">
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Updated") }}</span>
      <strong class="kk-summary__value">{{ updatedLabel }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Matching blob stores") }}</span>
      <strong class="kk-summary__value">{{ filtered.length.toLocaleString() }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Blob Count") }}</span>
      <strong class="kk-summary__value">{{ metric("blobCount") }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Stored blob size") }}</span>
      <strong class="kk-summary__value">{{ metric("totalBytes", true) }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Pending cleanup") }}</span>
      <strong class="kk-summary__value">{{ metric("pendingDeletionBytes", true) }}</strong>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">database</span></span>
      <h2 class="kk-card-header__title">{{ t("Blob stores") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: BlobStore) => String(row.id ?? row.name)"
    :sort="sort"
    :loading="loading"
    :empty-text="t('No blob stores found.')"
    :aria-label="t('Blob stores')"
    @update:sort="sort = $event"
  >
    <template #cell-name="{ row }">
      <span class="kk-cell-name">{{ row.name }}</span>
    </template>

    <template #cell-engine="{ row }">
      {{ t(engineLabel(row.engine)) }}
      <small v-if="!isFileStore(row)" class="kk-secondary">{{ row.type }}</small>
    </template>

    <template #cell-health="{ row }">
      <span class="kk-badge" :class="`kk-badge--${storeHealth(row).tone}`">{{ t(storeHealth(row).status) }}</span>
      <small v-if="storeHealth(row).message" class="kk-secondary" :title="t(storeHealth(row).message)">
        {{ t(storeHealth(row).message) }}
      </small>
    </template>

    <template #cell-blobCount="{ row }">{{ storeMetric(row, "blobCount") }}</template>

    <template #cell-totalBytes="{ row }">{{ storeMetric(row, "totalBytes", true) }}</template>

    <template #cell-pendingDeletionBytes="{ row }">
      {{ storeMetric(row, "pendingDeletionBytes", true) }}
      <small class="kk-secondary">
        {{ storeMetric(row, "pendingDeletionCount") }} {{ t("blobs") }}
      </small>
    </template>

    <template #cell-location="{ row }">
      <button type="button" class="kk-location" :title="t('Copy storage location')" @click="copyLocation(isFileStore(row) ? row.path : row.bucket)">
        <span class="kk-mono">{{ isFileStore(row) ? row.path : row.bucket }}</span>
      </button>
      <small v-if="locationDetail(row)" class="kk-secondary kk-mono">{{ locationDetail(row) }}</small>
      <small v-if="!isFileStore(row)" class="kk-secondary">
        {{ row.pathStyleAccess ? t("Path style") : t("Virtual host") }}
      </small>
    </template>

    <template #cell-actions="{ row }">
      <div v-if="row.id != null" class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" @click="runCheck(row)">{{ t("Check") }}</button>
        <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
      </div>
      <span v-else class="kk-muted">—</span>
    </template>
  </M3DataTable>
</section>

  <!-- Create / edit -->
  <M3Dialog
    ref="formDialog"
    wide
    :title="editingId == null ? t('Create blob store') : t('Edit blob store')"
    :subtitle="t('Blob storage holds every artifact payload; metadata stays in the database.')"
    :confirm-label="editingId == null ? t('Create blob store') : t('Save blob store')"
    :busy="saving"
    :error="formError"
    @confirm="save"
    @cancel="closeForm"
  >
    <div class="kk-settings-page"><section class="kk-surface-card">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Settings") }}</h2>
    </div>
<div class="kk-field-grid">
      <div class="micl-textfield-outlined">
        <label for="blobstore-name">{{ t("Name") }}</label>
        <input id="blobstore-name" v-model="form.name" type="text" autocomplete="off" required>
      </div>

      <div class="micl-textfield-outlined">
        <label for="blobstore-engine">{{ t("Engine") }}</label>
        <select id="blobstore-engine" v-model="form.engine">
          <option v-for="engine in ENGINES" :key="engine.value" :value="engine.value">
            {{ t(engine.label) }}
          </option>
        </select>
      </div>

      <template v-if="isS3Engine">
        <div class="micl-textfield-outlined">
          <label for="blobstore-endpoint">{{ t("Endpoint") }}</label>
          <input id="blobstore-endpoint" v-model="form.endpoint" type="url" required>
        </div>
        <div class="micl-textfield-outlined">
          <label for="blobstore-region">{{ t("Region") }}</label>
          <input id="blobstore-region" v-model="form.region" type="text" required>
        </div>
        <div class="micl-textfield-outlined">
          <label for="blobstore-bucket">{{ t("Bucket") }}</label>
          <input id="blobstore-bucket" v-model="form.bucket" type="text" required>
        </div>
        <div class="micl-textfield-outlined">
          <label for="blobstore-prefix">{{ t("Prefix") }}</label>
          <input id="blobstore-prefix" v-model="form.prefix" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="blobstore-credential-source">{{ t("Credentials") }}</label>
          <select id="blobstore-credential-source" v-model="form.credentialSource">
            <option value="default">{{ t("Default AWS credentials") }}</option>
            <option value="static">{{ t("Static access key / secret key") }}</option>
          </select>
        </div>
      </template>

      <div v-else class="micl-textfield-outlined">
        <label for="blobstore-path">{{ t("Path") }}</label>
        <input id="blobstore-path" v-model="form.path" type="text" autocomplete="off" required>
      </div>

      <template v-if="showStaticCredentials">
        <div class="micl-textfield-outlined">
          <label for="blobstore-access-key">{{ t("Access key") }}</label>
          <input id="blobstore-access-key" v-model="form.accessKey" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="blobstore-secret-key">{{ t("Secret key") }}</label>
          <input id="blobstore-secret-key" v-model="form.secretKey" type="password" autocomplete="new-password">
        </div>
      </template>
    </div>
</section>

    <label v-if="isS3Engine" class="kk-switch-row">
      <input v-model="form.pathStyleAccess" class="micl-switch" type="checkbox" role="switch">
      <span>{{ t("Path style access") }}</span>
    </label></div>
  </M3Dialog>

  <!-- Delete confirmation -->
  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete blob store?')"
    :subtitle="t('This removes the configuration only. Storage files and buckets are not deleted.')"
    :confirm-label="t('Delete')"
    :busy="deleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete") }} <strong class="kk-mono">{{ deleteTarget?.name }}</strong>?
    </p></div>
  </M3Dialog>
</div>
</template>

