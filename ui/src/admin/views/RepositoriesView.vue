<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { formatInventoryBytes, inventoryValue, type InventorySnapshot } from "../../shared/inventory";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn, type DataTableSort } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import RepositoryRecipeCombobox from "../components/RepositoryRecipeCombobox.vue";
import {
  ALPINE_METADATA_MODES,
  ALPINE_SIGNATURE_TYPES,
  APT_METADATA_MODES,
  LAYOUT_POLICIES,
  VERSION_POLICIES,
  WRITE_POLICIES,
  applyRecipeDefaults,
  buildRepositoryPayload,
  createRepositoryDraft,
  firstAlpineNamespace,
  repositoryDraftFromView,
  type RepositoryDraft,
  type RepositoryViewLike,
} from "../repositoryForm";
import MemberTransferPicker from "../components/MemberTransferPicker.vue";
import {
  selectMemberCandidates,
} from "../repositoryMembers";
import { buildRecipeOptions, type RecipeOption } from "../repositoryRecipes";
import {
  formatAlpineStatus,
  formatAptStatus,
  formatConanStatus,
  type AlpineStatus,
  type AptStatus,
  type ConanRepositoryStatus,
} from "../repositoryStatus";
import { repositoryClientUrl } from "../../browse/repositoryUrls";
import { formatLogoClass, typeIconName } from "../repositoryIcons";

interface Recipe {
  recipe?: string;
  name?: string;
  format?: string;
  type?: string;
}

type Repository = RepositoryViewLike;

interface BlobStoreList {
  stores?: { name: string }[];
}

interface RoutingRuleOption {
  name: string;
  mode?: string;
}

const routingRules = ref<RoutingRuleOption[]>([]);
const repositories = ref<Repository[]>([]);
const recipes = ref<Recipe[]>([]);
const blobStores = ref<{ name: string }[]>([]);
const usage = ref<InventorySnapshot | null | undefined>(undefined);
const filter = ref("");
const blobStoreFilter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const columns: DataTableColumn[] = [
  { key: "icon", label: "" },
  { key: "name", label: "Name", sortable: true },
  { key: "recipe", label: "Recipe", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "format", label: "Format", sortable: true },
  { key: "online", label: "Status" },
  { key: "blobStoreName", label: "Blob store" },
  { key: "assetCount", label: "Asset Count", sortable: true, align: "end" },
  { key: "totalBytes", label: "Logical asset size", sortable: true, align: "end" },
  { key: "url", label: "URL", cellClass: "kk-col-location" },
  { key: "actions", label: "Actions", align: "end" },
];

const availableBlobStoreNames = computed(() => {
  const names = new Set<string>();
  for (const repo of repositories.value) {
    if (repo.blobStoreName) names.add(repo.blobStoreName);
  }
  for (const store of blobStores.value) {
    if (store.name) names.add(store.name);
  }
  return [...names].sort();
});

const filteredRepositories = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  const selectedStore = blobStoreFilter.value;
  return repositories.value.filter((repo) => {
    if (selectedStore && repo.blobStoreName !== selectedStore) return false;
    if (!needle) return true;
    return [repo.name, repo.format, repo.type, repo.recipe, repo.blobStoreName, repositoryClientUrl(repo)]
      .some((value) => String(value ?? "").toLowerCase().includes(needle));
  });
});

const sort = ref<DataTableSort>({ key: "name", direction: "asc" });

const rows = computed(() => {
  const { key, direction } = sort.value;
  const numeric = key === "assetCount" || key === "totalBytes";
  return [...filteredRepositories.value].sort((a, b) => {
    let comparison: number;
    if (numeric) {
      const left = String(a.type).toLowerCase() === "group" ? null : inventoryValue(usage.value, a.id ?? "", key);
      const right = String(b.type).toLowerCase() === "group" ? null : inventoryValue(usage.value, b.id ?? "", key);
      if (left == null || right == null) {
        if (left == null && right != null) return 1;
        if (left != null && right == null) return -1;
        comparison = 0;
      } else {
        comparison = left < right ? -1 : left > right ? 1 : 0;
      }
    } else {
      comparison = String(a[key as keyof Repository] ?? "").localeCompare(String(b[key as keyof Repository] ?? ""));
    }
    return comparison === 0 ? a.name.localeCompare(b.name) : comparison * (direction === "asc" ? 1 : -1);
  });
});

const usageRows = computed(() =>
  filteredRepositories.value.filter((repo) => String(repo.type ?? "").toLowerCase() !== "group"),
);

