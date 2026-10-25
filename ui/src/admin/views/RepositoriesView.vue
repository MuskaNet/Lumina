<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3DataTable, { type DataTableColumn } from "../../shared/components/M3DataTable.vue";
import M3Dialog from "../../shared/components/M3Dialog.vue";
import M3Tabs from "../../shared/components/M3Tabs.vue";

interface Recipe {
  recipe?: string;
  name?: string;
  format?: string;
  type?: string;
}

interface HostedSettings {
  writePolicy?: string | null;
  versionPolicy?: string | null;
  layoutPolicy?: string | null;
}

interface ProxySettings {
  remoteUrl?: string | null;
  contentMaxAgeMinutes?: number | null;
  metadataMaxAgeMinutes?: number | null;
  autoBlock?: boolean | null;
  remoteUsername?: string | null;
  remotePasswordConfigured?: boolean | null;
  remoteBearerTokenConfigured?: boolean | null;
  outboundProxyType?: string | null;
  outboundProxyHost?: string | null;
  outboundProxyPort?: number | null;
  minimumReleaseAgeMinutes?: number | null;
  allowedRedirectHosts?: string[] | null;
  remoteAuthenticationType?: string | null;
  remoteNtlmDomain?: string | null;
  remoteNtlmHost?: string | null;
}

interface Repository {
  id?: number | null;
  name: string;
  recipe?: string | null;
  format?: string | null;
  type?: string | null;
  online?: boolean;
  blobStoreName?: string | null;
  strictContentTypeValidation?: boolean;
  url?: string | null;
  hosted?: HostedSettings | null;
  proxy?: ProxySettings | null;
  raw?: { contentDisposition?: string | null } | null;
  docker?: { connectorEnabled?: boolean | null; connectorPort?: number | null; connectorPublicUrl?: string | null } | null;
  cargo?: { requireAuthentication?: boolean | null } | null;
  group?: { memberNames?: string[] | null } | null;
  apt?: Record<string, unknown> | null;
  alpine?: Record<string, unknown> | null;
  pypi?: { indexPath?: string | null } | null;
  yum?: { repodataDepth?: number | null } | null;
  conan?: { manifestMaxEntries?: number | null; manifestMaxBytes?: number | null } | null;
}

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

