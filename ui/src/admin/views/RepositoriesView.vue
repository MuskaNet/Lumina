<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3Tabs from "../../shared/components/M3Tabs.vue";
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
  repositoryDraftFromView,
  type RepositoryDraft,
  type RepositoryRecipeOption,
  type RepositoryViewLike,
} from "../repositoryForm";

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

const repositories = ref<Repository[]>([]);
const recipes = ref<Recipe[]>([]);
const blobStores = ref<{ name: string }[]>([]);
const filter = ref("");
const loading = ref(true);
const busy = ref(false);
const error = ref("");

const FORMAT_ICONS: Record<string, string> = {
  maven2: "inventory_2",
  npm: "deployed_code",
  pypi: "code",
  go: "code",
  helm: "deployed_code",
  docker: "deployed_code",
  cargo: "deployed_code",
  pub: "deployed_code",
  composer: "code",
  terraform: "cloud",
  swift: "code",
  nuget: "deployed_code",
  rubygems: "diamond",
  yum: "system_update_alt",
  raw: "folder",
  apt: "system_update_alt",
  alpine: "system_update_alt",
  conan: "deployed_code",
  conda: "deployed_code",
  ansiblegalaxy: "hub",
  r: "code",
  huggingface: "cloud",
  gitlfs: "folder",
};

const columns: DataTableColumn[] = [
  { key: "icon", label: "" },
  { key: "name", label: "Name" },
  { key: "format", label: "Format" },
  { key: "type", label: "Type" },
  { key: "online", label: "Online" },
  { key: "blobStoreName", label: "Blob store" },
  { key: "url", label: "URL", cellClass: "kk-col-location" },
  { key: "actions", label: "Actions", align: "end" },
];

const rows = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  const sorted = [...repositories.value].sort((a, b) => a.name.localeCompare(b.name));
  if (!needle) return sorted;
  return sorted.filter((repo) =>
    [repo.name, repo.format, repo.type, repo.blobStoreName, repo.url]
      .some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
});

function iconFor(repo: Repository): string {
  return FORMAT_ICONS[String(repo.format ?? "")] ?? "inventory_2";
}