const totals = computed(() => {
  if (usage.value === undefined) return undefined;
  if (usage.value === null) return null;
  const keys = ["assetCount", "totalBytes"] as const;
  const sums: Record<string, bigint | null> = {};
  for (const key of keys) {
    const values = usageRows.value.map((repo) => inventoryValue(usage.value, repo.id ?? "", key));
    sums[key] = values.some((value) => value == null) ? null : values.reduce<bigint>((a, b) => a + (b ?? 0n), 0n);
  }
  const anyUnknown = usageRows.value.some(
    (repo) => (inventoryValue(usage.value, repo.id ?? "", "unknownSizeCount") ?? 0n) > 0n,
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
  if (usage.value === null) return "—";
  const calculatedAt = usage.value.calculatedAt;
  if (!calculatedAt) return "—";
  const date = new Date(calculatedAt);
  return Number.isNaN(date.getTime()) ? calculatedAt : date.toLocaleTimeString();
});

function metric(key: string, bytes = false): string {
  const snapshot = totalSnapshot.value;
  if (snapshot === undefined) return "…";
  if (filteredRepositories.value.length > 0 && usageRows.value.length === 0) return "—";
  const value = inventoryValue(snapshot, "all", key);
  if (value == null) return "—";
  const unknownSize = bytes && key === "totalBytes" && (inventoryValue(snapshot, "all", "unknownSizeCount") ?? 0n) > 0n;
  return bytes ? `${unknownSize ? "≥ " : ""}${formatInventoryBytes(value)}` : value.toLocaleString();
}

function repoMetric(repo: Repository, key: string, bytes = false): string {
  if (String(repo.type ?? "").toLowerCase() === "group") return "—";
  if (usage.value === undefined) return "…";
  const value = inventoryValue(usage.value, repo.id ?? "", key);
  if (value == null) return "—";
  if (bytes && key === "totalBytes" && (inventoryValue(usage.value, repo.id ?? "", "unknownSizeCount") ?? 0n) > 0n) {
    return `≥ ${formatInventoryBytes(value)}`;
  }
  return bytes ? formatInventoryBytes(value) : value.toLocaleString();
}

async function load() {
  loading.value = true;
  usage.value = undefined;
  try {
    const [repos, recipeList, stores, routingRuleList] = await Promise.all([
      api.get<Repository[]>("/internal/repositories?purpose=admin"),
      api.getOrNull<Recipe[]>("/internal/repositories/recipes"),
      api.getOrNull<BlobStoreList>("/internal/blob-stores"),
      api.getOrNull<RoutingRuleOption[]>("/service/rest/v1/routing-rules"),
    ]);
    repositories.value = repos ?? [];
    recipes.value = recipeList ?? [];
    blobStores.value = stores?.stores ?? [];
    routingRules.value = routingRuleList ?? [];
    if (repositories.value.length === 0) {
      usage.value = { usage: {}, calculatedAt: new Date().toISOString() };
    } else {
      void api
        .getOrNull<InventorySnapshot>("/internal/repositories/statistics/usage")
        .then((snapshot) => {
          usage.value = snapshot;
        });
    }
  } catch (cause) {
    showToast(`${t("Failed to load repositories")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const recipeOptions = computed<RecipeOption[]>(() => buildRecipeOptions(recipes.value));

/* ---- Dialog state ------------------------------------------------------ */

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<Repository | null>(null);

const draft = reactive<RepositoryDraft>(createRepositoryDraft());

const selectedRecipe = computed(() =>
  recipeOptions.value.find((option) => option.value === String(draft.recipe)),
);

const draftFormat = computed(
  () => String(editing.value?.format ?? selectedRecipe.value?.format ?? ""),
);
const draftType = computed(() =>
  String(editing.value?.type ?? selectedRecipe.value?.type ?? "").toUpperCase(),
);

const isHosted = computed(() => draftType.value === "HOSTED");
const isProxy = computed(() => draftType.value === "PROXY");
const isGroup = computed(() => draftType.value === "GROUP");

/** NTLM upstream authentication is only supported for NuGet proxies. */
const ntlmAvailable = computed(() => draftFormat.value === "nuget" && isProxy.value);
const ntlmSelected = computed(
  () => ntlmAvailable.value && draft.remoteAuthenticationType === "ntlm",
);
const aptHosted = computed(() => draftFormat.value === "apt" && isHosted.value);
const aptProxy = computed(() => draftFormat.value === "apt" && isProxy.value);
/** Valid-Until/Origin/Label only take effect on locally signed APT metadata. */
const aptLocallySigned = computed(
  () => aptHosted.value || (aptProxy.value && !draft.aptFlat && draft.aptMetadataMode === "RESIGN"),
);
const alpineProxy = computed(() => draftFormat.value === "alpine" && isProxy.value);
const alpineResignProxy = computed(
  () => alpineProxy.value && draft.alpineMetadataMode === "RESIGN",
);
const pypiIndexVisible = computed(() => draftFormat.value === "pypi" && isProxy.value);
const minimumReleaseAgeVisible = computed(
  () => draftFormat.value === "npm" && isProxy.value,
);
const swiftProxyNote = computed(() => draftFormat.value === "swift" && isProxy.value);
const savedPasswordPlaceholder = computed(() =>
  editing.value?.proxy?.remotePasswordConfigured ? t("Saved password unchanged") : "",
);
const savedBearerTokenPlaceholder = computed(() =>
  editing.value?.proxy?.remoteBearerTokenConfigured ? t("Saved bearer token unchanged") : "",
);
const savedOutboundPasswordPlaceholder = computed(() =>
  editing.value?.proxy?.outboundProxyPasswordConfigured ? t("Saved proxy password unchanged") : "",
);

/* ---- Group member transfer --------------------------------------------- */

const memberNames = computed<string[]>({
  get: () => draft.memberText
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean),
  set: (names) => { draft.memberText = names.join("\n"); },
});

const memberCandidates = computed(() =>
  selectMemberCandidates(repositories.value, draftFormat.value, editing.value?.name ?? ""),
);

function resetMemberTransfer() {
  // The reusable picker owns filter and selection state.
}

// A recipe change (create mode only) can invalidate selected members: the server
// only accepts members of the group's own format and rejects nested groups for
// most formats, so prune the stale entries instead of failing on save.
watch(draftFormat, () => {
  resetMemberTransfer();
  if (editing.value) return;
  const valid = new Set(memberCandidates.value.map((repo) => repo.name));
  memberNames.value = memberNames.value.filter((name) => valid.has(name));
});

/* ---- Conan status ------------------------------------------------------ */

const conanStatusText = ref("");
const conanStatusBusy = ref(false);

async function loadConanStatus() {
  const repo = editing.value;
  if (!repo) return;
  conanStatusBusy.value = true;
  conanStatusText.value = t("Loading status…");
  try {
    const status = await api.get<ConanRepositoryStatus>(
      `/internal/repositories/${encodeURIComponent(repo.name)}/conan/status`,
    );
    conanStatusText.value = formatConanStatus(status);
  } catch (cause) {
    conanStatusText.value = `${t("Conan status unavailable.")} ${(cause as Error).message}`;
  } finally {
    conanStatusBusy.value = false;
  }
}

const alpinePublicKeyHref = computed(() =>
  editing.value
    ? `/internal/repositories/${encodeURIComponent(editing.value.name)}/alpine/public-key`
    : "",
);

const showFormatSettings = computed(() => {
  switch (draftFormat.value) {
    case "conan":
      return !isGroup.value;
    case "apt":
    case "alpine":
    case "docker":
    case "cargo":
    case "raw":
      return true;
    default:
      return false;
  }
});
const showSigningSettings = computed(
  () => Boolean(editing.value)
    && ((draftFormat.value === "apt" && !isGroup.value) || draftFormat.value === "alpine"),
);

watch(
  () => draft.recipe,
  () => {
    if (editing.value) return;
    applyRecipeDefaults(draft, draftFormat.value, draftType.value);
  },
);

watch(
  () => draft.aptFlat,
  (flat) => {
    if (aptProxy.value && flat) draft.aptMetadataMode = "PASSTHROUGH";
  },
);

watch(
  () => draft.alpineMetadataMode,
  (mode) => {
    if (alpineProxy.value && mode === "RESIGN") draft.alpineVerifyUpstreamSignatures = true;
  },
);

/** Git LFS relies on exact content types, so strict validation is unavailable. */
const strictDisabled = computed(() => draftFormat.value === "gitlfs");

watch(strictDisabled, (disabled) => {
  if (disabled) draft.strictContentTypeValidation = false;
});

function listFromText(value: unknown): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function openCreate() {
  editing.value = null;
  const recipe = recipeOptions.value[0];
  Object.assign(draft, createRepositoryDraft(recipe, blobStores.value[0]?.name ?? ""));
  applyRecipeDefaults(draft, recipe?.format ?? "", recipe?.type ?? "");
  resetMemberTransfer();
  conanStatusText.value = "";
  statusText.value = "";
  error.value = "";
  dialog.value?.open();
}

function openEdit(repo: Repository) {
  editing.value = repo;
  Object.assign(draft, repositoryDraftFromView(repo));
  resetMemberTransfer();
  conanStatusText.value = "";
  statusText.value = "";
  if (String(repo.format ?? "") === "conan") void loadConanStatus();
  if (showSigningSettings.value) void loadSigningStatus();
  error.value = "";
  dialog.value?.open();
}

function buildPayload(creating: boolean): Record<string, unknown> {
  return buildRepositoryPayload(draft, draftFormat.value, draftType.value, creating);
}

async function save() {
  if (!editing.value && !draft.name.trim()) {
    error.value = t("Repository name is required.");
    return;
  }
  if (isProxy.value && !draft.remoteUrl.trim()) {
    error.value = t("Remote URL is required for proxy repositories.");
    return;
  }
  if (aptHosted.value && !draft.aptDistribution.trim()) {
    error.value = t("APT distribution is required for hosted repositories.");
    return;
  }
  if (
    draftFormat.value === "docker"
    && draft.dockerConnectorEnabled
    && (draft.dockerConnectorPort === null || draft.dockerConnectorPort === "")
  ) {
    error.value = t("Connector port is required when the Docker connector is enabled.");
    return;
  }
  if (
    alpineResignProxy.value
    && (!draft.alpineVerifyUpstreamSignatures || !draft.alpineUpstreamPublicKey.trim())
  ) {
    error.value = t("Alpine re-sign proxy requires signature verification and upstream public keys.");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    if (editing.value) {
      const payload = buildPayload(false);
      await api.send(`/internal/repositories/${encodeURIComponent(editing.value.name)}`, "PUT", payload);
      if (isGroup.value) {
        await api.send(
          `/internal/repositories/${encodeURIComponent(editing.value.name)}/members`,
          "PUT",
          { memberNames: listFromText(draft.memberText) },
        );
      }
    } else {
      await api.send("/internal/repositories", "POST", buildPayload(true));
    }
    showToast(t("Repository saved."), "ok");
    dialog.value?.close();
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

/* ---- Signing keys ------------------------------------------------------ */

const aptPrivateKey = ref("");
const aptPassphrase = ref("");
const alpinePrivateKey = ref("");
const statusText = ref("");

async function loadSigningStatus() {
  const repo = editing.value;
  if (!repo) return;
  statusText.value = t("Loading status…");
  try {
    if (draftFormat.value === "apt") {
      const status = await api.get<AptStatus>(
        `/internal/repositories/${encodeURIComponent(repo.name)}/apt/status`,
      );
      statusText.value = formatAptStatus(status);
    } else {
      const status = await api.get<AlpineStatus>(
        `/internal/repositories/${encodeURIComponent(repo.name)}/alpine/status`,
      );
      statusText.value = formatAlpineStatus(status);
    }
  } catch (cause) {
    statusText.value = (cause as Error).message;
  }
}

async function rebuildMetadata() {
  const repo = editing.value;
  if (!repo) return;
  busy.value = true;
  try {
    if (draftFormat.value === "apt") {
      await api.send(`/internal/repositories/${encodeURIComponent(repo.name)}/apt/rebuild`, "POST", {
        distribution: draft.aptDistribution.trim() || null,
      });
      showToast(t("APT metadata rebuild queued."), "ok");
    } else {
      const namespace = firstAlpineNamespace(draft);
      await api.send(`/internal/repositories/${encodeURIComponent(repo.name)}/alpine/rebuild`, "POST", {
        namespace,
      });
      showToast(`${t("Alpine index rebuild queued.")} ${namespace}`, "ok");
    }
    await loadSigningStatus();
  } catch (cause) {
    showToast(`${t("Rebuild failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

async function rotateSigningKey(generate: boolean) {
  const repo = editing.value;
  if (!repo) return;
  busy.value = true;
  try {
    if (draftFormat.value === "apt") {
      if (!generate && !aptPrivateKey.value.trim()) {
        error.value = t("Paste an ASCII-armored OpenPGP private key first.");
        return;
      }
      await api.send(`/internal/repositories/${encodeURIComponent(repo.name)}/apt/signing-key`, "PUT", {
        privateKey: generate ? null : aptPrivateKey.value.trim(),
        passphrase: aptPassphrase.value || null,
        generate,
      });
      aptPrivateKey.value = "";
      aptPassphrase.value = "";
    } else {
      if (!generate && !alpinePrivateKey.value.trim()) {
        error.value = t("Paste a PKCS#8 RSA private key first.");
        return;
      }
      await api.send(`/internal/repositories/${encodeURIComponent(repo.name)}/alpine/signing-key`, "PUT", {
        generate,
        privateKey: generate ? null : alpinePrivateKey.value.trim(),
        keyFilename: draft.alpineKeyFilename || null,
        signatureType: draft.alpineSignatureType,
      });
      alpinePrivateKey.value = "";
    }
    showToast(t("Signing key rotated."), "ok");
    error.value = "";
    await loadSigningStatus();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}

/* ---- Delete ------------------------------------------------------------ */

const deleteDialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const deleteTarget = ref<Repository | null>(null);

function askDelete(repo: Repository) {
  deleteTarget.value = repo;
  deleteDialog.value?.open();
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await api.delete(`/internal/repositories/${encodeURIComponent(target.name)}`);
    showToast(`${t("Repository")} ${target.name} ${t("deleted.")}`, "ok");
    deleteDialog.value?.close();
    await load();
  } catch (cause) {
    showToast(`${t("Delete failed")}: ${(cause as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

function typeLabel(repo: Repository): string {
  return String(repo.type ?? "").toLowerCase();
}

onMounted(load);
</script>

<template>
<div class="kk-settings-page">
<div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create repository") }}
    </button>
    <button type="button" class="micl-button-tonal-s" @click="load">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Refresh") }}
    </button>
    <div class="kk-toolbar__filters">
      <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="repo-filter">{{ t("Filter") }}</label>
      <input id="repo-filter" v-model="filter" type="search" autocomplete="off">
    </div>
      <div class="micl-textfield-outlined" style="min-inline-size: 14rem">
      <label for="repo-blobstore-filter">{{ t("Blob store") }}</label>
      <select id="repo-blobstore-filter" v-model="blobStoreFilter">
        <option value="">{{ t("All blob stores") }}</option>
        <option v-for="store in availableBlobStoreNames" :key="store" :value="store">{{ store }}</option>
      </select>
    </div>
    </div>
  </div>

  <div class="kk-summary" aria-live="polite">
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Updated") }}</span>
      <strong class="kk-summary__value">{{ updatedLabel }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Matching repositories") }}</span>
      <strong class="kk-summary__value">{{ filteredRepositories.length.toLocaleString() }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Asset Count") }}</span>
      <strong class="kk-summary__value">{{ metric("assetCount") }}</strong>
    </div>
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Logical asset size") }}</span>
      <strong class="kk-summary__value">{{ metric("totalBytes", true) }}</strong>
    </div>
  </div>

  <section class="kk-table-surface">
    <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">inventory_2</span></span>
      <h2 class="kk-card-header__title">{{ t("Repositories") }}</h2>
    </div>
<M3DataTable
    :columns="columns"
    :rows="rows"
    v-model:sort="sort"
    :row-key="(row: Repository) => row.name"
    :loading="loading"
    :empty-text="t('No repositories found.')"
    :aria-label="t('Repositories')"
  >
    <template #cell-icon="{ row }">
      <span class="material-symbols-outlined kk-format-icon" aria-hidden="true">{{ typeIconName(row.type) }}</span>
    </template>
    <template #cell-recipe="{ row }">
      {{ row.recipe }}
    </template>
    <template #cell-format="{ row }">
      <span class="format-cell">
        <span :class="formatLogoClass(row.format)" aria-hidden="true"></span>
        <span class="format-cell-label">{{ row.format }}</span>
      </span>
    </template>
    <template #cell-type="{ row }">
      <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-badge" :class="typeLabel(row) === 'group' ? 'kk-badge--warn' : 'kk-badge--ok'">
        {{ typeLabel(row) }}
      </span></span>
    </template>
    <template #cell-online="{ row }">
      <span class="micl-chips kk-chip-host"><span class="micl-chip-assist kk-badge" :class="row.online ? 'kk-badge--ok' : 'kk-badge--bad'">
        {{ row.online ? t("Online") : t("Offline") }}
      </span></span>
    </template>
    <template #cell-blobStoreName="{ row }">{{ row.blobStoreName || "—" }}</template>
    <template #cell-assetCount="{ row }">
      {{ repoMetric(row, "assetCount") }}
    </template>
    <template #cell-totalBytes="{ row }">
      {{ repoMetric(row, "totalBytes", true) }}
    </template>
    <template #cell-url="{ row }"><code class="kk-mono">{{ repositoryClientUrl(row) || "—" }}</code></template>
    <template #cell-actions="{ row }">
      <div class="micl-buttongroup kk-row-actions" role="group" :aria-label="t('Actions')">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>
</section>

  <M3Dialog
    ref="dialog"
    wide
    :title="editing ? `${t('Edit repository')} · ${editing.name}` : t('Create repository')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <div class="kk-settings-page">

    <!-- General -->
    <section class="kk-surface-card" data-repository-section="general">
      <div class="kk-card-header">
        <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
        <h2 class="kk-card-header__title">{{ t("General") }}</h2>
      </div>
      <div class="kk-field-grid kk-repository-general-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-name">{{ t("Name") }}</label>
          <input id="repo-name" v-model="draft.name" type="text" :readonly="Boolean(editing)" autocomplete="off">
        </div>
        <RepositoryRecipeCombobox
          v-model="draft.recipe"
          :options="recipeOptions"
          :disabled="Boolean(editing)"
          field-id="repo-recipe"
        />
        <div v-if="!editing" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-blobstore">{{ t("Blob store") }}</label>
          <select id="repo-blobstore" v-model="draft.blobStoreName">
            <option value="">{{ t("Default") }}</option>
            <option v-for="store in blobStores" :key="store.name" :value="store.name">{{ store.name }}</option>
          </select>
        </div>
      </div>
      <div class="kk-form-switches">
        <label class="kk-switch-row">
          <input v-model="draft.online" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Online") }}</span>
        </label>
        <label class="kk-switch-row">
          <input v-model="draft.strictContentTypeValidation" class="micl-switch" type="checkbox" role="switch" :disabled="strictDisabled">
          <span>{{ t("Strict content type validation") }}</span>
        </label>
      </div>
    </section>

    <!-- Hosted / proxy / group -->
    <section class="kk-surface-card" v-if="draftType !== ''" data-repository-section="behavior">
      <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ isHosted ? t("Hosted settings") : isProxy ? t("Proxy settings") : t("Group settings") }}</h2>
    </div>
      <div v-if="isHosted" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-write-policy">{{ t("Write policy") }}</label>
          <select id="repo-write-policy" v-model="draft.writePolicy">
            <option v-for="policy in WRITE_POLICIES" :key="policy.value" :value="policy.value">
              {{ t(policy.label) }}
            </option>
          </select>
        </div>
        <template v-if="draftFormat === 'maven2'">
          <div class="micl-textfield-outlined">
            <label for="repo-version-policy">{{ t("Version policy") }}</label>
            <select id="repo-version-policy" v-model="draft.versionPolicy">
              <option v-for="policy in VERSION_POLICIES" :key="policy.value" :value="policy.value">
                {{ t(policy.label) }}
              </option>
            </select>
          </div>
          <div class="micl-textfield-outlined">
            <label for="repo-layout-policy">{{ t("Layout policy") }}</label>
            <select id="repo-layout-policy" v-model="draft.layoutPolicy">
              <option v-for="policy in LAYOUT_POLICIES" :key="policy.value" :value="policy.value">
                {{ t(policy.label) }}
              </option>
            </select>
          </div>
        </template>
        <div v-if="draftFormat === 'yum'" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-yum-depth">{{ t("Repodata Depth") }}</label>
          <input id="repo-yum-depth" v-model.number="draft.yumRepodataDepth" type="number" min="0" step="1">
          <small class="kk-hint">{{ t("0 generates metadata at the repository root; 1 uses folders such as fedora-45. Changing the depth rebuilds metadata.") }}</small>
        </div>
      </div>

      <div v-else-if="isProxy" class="kk-field-grid">
        <p v-if="swiftProxyNote" class="kk-hint kk-field--wide">
          {{ t("Swift proxy follows the Nexus-compatible GitHub source mode. The remote is fixed to https://github.com/; use the username/token fields for private GitHub repositories. Production SwiftPM clients should always connect to Lumina over HTTPS.") }}
        </p>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-remote-url">{{ t("Remote URL") }}</label>
          <input id="repo-remote-url" v-model="draft.remoteUrl" type="url" autocomplete="off" :readonly="draftFormat === 'swift'">
        </div>
        <div v-if="isProxy && routingRules.length" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-routing-rule">{{ t("Routing Rule") }}</label>
          <select id="repo-routing-rule" v-model="draft.routingRuleName">
            <option value="">{{ t("None") }}</option>
            <option v-for="rule in routingRules" :key="rule.name" :value="rule.name">{{ rule.name }}</option>
          </select>
          <small class="kk-hint">{{ t("Optional rule that controls which remote paths this repository may access.") }}</small>
        </div>
        <div v-if="pypiIndexVisible" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-pypi-index">{{ t("Remote Index Path") }}</label>
          <input id="repo-pypi-index" v-model="draft.pypiIndexPath" type="text" placeholder="/simple" spellcheck="false" autocomplete="off">
          <small class="kk-hint">
            {{ t("PyPI proxy only. Use /simple for standard package indexes. Leave this empty when the upstream serves project indexes directly from its root, such as the PyTorch package indexes. Client URLs remain under /simple.") }}
          </small>
        </div>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Upstream authentication") }}</h3>
        <div v-if="ntlmAvailable" class="micl-textfield-outlined">
          <label for="repo-remote-auth">{{ t("Upstream authentication") }}</label>
          <select id="repo-remote-auth" v-model="draft.remoteAuthenticationType">
            <option value="auto">{{ t("Basic / Bearer") }}</option>
            <option value="ntlm">{{ t("NTLM") }}</option>
          </select>
        </div>
        <template v-if="ntlmSelected">
          <div class="micl-textfield-outlined">
            <label for="repo-ntlm-domain">{{ t("NTLM domain") }}</label>
            <input id="repo-ntlm-domain" v-model="draft.remoteNtlmDomain" type="text" autocomplete="off" placeholder="DOMAIN">
          </div>
          <div class="micl-textfield-outlined">
            <label for="repo-ntlm-host">{{ t("NTLM workstation (optional)") }}</label>
            <input id="repo-ntlm-host" v-model="draft.remoteNtlmHost" type="text" autocomplete="off">
          </div>
        </template>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-user">{{ t("Remote username") }}</label>
          <input id="repo-remote-user" v-model="draft.remoteUsername" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-pass">{{ t("Remote password") }}</label>
          <input id="repo-remote-pass" v-model="draft.remotePassword" type="password" :placeholder="savedPasswordPlaceholder" autocomplete="new-password">
        </div>
        <label class="kk-switch-row">
          <input v-model="draft.remotePasswordClear" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Clear saved password") }}</span>
        </label>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-token">{{ t("Remote bearer token") }}</label>
          <input id="repo-remote-token" v-model="draft.remoteBearerToken" type="password" :placeholder="savedBearerTokenPlaceholder" autocomplete="new-password">
        </div>
        <label class="kk-switch-row">
          <input v-model="draft.remoteBearerTokenClear" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Clear saved bearer token") }}</span>
        </label>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Caching") }}</h3>
        <div class="micl-textfield-outlined">
          <label for="repo-content-age">{{ t("Content max age (min)") }}</label>
          <input id="repo-content-age" v-model.number="draft.contentMaxAgeMinutes" type="number" min="-1">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-metadata-age">{{ t("Metadata max age (min)") }}</label>
          <input id="repo-metadata-age" v-model.number="draft.metadataMaxAgeMinutes" type="number" min="-1">
        </div>
        <div v-if="minimumReleaseAgeVisible" class="micl-textfield-outlined">
          <label for="repo-min-release-age">{{ t("Minimum release age (min)") }}</label>
          <input id="repo-min-release-age" v-model.number="draft.minimumReleaseAgeMinutes" type="number" min="0">
        </div>
        <p v-if="minimumReleaseAgeVisible" class="kk-hint kk-field--wide">
          {{ t("npm proxy only. A version is hidden from package metadata and its tarball is blocked until this many minutes have passed since publication. Use 0 to disable this policy and preserve existing behavior. This is independent of content and metadata cache max age. Versions with a missing or invalid publish time are blocked while enabled.") }}
        </p>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Connection") }}</h3>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-redirect-hosts">{{ t("Allowed redirect hosts") }}</label>
          <textarea id="repo-redirect-hosts" :value="draft.allowedRedirectHosts" rows="2" @input="draft.allowedRedirectHosts = ($event.target as HTMLTextAreaElement).value"></textarea>
        </div>
        <label class="kk-switch-row">
          <input v-model="draft.autoBlock" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Auto-block remote") }}</span>
        </label>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Outbound proxy") }}</h3>
        <p class="kk-hint kk-field--wide">
          {{ t("Route upstream fetches for this proxy repository through an HTTP or SOCKS proxy (e.g. a corporate Clash on the LAN). Useful when the remote registry (hub.docker.com, pypi.org, ...) is unreachable from the server.") }}
        </p>
        <div class="micl-textfield-outlined">
          <label for="repo-outbound-type">{{ t("Proxy type") }}</label>
          <select id="repo-outbound-type" v-model="draft.outboundProxyType">
            <option value="">{{ t("Direct (no proxy)") }}</option>
            <option value="HTTP">HTTP</option>
            <option value="SOCKS">SOCKS</option>
          </select>
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-outbound-host">{{ t("Proxy host") }}</label>
          <input id="repo-outbound-host" v-model="draft.outboundProxyHost" type="text" autocomplete="off" placeholder="192.168.1.10">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-outbound-port">{{ t("Proxy port") }}</label>
          <input id="repo-outbound-port" v-model.number="draft.outboundProxyPort" type="number" min="1" max="65535" placeholder="7890">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-outbound-user">{{ t("Proxy username") }}</label>
          <input id="repo-outbound-user" v-model="draft.outboundProxyUsername" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-outbound-pass">{{ t("Proxy password") }}</label>
          <input id="repo-outbound-pass" v-model="draft.outboundProxyPassword" type="password" :placeholder="savedOutboundPasswordPlaceholder" autocomplete="new-password">
        </div>
        <label class="kk-switch-row">
          <input v-model="draft.outboundProxyPasswordClear" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Clear saved proxy password") }}</span>
        </label>
      </div>

      <MemberTransferPicker
        v-if="isGroup"
        v-model="memberNames"
        :options="memberCandidates.map((repo) => ({ name: repo.name, supportingText: String(repo.type ?? '').toLowerCase() }))"
        available-title="Available"
        selected-title="Selected"
        filter-id="member-filter"
        available-empty="No matches"
        selected-empty="No eligible members"
        reorder
      />
    </section>

    <!-- Format-specific -->
    <section class="kk-surface-card" v-if="showFormatSettings" data-repository-section="format">
      <div class="kk-card-header">
      <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">tune</span></span>
      <h2 class="kk-card-header__title">{{ t("Format settings") }}</h2>
    </div>
      <div v-if="draftFormat === 'raw'" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-disposition">{{ t("Content disposition") }}</label>
          <input id="repo-disposition" v-model="draft.contentDisposition" type="text" placeholder="attachment" autocomplete="off">
        </div>
      </div>

      <div v-else-if="draftFormat === 'docker'" class="kk-field-grid">
        <p class="kk-hint kk-field--wide">
          {{ t("Optional compatibility entrypoint for repository-specific Docker traffic. Leave it disabled to use path-based Docker routing on the main service port; enable it only when clients need a dedicated /v2/ port or isolated upload/download traffic.") }}
        </p>
        <label class="kk-switch-row">
          <input v-model="draft.dockerConnectorEnabled" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Enable HTTP connector") }}</span>
        </label>
        <div class="micl-textfield-outlined">
          <label for="repo-docker-port">{{ t("Connector port") }}</label>
          <input id="repo-docker-port" v-model.number="draft.dockerConnectorPort" type="number" min="1" max="65535" placeholder="5000" :disabled="!draft.dockerConnectorEnabled">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-docker-url">{{ t("Public URL") }}</label>
          <input id="repo-docker-url" v-model="draft.dockerConnectorPublicUrl" type="url" autocomplete="off" placeholder="https://registry.example.com" :disabled="!draft.dockerConnectorEnabled">
        </div>
      </div>

      <div v-else-if="draftFormat === 'cargo'" class="kk-field-grid">
        <p class="kk-hint kk-field--wide">
          {{ t("Controls the Cargo registry `auth-required` client hint. Repository access is still decided by anonymous settings and security privileges.") }}
        </p>
        <label class="kk-switch-row">
          <input v-model="draft.cargoRequireAuthentication" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Authentication requirements") }}</span>
        </label>
      </div>

      <div v-else-if="draftFormat === 'apt'" class="kk-field-grid">
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Repository layout") }}</h3>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-dist">{{ t("Distribution") }}</label>
          <input id="repo-apt-dist" v-model="draft.aptDistribution" type="text" placeholder="stable" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-component">{{ t("Default component") }}</label>
          <input id="repo-apt-component" v-model="draft.aptComponent" type="text" placeholder="main" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-apt-arch">{{ t("Architectures") }}</label>
          <input id="repo-apt-arch" v-model="draft.aptArchitectures" type="text" placeholder="amd64, arm64" autocomplete="off">
        </div>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Signing") }}</h3>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-mode">{{ t("Metadata mode") }}</label>
          <select id="repo-apt-mode" v-model="draft.aptMetadataMode" :disabled="aptHosted">
            <option
              v-for="mode in APT_METADATA_MODES"
              :key="mode.value"
              :value="mode.value"
              :disabled="aptProxy && draft.aptFlat && mode.value === 'RESIGN'"
            >
              {{ t(mode.label) }}
            </option>
          </select>
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-days">{{ t("Valid-Until (days)") }}</label>
          <input id="repo-apt-days" v-model.number="draft.aptValidUntilDays" type="number" min="0" max="3650" :disabled="!aptLocallySigned">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-origin">{{ t("Origin") }}</label>
          <input id="repo-apt-origin" v-model="draft.aptOrigin" type="text" maxlength="128" :disabled="!aptLocallySigned">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-label">{{ t("Label") }}</label>
          <input id="repo-apt-label" v-model="draft.aptLabel" type="text" maxlength="128" :disabled="!aptLocallySigned">
        </div>
        <label v-if="aptProxy" class="kk-switch-row">
          <input v-model="draft.aptFlat" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Flat upstream layout") }}</span>
        </label>
        <label v-if="aptProxy" class="kk-switch-row">
          <input v-model="draft.aptEnforceDistribution" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Enforce configured distribution") }}</span>
        </label>
        <p class="kk-hint kk-field--wide">
          {{ t("Hosted repositories always publish atomically signed Release/InRelease metadata. Proxy passthrough preserves upstream bytes; re-signing publishes only packages that have been completely cached and checksum-verified.") }}
        </p>
      </div>

      <div v-else-if="draftFormat === 'alpine'" class="kk-field-grid">
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Repository layout") }}</h3>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-dists">{{ t("Distributions") }}</label>
          <input id="repo-alpine-dists" v-model="draft.alpineDistributions" type="text" placeholder="v3.23, edge" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-channels">{{ t("Channels") }}</label>
          <input id="repo-alpine-channels" v-model="draft.alpineChannels" type="text" placeholder="main, community" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-arch">{{ t("Architectures") }}</label>
          <input id="repo-alpine-arch" v-model="draft.alpineArchitectures" type="text" placeholder="x86_64, aarch64" autocomplete="off">
        </div>
        <h3 class="kk-schema-form__group kk-field--wide">{{ t("Signing") }}</h3>
        <div class="micl-textfield-outlined">
          <label for="repo-alpine-mode">{{ t("Metadata mode") }}</label>
          <select id="repo-alpine-mode" v-model="draft.alpineMetadataMode" :disabled="!alpineProxy">
            <option v-for="mode in ALPINE_METADATA_MODES" :key="mode.value" :value="mode.value">
              {{ t(mode.label) }}
            </option>
          </select>
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-alpine-keyfile">{{ t("Public key filename") }}</label>
          <input id="repo-alpine-keyfile" v-model="draft.alpineKeyFilename" type="text" maxlength="192" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-alpine-sig">{{ t("Signature type") }}</label>
          <select id="repo-alpine-sig" v-model="draft.alpineSignatureType">
            <option v-for="signature in ALPINE_SIGNATURE_TYPES" :key="signature.value" :value="signature.value">
              {{ t(signature.label) }}
            </option>
          </select>
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-desc">{{ t("Description") }}</label>
          <input id="repo-alpine-desc" v-model="draft.alpineDescription" type="text" maxlength="255" autocomplete="off">
        </div>
        <label v-if="alpineProxy" class="kk-switch-row">
          <input v-model="draft.alpineVerifyUpstreamSignatures" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Verify upstream index signature before projection") }}</span>
        </label>
        <label v-if="alpineProxy" class="kk-switch-row">
          <input v-model="draft.alpineStaleIfError" class="micl-switch" type="checkbox" role="switch">
          <span>{{ t("Serve last verified index when upstream fails") }}</span>
        </label>
        <div v-if="alpineResignProxy" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-upstream-key">{{ t("Upstream trust entry") }}</label>
          <textarea
            id="repo-alpine-upstream-key"
            v-model="draft.alpineUpstreamPublicKey"
            rows="5"
            spellcheck="false"
            autocomplete="off"
            placeholder="filename=upstream.rsa.pub&#10;-----BEGIN PUBLIC KEY-----"
          ></textarea>
        </div>
        <p class="kk-hint kk-field--wide">
          {{ t("This generation serves APK v2 APKINDEX.tar.gz. Hosted and group repositories publish fenced, atomic signed snapshots. Proxy passthrough preserves upstream bytes; re-signing requires the upstream public key above.") }}
        </p>
      </div>

      <div v-else-if="draftFormat === 'conan'" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-conan-entries">{{ t("Manifest entry limit") }}</label>
          <input id="repo-conan-entries" v-model.number="draft.conanManifestMaxEntries" type="number" min="1" max="2147483647" step="1" :placeholder="t('Inherit server default')">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-conan-bytes">{{ t("Manifest size limit (bytes)") }}</label>
          <input id="repo-conan-bytes" v-model.number="draft.conanManifestMaxBytes" type="number" min="1" max="2147483646" step="1" :placeholder="t('Inherit server default')">
        </div>
        <p v-if="editing" class="kk-hint kk-field--wide">{{ conanStatusText }}</p>
        <div v-if="editing" class="kk-toolbar kk-field--wide kk-action-bar">
          <button
            type="button"
            class="micl-button-tonal-s"
            :disabled="busy || conanStatusBusy"
            @click="loadConanStatus"
          >
            {{ t("Refresh status") }}
          </button>
        </div>
      </div>
    </section>

    <!-- Signing keys and index operations (existing apt/alpine repositories) -->
    <section class="kk-surface-card" v-if="showSigningSettings" data-repository-section="signing">
      <div class="kk-card-header">
        <span class="kk-card-header__icon-box" aria-hidden="true"><span class="material-symbols-outlined">key</span></span>
        <h2 class="kk-card-header__title">{{ t("Signing") }}</h2>
      </div>
      <p class="kk-muted">
        {{ t("Signed metadata needs a key. Generating a new key republishes every index that uses it.") }}
      </p>
      <div class="kk-toolbar kk-action-bar">
        <button type="button" class="micl-button-tonal-s" :disabled="busy" @click="loadSigningStatus">
          {{ t("Refresh status") }}
        </button>
        <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="rebuildMetadata">
          {{ t("Rebuild metadata") }}
        </button>
        <a
          v-if="draftFormat === 'alpine'"
          class="micl-button-outlined-s"
          :href="alpinePublicKeyHref"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t("Download public key") }}
        </a>
        <button type="button" class="micl-button-filled-m kk-primary-action" :disabled="busy" @click="rotateSigningKey(true)">
          {{ t("Generate new key") }}
        </button>
      </div>

      <div v-if="draftFormat === 'apt'" class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="apt-private">{{ t("ASCII-armored private key") }}</label>
          <textarea id="apt-private" v-model="aptPrivateKey" rows="4"></textarea>
        </div>
        <div class="micl-textfield-outlined">
          <label for="apt-passphrase">{{ t("Passphrase") }}</label>
          <input id="apt-passphrase" v-model="aptPassphrase" type="password" autocomplete="new-password">
        </div>
      </div>

      <div v-else class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="alpine-private">{{ t("PKCS#8 RSA private key") }}</label>
          <textarea id="alpine-private" v-model="alpinePrivateKey" rows="4"></textarea>
        </div>
      </div>

      <div class="kk-toolbar kk-action-bar">
        <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="rotateSigningKey(false)">
          {{ t("Import key") }}
        </button>
      </div>

      <p v-if="statusText" class="kk-hint" role="status">{{ statusText }}</p>
    </section></div>
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    icon="delete"
    destructive
    :title="t('Delete repository?')"
    :subtitle="t('Repository content is removed from the blob store when no other repository references it.')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <div class="kk-settings-page"><p class="kk-dialog-message">
      {{ t("Are you sure you want to delete repository") }} <strong class="kk-mono">{{ deleteTarget?.name }}</strong>?
    </p></div>
  </M3Dialog>
</div>
</template>

<style scoped>
.kk-form-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 0 24px;
  padding-block: 4px;
}
</style>