const recipeOptions = computed(() =>
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

const draft = reactive<Record<string, unknown>>({
  name: "",
  recipe: "",
  online: true,
  strictContentTypeValidation: false,
  blobStoreName: "",
  writePolicy: "ALLOW",
  versionPolicy: "RELEASE",
  layoutPolicy: "STRICT",
  remoteUrl: "",
  contentMaxAgeMinutes: 1440,
  metadataMaxAgeMinutes: 1440,
  autoBlock: true,
  minimumReleaseAgeMinutes: 0,
  remoteUsername: "",
  remotePassword: "",
  allowedRedirectHosts: "",
  memberText: "",
  contentDisposition: "",
  dockerConnectorEnabled: false,
  dockerConnectorPort: 5000,
  dockerConnectorPublicUrl: "",
  cargoRequireAuthentication: false,
  aptDistribution: "",
  aptComponent: "main",
  aptArchitectures: "",
  aptFlat: false,
  aptEnforceDistribution: false,
  aptMetadataMode: "SIGNED",
  aptValidUntilDays: 30,
  aptOrigin: "",
  aptLabel: "",
  alpineDistributions: "",
  alpineChannels: "",
  alpineArchitectures: "",
  alpineMetadataMode: "SIGNED",
  alpineKeyFilename: "",
  alpineSignatureType: "RSA_SHA256",
  alpineDescription: "",
  pypiIndexPath: "",
  yumRepodataDepth: 1,
  conanManifestMaxEntries: null as number | null,
  conanManifestMaxBytes: null as number | null,
});

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

const showFormatTab = computed(() =>
  ["apt", "alpine", "docker", "cargo", "pypi", "yum", "conan", "raw"].includes(draftFormat.value),
);
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

function listFromText(value: unknown): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function openCreate() {
  editing.value = null;
  activeTab.value = "general";
  Object.assign(draft, {
    name: "",
    recipe: recipeOptions.value[0]?.value ?? "",
    online: true,
    strictContentTypeValidation: false,
    blobStoreName: blobStores.value[0]?.name ?? "",
    writePolicy: "ALLOW",
    versionPolicy: "RELEASE",
    layoutPolicy: "STRICT",
    remoteUrl: "",
    contentMaxAgeMinutes: 1440,
    metadataMaxAgeMinutes: 1440,
    autoBlock: true,
    minimumReleaseAgeMinutes: 0,
    remoteUsername: "",
    remotePassword: "",
    allowedRedirectHosts: "",
    memberText: "",
    contentDisposition: "",
    dockerConnectorEnabled: false,
    dockerConnectorPort: 5000,
    dockerConnectorPublicUrl: "",
    cargoRequireAuthentication: false,
    aptDistribution: "",
    aptComponent: "main",
    aptArchitectures: "",
    aptFlat: false,
    aptEnforceDistribution: false,
    aptMetadataMode: "SIGNED",
    aptValidUntilDays: 30,
    aptOrigin: "",
    aptLabel: "",
    alpineDistributions: "",
    alpineChannels: "",
    alpineArchitectures: "",
    alpineMetadataMode: "SIGNED",
    alpineKeyFilename: "",
    alpineSignatureType: "RSA_SHA256",
    alpineDescription: "",
    pypiIndexPath: "",
    yumRepodataDepth: 1,
    conanManifestMaxEntries: null,
    conanManifestMaxBytes: null,
  });
  error.value = "";
  dialog.value?.open();
}

function openEdit(repo: Repository) {
  editing.value = repo;
  activeTab.value = "general";
  const apt = (repo.apt ?? {}) as Record<string, unknown>;
  const alpine = (repo.alpine ?? {}) as Record<string, unknown>;
  Object.assign(draft, {
    name: repo.name,
    recipe: repo.recipe ?? "",
    online: repo.online ?? true,
    strictContentTypeValidation: repo.strictContentTypeValidation ?? false,
    blobStoreName: repo.blobStoreName ?? "",
    writePolicy: repo.hosted?.writePolicy ?? "ALLOW",
    versionPolicy: repo.hosted?.versionPolicy ?? "RELEASE",
    layoutPolicy: repo.hosted?.layoutPolicy ?? "STRICT",
    remoteUrl: repo.proxy?.remoteUrl ?? "",
    contentMaxAgeMinutes: repo.proxy?.contentMaxAgeMinutes ?? 1440,
    metadataMaxAgeMinutes: repo.proxy?.metadataMaxAgeMinutes ?? 1440,
    autoBlock: repo.proxy?.autoBlock ?? true,
    minimumReleaseAgeMinutes: repo.proxy?.minimumReleaseAgeMinutes ?? 0,
    remoteUsername: repo.proxy?.remoteUsername ?? "",
    remotePassword: "",
    allowedRedirectHosts: (repo.proxy?.allowedRedirectHosts ?? []).join("\n"),
    memberText: (repo.group?.memberNames ?? []).join("\n"),
    contentDisposition: repo.raw?.contentDisposition ?? "",
    dockerConnectorEnabled: repo.docker?.connectorEnabled ?? false,
    dockerConnectorPort: repo.docker?.connectorPort ?? 5000,
    dockerConnectorPublicUrl: repo.docker?.connectorPublicUrl ?? "",
    cargoRequireAuthentication: repo.cargo?.requireAuthentication ?? false,
    aptDistribution: String(apt.distribution ?? ""),
    aptComponent: String(apt.component ?? "main"),
    aptArchitectures: (Array.isArray(apt.architectures) ? (apt.architectures as string[]) : []).join(", "),
    aptFlat: Boolean(apt.flat),
    aptEnforceDistribution: Boolean(apt.enforceDistribution),
    aptMetadataMode: String(apt.metadataMode ?? "SIGNED"),
    aptValidUntilDays: (apt.validUntilDays as number | null) ?? 30,
    aptOrigin: String(apt.origin ?? ""),
    aptLabel: String(apt.label ?? ""),
    alpineDistributions: (Array.isArray(alpine.distributions) ? (alpine.distributions as string[]) : []).join(", "),
    alpineChannels: (Array.isArray(alpine.channels) ? (alpine.channels as string[]) : []).join(", "),
    alpineArchitectures: (Array.isArray(alpine.architectures) ? (alpine.architectures as string[]) : []).join(", "),
    alpineMetadataMode: String(alpine.metadataMode ?? "SIGNED"),
    alpineKeyFilename: String(alpine.keyFilename ?? ""),
    alpineSignatureType: String(alpine.signatureType ?? "RSA_SHA256"),
    alpineDescription: String(alpine.description ?? ""),
    pypiIndexPath: repo.pypi?.indexPath ?? "",
    yumRepodataDepth: repo.yum?.repodataDepth ?? 1,
    conanManifestMaxEntries: repo.conan?.manifestMaxEntries ?? null,
    conanManifestMaxBytes: repo.conan?.manifestMaxBytes ?? null,
  });
  error.value = "";
  dialog.value?.open();
}

function buildPayload(creating: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    online: Boolean(draft.online),
    strictContentTypeValidation: Boolean(draft.strictContentTypeValidation),
  };
  if (creating) {
    payload.name = String(draft.name).trim();
    payload.recipe = draft.recipe || null;
    payload.blobStoreName = draft.blobStoreName || null;
  }
  if (isHosted.value) {
    payload.hosted = {
      writePolicy: draft.writePolicy,
      versionPolicy: draftFormat.value === "maven2" ? draft.versionPolicy : null,
      layoutPolicy: draftFormat.value === "maven2" ? draft.layoutPolicy : null,
    };
  } else if (isProxy.value) {
    payload.proxy = {
      remoteUrl: String(draft.remoteUrl ?? "").trim(),
      contentMaxAgeMinutes: Number(draft.contentMaxAgeMinutes ?? 0) || null,
      metadataMaxAgeMinutes: Number(draft.metadataMaxAgeMinutes ?? 0) || null,
      autoBlock: Boolean(draft.autoBlock),
      remoteUsername: draft.remoteUsername || null,
      remotePassword: draft.remotePassword ? String(draft.remotePassword) : null,
      minimumReleaseAgeMinutes: Number(draft.minimumReleaseAgeMinutes ?? 0) || null,
      allowedRedirectHosts: listFromText(draft.allowedRedirectHosts),
    };
  } else if (isGroup.value) {
    payload.group = { memberNames: listFromText(draft.memberText) };
  }

  switch (draftFormat.value) {
    case "raw":
      payload.raw = { contentDisposition: draft.contentDisposition || null };
      break;
    case "docker":
      payload.docker = {
        connectorEnabled: Boolean(draft.dockerConnectorEnabled),
        connectorPort: Number(draft.dockerConnectorPort) || null,
        connectorPublicUrl: draft.dockerConnectorPublicUrl || null,
      };
      break;
    case "cargo":
      payload.cargo = { requireAuthentication: Boolean(draft.cargoRequireAuthentication) };
      break;
    case "apt":
      payload.apt = {
        distribution: draft.aptDistribution || null,
        component: draft.aptComponent || "main",
        architectures: listFromText(draft.aptArchitectures),
        flat: Boolean(draft.aptFlat),
        enforceDistribution: Boolean(draft.aptEnforceDistribution),
        metadataMode: draft.aptMetadataMode,
        validUntilDays: Number(draft.aptValidUntilDays) || null,
        origin: draft.aptOrigin || null,
        label: draft.aptLabel || null,
      };
      break;
    case "alpine":
      payload.alpine = {
        distributions: listFromText(draft.alpineDistributions),
        channels: listFromText(draft.alpineChannels),
        architectures: listFromText(draft.alpineArchitectures),
        metadataMode: draft.alpineMetadataMode,
        keyFilename: draft.alpineKeyFilename || null,
        signatureType: draft.alpineSignatureType,
        description: draft.alpineDescription || null,
      };
      break;
    case "pypi":
      payload.pypi = { indexPath: draft.pypiIndexPath || null };
      break;
    case "yum":
      payload.yum = { repodataDepth: Number(draft.yumRepodataDepth) || null };
      break;
    case "conan":
      payload.conan = {
        manifestMaxEntries: draft.conanManifestMaxEntries === null ? null : Number(draft.conanManifestMaxEntries),
        manifestMaxBytes: draft.conanManifestMaxBytes === null ? null : Number(draft.conanManifestMaxBytes),
      };
      break;
    default:
      break;
  }
  return payload;
}