async function load() {
  loading.value = true;
  try {
    const [repos, recipeList, stores] = await Promise.all([
      api.get<Repository[]>("/internal/repositories?purpose=admin"),
      api.getOrNull<Recipe[]>("/internal/repositories/recipes"),
      api.getOrNull<BlobStoreList>("/internal/blob-stores"),
    ]);
    repositories.value = repos ?? [];
    recipes.value = recipeList ?? [];
    blobStores.value = stores?.stores ?? [];
  } catch (cause) {
    showToast(`${t("Failed to load repositories")}: ${(cause as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

const recipeOptions = computed<RepositoryRecipeOption[]>(() =>
  recipes.value
    .map((recipe) => ({
      value: String(recipe.recipe ?? recipe.name ?? `${recipe.format}-${recipe.type}`.toLowerCase()),
      label: `${recipe.format} · ${recipe.type}`,
      format: String(recipe.format ?? ""),
      type: String(recipe.type ?? "").toUpperCase(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

/* ---- Dialog state ------------------------------------------------------ */

const DIALOG_TABS = [
  { id: "general", label: "General" },
  { id: "behavior", label: "Type" },
  { id: "format", label: "Format" },
  { id: "keys", label: "Signing" },
];

const dialog = ref<InstanceType<typeof M3Dialog> | null>(null);
const editing = ref<Repository | null>(null);
const activeTab = ref("general");

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

const showFormatTab = computed(() => {
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
const showKeysTab = computed(
  () => Boolean(editing.value) && ["apt", "alpine"].includes(draftFormat.value) && isHosted.value,
);

const visibleTabs = computed(() =>
  DIALOG_TABS.filter((tab) => {
    if (tab.id === "format") return showFormatTab.value;
    if (tab.id === "keys") return showKeysTab.value;
    if (tab.id === "behavior") return draftType.value !== "";
    return true;
  }),
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
  activeTab.value = "general";
  const recipe = recipeOptions.value[0];
  Object.assign(draft, createRepositoryDraft(recipe, blobStores.value[0]?.name ?? ""));
  applyRecipeDefaults(draft, recipe?.format ?? "", recipe?.type ?? "");
  error.value = "";
  dialog.value?.open();
}

function openEdit(repo: Repository) {
  editing.value = repo;
  activeTab.value = "general";
  Object.assign(draft, repositoryDraftFromView(repo));
  error.value = "";
  dialog.value?.open();
}

function buildPayload(creating: boolean): Record<string, unknown> {
  return buildRepositoryPayload(draft, draftFormat.value, draftType.value, creating);
}

async function save() {
  if (!editing.value && !draft.name.trim()) {
    error.value = t("Repository name is required.");
    activeTab.value = "general";
    return;
  }
  if (isProxy.value && !draft.remoteUrl.trim()) {
    error.value = t("Remote URL is required for proxy repositories.");
    activeTab.value = "behavior";
    return;
  }
  if (aptHosted.value && !draft.aptDistribution.trim()) {
    error.value = t("APT distribution is required for hosted repositories.");
    activeTab.value = "format";
    return;
  }
  if (
    draftFormat.value === "docker"
    && draft.dockerConnectorEnabled
    && (draft.dockerConnectorPort === null || draft.dockerConnectorPort === "")
  ) {
    error.value = t("Connector port is required when the Docker connector is enabled.");
    activeTab.value = "format";
    return;
  }
  if (
    alpineResignProxy.value
    && (!draft.alpineVerifyUpstreamSignatures || !draft.alpineUpstreamPublicKey.trim())
  ) {
    error.value = t("Alpine re-sign proxy requires signature verification and upstream public keys.");
    activeTab.value = "format";
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
    const path = draftFormat.value === "apt"
      ? `/internal/repositories/${encodeURIComponent(repo.name)}/apt/status`
      : `/internal/repositories/${encodeURIComponent(repo.name)}/alpine/status`;
    const payload = await api.get<Record<string, unknown>>(path);
    statusText.value = JSON.stringify(payload, null, 2);
  } catch (cause) {
    statusText.value = (cause as Error).message;
  }
}

async function rebuildMetadata() {
  const repo = editing.value;
  if (!repo) return;
  busy.value = true;
  try {
    const path = draftFormat.value === "apt"
      ? `/internal/repositories/${encodeURIComponent(repo.name)}/apt/rebuild`
      : `/internal/repositories/${encodeURIComponent(repo.name)}/alpine/rebuild`;
    await api.send(path, draftFormat.value === "apt" ? "POST" : "POST", {});
    showToast(t("Metadata rebuild queued."), "ok");
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

function formatIconValue(repo: Repository): string {
  return iconFor(repo);
}

onMounted(load);
</script>

<template>
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-s" @click="openCreate">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>
      {{ t("Create repository") }}
    </button>
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="repo-filter">{{ t("Filter") }}</label>
      <input id="repo-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    <button type="button" class="micl-button-outlined-s kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
  </div>

  <M3DataTable
    :columns="columns"
    :rows="rows"
    :row-key="(row: Repository) => row.name"
    :loading="loading"
    :empty-text="t('No repositories found.')"
    :aria-label="t('Repositories')"
  >
    <template #cell-icon="{ row }">
      <span class="material-symbols-outlined kk-format-icon" aria-hidden="true">{{ formatIconValue(row) }}</span>
    </template>
    <template #cell-format="{ row }">
      {{ row.format }}
      <small class="kk-secondary">{{ row.recipe }}</small>
    </template>
    <template #cell-type="{ row }">
      <span class="kk-badge" :class="typeLabel(row) === 'group' ? 'kk-badge--warn' : 'kk-badge--ok'">
        {{ typeLabel(row) }}
      </span>
    </template>
    <template #cell-online="{ row }">
      <span class="kk-badge" :class="row.online ? 'kk-badge--ok' : 'kk-badge--bad'">
        {{ row.online ? t("Online") : t("Offline") }}
      </span>
    </template>
    <template #cell-blobStoreName="{ row }">{{ row.blobStoreName || "—" }}</template>
    <template #cell-url="{ row }"><code class="kk-mono">{{ row.url || "—" }}</code></template>
    <template #cell-actions="{ row }">
      <div class="kk-row-actions">
        <button type="button" class="micl-button-text-s" @click="openEdit(row)">{{ t("Edit") }}</button>
        <button type="button" class="micl-button-text-s" @click="askDelete(row)">{{ t("Delete") }}</button>
      </div>
    </template>
  </M3DataTable>

  <M3Dialog
    ref="dialog"
    wide
    :title="editing ? `${t('Edit repository')} · ${editing.name}` : t('Create repository')"
    :busy="busy"
    :error="error"
    @confirm="save"
  >
    <M3Tabs :tabs="visibleTabs" :active="activeTab" @select="activeTab = $event" />

    <!-- General -->
    <template v-if="activeTab === 'general'">
      <div class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-name">{{ t("Name") }}</label>
          <input id="repo-name" v-model="draft.name" type="text" :readonly="Boolean(editing)" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-recipe">{{ t("Recipe") }}</label>
          <select id="repo-recipe" v-model="draft.recipe" :disabled="Boolean(editing)">
            <option v-for="option in recipeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div v-if="!editing" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-blobstore">{{ t("Blob store") }}</label>
          <select id="repo-blobstore" v-model="draft.blobStoreName">
            <option value="">{{ t("Default") }}</option>
            <option v-for="store in blobStores" :key="store.name" :value="store.name">{{ store.name }}</option>
          </select>
        </div>
      </div>
      <div class="kk-form-switches">
        <label class="kk-checkbox-row">
          <input v-model="draft.online" class="micl-checkbox" type="checkbox">
          <span>{{ t("Online") }}</span>
        </label>
        <label class="kk-checkbox-row">
          <input v-model="draft.strictContentTypeValidation" class="micl-checkbox" type="checkbox" :disabled="strictDisabled">
          <span>{{ t("Strict content type validation") }}</span>
        </label>
      </div>
    </template>

    <!-- Hosted / proxy / group -->
    <template v-else-if="activeTab === 'behavior'">
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
          {{ t("Swift proxy follows the Nexus-compatible GitHub source mode. The remote is fixed to https://github.com/; use the username/token fields for private GitHub repositories. Production SwiftPM clients should always connect to kkrepo over HTTPS.") }}
        </p>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-remote-url">{{ t("Remote URL") }}</label>
          <input id="repo-remote-url" v-model="draft.remoteUrl" type="url" autocomplete="off" :readonly="draftFormat === 'swift'">
        </div>
        <div v-if="pypiIndexVisible" class="micl-textfield-outlined kk-field--wide">
          <label for="repo-pypi-index">{{ t("Remote Index Path") }}</label>
          <input id="repo-pypi-index" v-model="draft.pypiIndexPath" type="text" placeholder="/simple" spellcheck="false" autocomplete="off">
          <small class="kk-hint">
            {{ t("PyPI proxy only. Use /simple for standard package indexes. Leave this empty when the upstream serves project indexes directly from its root, such as the PyTorch package indexes. Client URLs remain under /simple.") }}
          </small>
        </div>
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
        <label class="kk-checkbox-row">
          <input v-model="draft.remotePasswordClear" class="micl-checkbox" type="checkbox">
          <span>{{ t("Clear saved password") }}</span>
        </label>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-token">{{ t("Remote bearer token") }}</label>
          <input id="repo-remote-token" v-model="draft.remoteBearerToken" type="password" :placeholder="savedBearerTokenPlaceholder" autocomplete="new-password">
        </div>
        <label class="kk-checkbox-row">
          <input v-model="draft.remoteBearerTokenClear" class="micl-checkbox" type="checkbox">
          <span>{{ t("Clear saved bearer token") }}</span>
        </label>
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
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-redirect-hosts">{{ t("Allowed redirect hosts") }}</label>
          <textarea id="repo-redirect-hosts" :value="draft.allowedRedirectHosts" rows="2" @input="draft.allowedRedirectHosts = ($event.target as HTMLTextAreaElement).value"></textarea>
        </div>
        <label class="kk-checkbox-row">
          <input v-model="draft.autoBlock" class="micl-checkbox" type="checkbox">
          <span>{{ t("Auto-block remote") }}</span>
        </label>
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
        <label class="kk-checkbox-row">
          <input v-model="draft.outboundProxyPasswordClear" class="micl-checkbox" type="checkbox">
          <span>{{ t("Clear saved proxy password") }}</span>
        </label>
      </div>

      <div v-else-if="isGroup" class="kk-schema-form">
        <p class="kk-hint">{{ t("One repository name per line. Order defines resolution priority.") }}</p>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-members">{{ t("Member repositories") }}</label>
          <textarea
            id="repo-members"
            :value="String(draft.memberText ?? '')"
            rows="6"
            @input="draft.memberText = ($event.target as HTMLTextAreaElement).value"
          ></textarea>
        </div>
      </div>
    </template>

    <!-- Format-specific -->
    <template v-else-if="activeTab === 'format'">
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
        <label class="kk-checkbox-row">
          <input v-model="draft.dockerConnectorEnabled" class="micl-checkbox" type="checkbox">
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
        <label class="kk-checkbox-row">
          <input v-model="draft.cargoRequireAuthentication" class="micl-checkbox" type="checkbox">
          <span>{{ t("Authentication requirements") }}</span>
        </label>
      </div>

      <div v-else-if="draftFormat === 'apt'" class="kk-field-grid">
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
        <label v-if="aptProxy" class="kk-checkbox-row">
          <input v-model="draft.aptFlat" class="micl-checkbox" type="checkbox">
          <span>{{ t("Flat upstream layout") }}</span>
        </label>
        <label v-if="aptProxy" class="kk-checkbox-row">
          <input v-model="draft.aptEnforceDistribution" class="micl-checkbox" type="checkbox">
          <span>{{ t("Enforce configured distribution") }}</span>
        </label>
        <p class="kk-hint kk-field--wide">
          {{ t("Hosted repositories always publish atomically signed Release/InRelease metadata. Proxy passthrough preserves upstream bytes; re-signing publishes only packages that have been completely cached and checksum-verified.") }}
        </p>
      </div>

      <div v-else-if="draftFormat === 'alpine'" class="kk-field-grid">
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
        <label v-if="alpineProxy" class="kk-checkbox-row">
          <input v-model="draft.alpineVerifyUpstreamSignatures" class="micl-checkbox" type="checkbox">
          <span>{{ t("Verify upstream index signature before projection") }}</span>
        </label>
        <label v-if="alpineProxy" class="kk-checkbox-row">
          <input v-model="draft.alpineStaleIfError" class="micl-checkbox" type="checkbox">
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
          <input id="repo-conan-entries" v-model.number="draft.conanManifestMaxEntries" type="number" min="1" max="2147483647" step="1" placeholder="Inherit server default">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-conan-bytes">{{ t("Manifest size limit (bytes)") }}</label>
          <input id="repo-conan-bytes" v-model.number="draft.conanManifestMaxBytes" type="number" min="1" max="2147483646" step="1" placeholder="Inherit server default">
        </div>
      </div>
    </template>

    <!-- Signing keys (existing hosted apt/alpine) -->
    <template v-else-if="activeTab === 'keys'">
      <p class="kk-muted">
        {{ t("Signed metadata needs a key. Generating a new key republishes every index that uses it.") }}
      </p>
      <div class="kk-toolbar">
        <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="loadSigningStatus">
          {{ t("Load status") }}
        </button>
        <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="rebuildMetadata">
          {{ t("Rebuild metadata") }}
        </button>
        <button type="button" class="micl-button-filled-s" :disabled="busy" @click="rotateSigningKey(true)">
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

      <div class="kk-toolbar">
        <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="rotateSigningKey(false)">
          {{ t("Import key") }}
        </button>
      </div>

      <pre v-if="statusText" class="kk-code">{{ statusText }}</pre>
    </template>
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
    <p class="kk-dialog-message">
      {{ t("Are you sure you want to delete repository") }} <strong class="kk-mono">{{ deleteTarget?.name }}</strong>?
    </p>
  </M3Dialog>
</template>