async function save() {
  if (!editing.value && !String(draft.name ?? "").trim()) {
    error.value = t("Repository name is required.");
    activeTab.value = "general";
    return;
  }
  if (isProxy.value && !String(draft.remoteUrl ?? "").trim()) {
    error.value = t("Remote URL is required for proxy repositories.");
    activeTab.value = "behavior";
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
    <button type="button" class="micl-button-filled-m" @click="openCreate">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">add</span>
      {{ t("Create repository") }}
    </button>
    <div class="micl-textfield-outlined kk-filter">
      <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">filter_list</span>
      <label for="repo-filter">{{ t("Filter") }}</label>
      <input id="repo-filter" v-model="filter" type="search" autocomplete="off">
    </div>
    <button type="button" class="micl-button-outlined-m kk-toolbar__spacer" @click="load">{{ t("Refresh") }}</button>
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
    <div v-if="activeTab === 'general'" class="kk-field-grid">
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
      <div v-if="!editing" class="micl-textfield-outlined">
        <label for="repo-blobstore">{{ t("Blob store") }}</label>
        <select id="repo-blobstore" v-model="draft.blobStoreName">
          <option value="">{{ t("Default") }}</option>
          <option v-for="store in blobStores" :key="store.name" :value="store.name">{{ store.name }}</option>
        </select>
      </div>
      <label class="kk-checkbox-row">
        <input v-model="draft.online" class="micl-checkbox" type="checkbox">
        <span>{{ t("Online") }}</span>
      </label>
      <label class="kk-checkbox-row">
        <input v-model="draft.strictContentTypeValidation" class="micl-checkbox" type="checkbox">
        <span>{{ t("Strict content type validation") }}</span>
      </label>
    </div>

    <!-- Hosted / proxy / group -->
    <template v-else-if="activeTab === 'behavior'">
      <div v-if="isHosted" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-write-policy">{{ t("Write policy") }}</label>
          <select id="repo-write-policy" v-model="draft.writePolicy">
            <option value="ALLOW">ALLOW</option>
            <option value="ALLOW_ONCE">ALLOW_ONCE</option>
            <option value="DENY">DENY</option>
          </select>
        </div>
        <template v-if="draftFormat === 'maven2'">
          <div class="micl-textfield-outlined">
            <label for="repo-version-policy">{{ t("Version policy") }}</label>
            <select id="repo-version-policy" v-model="draft.versionPolicy">
              <option value="RELEASE">RELEASE</option>
              <option value="SNAPSHOT">SNAPSHOT</option>
              <option value="MIXED">MIXED</option>
            </select>
          </div>
          <div class="micl-textfield-outlined">
            <label for="repo-layout-policy">{{ t("Layout policy") }}</label>
            <select id="repo-layout-policy" v-model="draft.layoutPolicy">
              <option value="STRICT">STRICT</option>
              <option value="PERMISSIVE">PERMISSIVE</option>
            </select>
          </div>
        </template>
      </div>

      <div v-else-if="isProxy" class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-remote-url">{{ t("Remote URL") }}</label>
          <input id="repo-remote-url" v-model="draft.remoteUrl" type="url" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-content-age">{{ t("Content max age (minutes)") }}</label>
          <input id="repo-content-age" v-model.number="draft.contentMaxAgeMinutes" type="number" min="0">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-metadata-age">{{ t("Metadata max age (minutes)") }}</label>
          <input id="repo-metadata-age" v-model.number="draft.metadataMaxAgeMinutes" type="number" min="0">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-min-release-age">{{ t("Minimum release age (minutes)") }}</label>
          <input id="repo-min-release-age" v-model.number="draft.minimumReleaseAgeMinutes" type="number" min="0">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-user">{{ t("Remote username") }}</label>
          <input id="repo-remote-user" v-model="draft.remoteUsername" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-remote-pass">{{ t("Remote password") }}</label>
          <input id="repo-remote-pass" v-model="draft.remotePassword" type="password" autocomplete="new-password">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-redirect-hosts">{{ t("Allowed redirect hosts") }}</label>
          <textarea
            id="repo-redirect-hosts"
            :value="String(draft.allowedRedirectHosts ?? '')"
            rows="2"
            @input="draft.allowedRedirectHosts = ($event.target as HTMLTextAreaElement).value"
          ></textarea>
        </div>
        <label class="kk-checkbox-row">
          <input v-model="draft.autoBlock" class="micl-checkbox" type="checkbox">
          <span>{{ t("Auto-block on upstream failure") }}</span>
        </label>
      </div>

      <div v-else-if="isGroup">
        <p class="kk-muted">{{ t("One repository name per line. Order defines resolution priority.") }}</p>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-members">{{ t("Member repositories") }}</label>
          <textarea
            id="repo-members"
            :value="String(draft.memberText ?? '')"
            rows="5"
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
        <label class="kk-checkbox-row">
          <input v-model="draft.dockerConnectorEnabled" class="micl-checkbox" type="checkbox">
          <span>{{ t("Enable connector") }}</span>
        </label>
        <div class="micl-textfield-outlined">
          <label for="repo-docker-port">{{ t("Connector port") }}</label>
          <input id="repo-docker-port" v-model.number="draft.dockerConnectorPort" type="number" min="1" max="65535">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-docker-url">{{ t("Public URL") }}</label>
          <input id="repo-docker-url" v-model="draft.dockerConnectorPublicUrl" type="url" autocomplete="off">
        </div>
      </div>

      <div v-else-if="draftFormat === 'cargo'" class="kk-field-grid">
        <label class="kk-checkbox-row">
          <input v-model="draft.cargoRequireAuthentication" class="micl-checkbox" type="checkbox">
          <span>{{ t("Require authentication") }}</span>
        </label>
      </div>

      <div v-else-if="draftFormat === 'apt'" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-apt-dist">{{ t("Distribution") }}</label>
          <input id="repo-apt-dist" v-model="draft.aptDistribution" type="text" placeholder="stable" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-component">{{ t("Component") }}</label>
          <input id="repo-apt-component" v-model="draft.aptComponent" type="text" placeholder="main" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-apt-arch">{{ t("Architectures") }}</label>
          <input id="repo-apt-arch" v-model="draft.aptArchitectures" type="text" placeholder="amd64, arm64" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-mode">{{ t("Metadata mode") }}</label>
          <select id="repo-apt-mode" v-model="draft.aptMetadataMode">
            <option value="SIGNED">SIGNED</option>
            <option value="UNSIGNED">UNSIGNED</option>
          </select>
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-days">{{ t("Valid until (days)") }}</label>
          <input id="repo-apt-days" v-model.number="draft.aptValidUntilDays" type="number" min="1">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-origin">{{ t("Origin") }}</label>
          <input id="repo-apt-origin" v-model="draft.aptOrigin" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-apt-label">{{ t("Label") }}</label>
          <input id="repo-apt-label" v-model="draft.aptLabel" type="text" autocomplete="off">
        </div>
        <label class="kk-checkbox-row">
          <input v-model="draft.aptFlat" class="micl-checkbox" type="checkbox">
          <span>{{ t("Flat repository") }}</span>
        </label>
        <label class="kk-checkbox-row">
          <input v-model="draft.aptEnforceDistribution" class="micl-checkbox" type="checkbox">
          <span>{{ t("Enforce distribution") }}</span>
        </label>
      </div>

      <div v-else-if="draftFormat === 'alpine'" class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-dists">{{ t("Distributions") }}</label>
          <input id="repo-alpine-dists" v-model="draft.alpineDistributions" type="text" placeholder="v3.20, v3.21" autocomplete="off">
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
          <select id="repo-alpine-mode" v-model="draft.alpineMetadataMode">
            <option value="SIGNED">SIGNED</option>
            <option value="UNSIGNED">UNSIGNED</option>
          </select>
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-alpine-keyfile">{{ t("Key filename") }}</label>
          <input id="repo-alpine-keyfile" v-model="draft.alpineKeyFilename" type="text" autocomplete="off">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-alpine-sig">{{ t("Signature type") }}</label>
          <select id="repo-alpine-sig" v-model="draft.alpineSignatureType">
            <option value="RSA_SHA256">RSA_SHA256</option>
            <option value="RSA_SHA512">RSA_SHA512</option>
          </select>
        </div>
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-alpine-desc">{{ t("Description") }}</label>
          <input id="repo-alpine-desc" v-model="draft.alpineDescription" type="text" autocomplete="off">
        </div>
      </div>

      <div v-else-if="draftFormat === 'pypi'" class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="repo-pypi-index">{{ t("Remote index path") }}</label>
          <input id="repo-pypi-index" v-model="draft.pypiIndexPath" type="text" placeholder="simple/" autocomplete="off">
        </div>
      </div>

      <div v-else-if="draftFormat === 'yum'" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-yum-depth">{{ t("Repodata depth") }}</label>
          <input id="repo-yum-depth" v-model.number="draft.yumRepodataDepth" type="number" min="0">
        </div>
      </div>

      <div v-else-if="draftFormat === 'conan'" class="kk-field-grid">
        <div class="micl-textfield-outlined">
          <label for="repo-conan-entries">{{ t("Manifest max entries") }}</label>
          <input id="repo-conan-entries" v-model.number="draft.conanManifestMaxEntries" type="number" min="1">
        </div>
        <div class="micl-textfield-outlined">
          <label for="repo-conan-bytes">{{ t("Manifest max bytes") }}</label>
          <input id="repo-conan-bytes" v-model.number="draft.conanManifestMaxBytes" type="number" min="1">
        </div>
      </div>
    </template>

    <!-- Signing keys (existing hosted apt/alpine) -->
    <template v-else-if="activeTab === 'keys'">
      <p class="kk-muted">
        {{ t("Signed metadata needs a key. Generating a new key republishes every index that uses it.") }}
      </p>
      <div class="kk-toolbar">
        <button type="button" class="micl-button-outlined-m" :disabled="busy" @click="loadSigningStatus">
          {{ t("Load status") }}
        </button>
        <button type="button" class="micl-button-outlined-m" :disabled="busy" @click="rebuildMetadata">
          {{ t("Rebuild metadata") }}
        </button>
        <button type="button" class="micl-button-filled-m" :disabled="busy" @click="rotateSigningKey(true)">
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
        <button type="button" class="micl-button-outlined-m" :disabled="busy" @click="rotateSigningKey(false)">
          {{ t("Import key") }}
        </button>
      </div>

      <pre v-if="statusText" class="kk-code">{{ statusText }}</pre>
    </template>
  </M3Dialog>

  <M3Dialog
    ref="deleteDialog"
    :title="t('Delete repository?')"
    :subtitle="t('Repository content is removed from the blob store when no other repository references it.')"
    :confirm-label="t('Delete')"
    :busy="busy"
    @confirm="confirmDelete"
  >
    <code class="kk-mono">{{ deleteTarget?.name }}</code>
  </M3Dialog>
</template>
