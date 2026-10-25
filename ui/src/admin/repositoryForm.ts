/**
 * Draft state and request payload for the repository create/edit dialog.
 *
 * The values mirror the server-side normalization in `RepositoryService` and the
 * upstream (legacy) admin console:
 * - APT/Alpine metadata modes are PASSTHROUGH or RESIGN; "SIGNED"/"UNSIGNED" are
 *   not accepted by the server and were a broken migration artifact.
 * - APK signature types are RSA/RSA256/RSA512 (the labels shown to users).
 * - Hosted and group repositories must publish locally signed metadata, so the
 *   mode is forced and disabled for those types.
 * - Proxy settings (upstream authentication, bearer token, outbound network
 *   proxy, cache ages, redirect hosts, ...) belong to the proxy payload only.
 *
 * Keeping this logic out of the component makes the protocol-facing defaults and
 * request shapes unit testable without a DOM.
 */

export interface Choice {
  value: string;
  label: string;
}

export const APT_METADATA_MODES: Choice[] = [
  { value: "PASSTHROUGH", label: "Passthrough upstream signatures" },
  { value: "RESIGN", label: "Verify cache and sign locally" },
];

export const ALPINE_METADATA_MODES: Choice[] = [
  { value: "PASSTHROUGH", label: "Passthrough upstream signature" },
  { value: "RESIGN", label: "Verify and sign locally" },
];

export const ALPINE_SIGNATURE_TYPES: Choice[] = [
  { value: "RSA", label: "RSA / SHA-1 compatibility" },
  { value: "RSA256", label: "RSA / SHA-256" },
  { value: "RSA512", label: "RSA / SHA-512" },
];

export const WRITE_POLICIES: Choice[] = [
  { value: "ALLOW", label: "Allow redeploy" },
  { value: "ALLOW_ONCE", label: "Disable redeploy" },
  { value: "DENY", label: "Read-only" },
];

export const VERSION_POLICIES: Choice[] = [
  { value: "RELEASE", label: "Release" },
  { value: "SNAPSHOT", label: "Snapshot" },
  { value: "MIXED", label: "Mixed" },
];

export const LAYOUT_POLICIES: Choice[] = [
  { value: "STRICT", label: "Strict" },
  { value: "PERMISSIVE", label: "Permissive" },
];

/** Swift proxies are pinned to the Nexus-compatible GitHub source mode. */
export const SWIFT_REMOTE_URL = "https://github.com/";

/** Upstream defaults the console prefills for proxy repositories. */
export const PROXY_REMOTE_URLS: Record<string, string> = {
  maven2: "https://repo.maven.apache.org/maven2/",
  npm: "https://registry.npmjs.org/",
  pypi: "https://pypi.org/",
  helm: "https://charts.bitnami.com/bitnami",
  nuget: "https://api.nuget.org/v3/index.json",
  rubygems: "https://rubygems.org/",
  yum: "https://download.fedoraproject.org/pub/fedora/linux/",
  raw: "https://example.com/",
  docker: "https://registry-1.docker.io/",
  cargo: "https://index.crates.io/",
  pub: "https://pub.dev/",
  composer: "https://repo.packagist.org/",
  terraform: "https://registry.terraform.io/",
  swift: SWIFT_REMOTE_URL,
  ansiblegalaxy: "https://galaxy.ansible.com/",
  conda: "https://repo.anaconda.com/pkgs/main/",
  conan: "https://center2.conan.io/",
  apt: "https://deb.debian.org/debian/",
  alpine: "https://dl-cdn.alpinelinux.org/alpine/",
  r: "https://cloud.r-project.org/",
  huggingface: "https://huggingface.co/",
};

export interface RepositoryRecipeOption {
  value: string;
  label: string;
  format: string;
  type: string;
}

export interface AptSettingsView {
  distribution?: string | null;
  component?: string | null;
  architectures?: string[] | null;
  flat?: boolean | null;
  enforceDistribution?: boolean | null;
  metadataMode?: string | null;
  validUntilDays?: number | null;
  origin?: string | null;
  label?: string | null;
}

export interface AlpineSettingsView {
  distributions?: string[] | null;
  channels?: string[] | null;
  architectures?: string[] | null;
  metadataMode?: string | null;
  verifyUpstreamSignatures?: boolean | null;
  staleIfError?: boolean | null;
  keyFilename?: string | null;
  signatureType?: string | null;
  description?: string | null;
  upstreamPublicKeys?: string[] | null;
}

export interface ProxySettingsView {
  remoteUrl?: string | null;
  contentMaxAgeMinutes?: number | null;
  metadataMaxAgeMinutes?: number | null;
  autoBlock?: boolean | null;
  remoteAuthenticationType?: string | null;
  remoteNtlmDomain?: string | null;
  remoteNtlmHost?: string | null;
  remoteUsername?: string | null;
  remotePasswordConfigured?: boolean | null;
  remoteBearerTokenConfigured?: boolean | null;
  outboundProxyType?: string | null;
  outboundProxyHost?: string | null;
  outboundProxyPort?: number | null;
  outboundProxyUsername?: string | null;
  outboundProxyPasswordConfigured?: boolean | null;
  minimumReleaseAgeMinutes?: number | null;
  allowedRedirectHosts?: string[] | null;
}

export interface RepositoryViewLike {
  id?: number | null;
  name: string;
  recipe?: string | null;
  format?: string | null;
  type?: string | null;
  online?: boolean;
  blobStoreName?: string | null;
  strictContentTypeValidation?: boolean;
  url?: string | null;
  hosted?: { writePolicy?: string | null; versionPolicy?: string | null; layoutPolicy?: string | null } | null;
  proxy?: ProxySettingsView | null;
  raw?: { contentDisposition?: string | null } | null;
  docker?: { connectorEnabled?: boolean | null; connectorPort?: number | null; connectorPublicUrl?: string | null } | null;
  cargo?: { requireAuthentication?: boolean | null } | null;
  group?: { memberNames?: string[] | null } | null;
  apt?: AptSettingsView | null;
  alpine?: AlpineSettingsView | null;
  pypi?: { indexPath?: string | null } | null;
  yum?: { repodataDepth?: number | null } | null;
  conan?: { manifestMaxEntries?: number | null; manifestMaxBytes?: number | null } | null;
}

export interface RepositoryDraft {
  name: string;
  recipe: string;
  online: boolean;
  strictContentTypeValidation: boolean;
  blobStoreName: string;
  writePolicy: string;
  versionPolicy: string;
  layoutPolicy: string;
  remoteUrl: string;
  contentMaxAgeMinutes: number | string | null;
  metadataMaxAgeMinutes: number | string | null;
  autoBlock: boolean;
  remoteAuthenticationType: string;
  remoteNtlmDomain: string;
  remoteNtlmHost: string;
  remoteUsername: string;
  remotePassword: string;
  remotePasswordClear: boolean;
  remoteBearerToken: string;
  remoteBearerTokenClear: boolean;
  outboundProxyType: string;
  outboundProxyHost: string;
  outboundProxyPort: number | string | null;
  outboundProxyUsername: string;
  outboundProxyPassword: string;
  outboundProxyPasswordClear: boolean;
  minimumReleaseAgeMinutes: number | string | null;
  allowedRedirectHosts: string;
  memberText: string;
  contentDisposition: string;
  dockerConnectorEnabled: boolean;
  dockerConnectorPort: number | string | null;
  dockerConnectorPublicUrl: string;
  cargoRequireAuthentication: boolean;
  aptDistribution: string;
  aptComponent: string;
  aptArchitectures: string;
  aptFlat: boolean;
  aptEnforceDistribution: boolean;
  aptMetadataMode: string;
  aptValidUntilDays: number | string | null;
  aptOrigin: string;
  aptLabel: string;
  alpineDistributions: string;
  alpineChannels: string;
  alpineArchitectures: string;
  alpineMetadataMode: string;
  alpineVerifyUpstreamSignatures: boolean;
  alpineStaleIfError: boolean;
  alpineKeyFilename: string;
  alpineSignatureType: string;
  alpineDescription: string;
  alpineUpstreamPublicKey: string;
  pypiIndexPath: string;
  yumRepodataDepth: number | string | null;
  conanManifestMaxEntries: number | string | null;
  conanManifestMaxBytes: number | string | null;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function trimmedOrNull(value: unknown): string | null {
  const normalized = text(value).trim();
  return normalized ? normalized : null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: unknown): string[] {
  return text(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joined(values: unknown, fallback: string): string {
  return Array.isArray(values) && values.length ? values.join(", ") : fallback;
}

/** Creates the "create repository" draft with the upstream console defaults. */
export function createRepositoryDraft(
  recipe?: RepositoryRecipeOption,
  blobStoreName = "",
): RepositoryDraft {
  return {
    name: "",
    recipe: recipe?.value ?? "",
    online: true,
    strictContentTypeValidation: true,
    blobStoreName,
    writePolicy: "ALLOW_ONCE",
    versionPolicy: "RELEASE",
    layoutPolicy: "STRICT",
    remoteUrl: "",
    contentMaxAgeMinutes: 1440,
    metadataMaxAgeMinutes: 1440,
    autoBlock: true,
    remoteAuthenticationType: "auto",
    remoteNtlmDomain: "",
    remoteNtlmHost: "",
    remoteUsername: "",
    remotePassword: "",
    remotePasswordClear: false,
    remoteBearerToken: "",
    remoteBearerTokenClear: false,
    outboundProxyType: "",
    outboundProxyHost: "",
    outboundProxyPort: null,
    outboundProxyUsername: "",
    outboundProxyPassword: "",
    outboundProxyPasswordClear: false,
    minimumReleaseAgeMinutes: 0,
    allowedRedirectHosts: "",
    memberText: "",
    contentDisposition: "",
    dockerConnectorEnabled: false,
    dockerConnectorPort: null,
    dockerConnectorPublicUrl: "",
    cargoRequireAuthentication: false,
    aptDistribution: "stable",
    aptComponent: "main",
    aptArchitectures: "amd64",
    aptFlat: false,
    aptEnforceDistribution: false,
    aptMetadataMode: "PASSTHROUGH",
    aptValidUntilDays: 30,
    aptOrigin: "kkRepo",
    aptLabel: "kkRepo",
    alpineDistributions: "v3.23",
    alpineChannels: "main",
    alpineArchitectures: "x86_64, aarch64",
    alpineMetadataMode: "PASSTHROUGH",
    alpineVerifyUpstreamSignatures: false,
    alpineStaleIfError: true,
    alpineKeyFilename: "kkrepo-alpine.rsa.pub",
    alpineSignatureType: "RSA",
    alpineDescription: "kkRepo Alpine repository",
    alpineUpstreamPublicKey: "",
    pypiIndexPath: "/simple",
    yumRepodataDepth: 0,
    conanManifestMaxEntries: null,
    conanManifestMaxBytes: null,
  };
}

/** Builds an edit draft from a repository view; secrets are never prefilled. */
export function repositoryDraftFromView(repo: RepositoryViewLike): RepositoryDraft {
  const proxy = repo.proxy ?? {};
  const apt = repo.apt ?? {};
  const alpine = repo.alpine ?? {};
  const type = String(repo.type ?? "").toUpperCase();
  const outboundProxyType = text(proxy.outboundProxyType).toUpperCase();
  return {
    ...createRepositoryDraft(undefined, repo.blobStoreName ?? ""),
    name: repo.name,
    recipe: repo.recipe ?? "",
    online: repo.online ?? true,
    strictContentTypeValidation: Boolean(repo.strictContentTypeValidation),
    writePolicy: repo.hosted?.writePolicy ?? "ALLOW_ONCE",
    versionPolicy: repo.hosted?.versionPolicy ?? "RELEASE",
    layoutPolicy: repo.hosted?.layoutPolicy ?? "STRICT",
    remoteUrl: proxy.remoteUrl ?? "",
    contentMaxAgeMinutes: proxy.contentMaxAgeMinutes ?? 1440,
    metadataMaxAgeMinutes: proxy.metadataMaxAgeMinutes ?? 1440,
    autoBlock: proxy.autoBlock !== false,
    remoteAuthenticationType: proxy.remoteAuthenticationType ?? "auto",
    remoteNtlmDomain: proxy.remoteNtlmDomain ?? "",
    remoteNtlmHost: proxy.remoteNtlmHost ?? "",
    remoteUsername: proxy.remoteUsername ?? "",
    remotePassword: "",
    remotePasswordClear: false,
    remoteBearerToken: "",
    remoteBearerTokenClear: false,
    outboundProxyType: outboundProxyType === "SOCKS5" ? "SOCKS" : outboundProxyType,
    outboundProxyHost: proxy.outboundProxyHost ?? "",
    outboundProxyPort: proxy.outboundProxyPort ?? null,
    outboundProxyUsername: proxy.outboundProxyUsername ?? "",
    outboundProxyPassword: "",
    outboundProxyPasswordClear: false,
    minimumReleaseAgeMinutes: proxy.minimumReleaseAgeMinutes ?? 0,
    allowedRedirectHosts: (proxy.allowedRedirectHosts ?? []).join("\n"),
    memberText: (repo.group?.memberNames ?? []).join("\n"),
    contentDisposition: repo.raw?.contentDisposition ?? "",
    dockerConnectorEnabled: repo.docker?.connectorEnabled ?? false,
    dockerConnectorPort: repo.docker?.connectorPort ?? null,
    dockerConnectorPublicUrl: repo.docker?.connectorPublicUrl ?? "",
    cargoRequireAuthentication: repo.cargo?.requireAuthentication ?? false,
    aptDistribution: apt.distribution ?? "stable",
    aptComponent: apt.component ?? "main",
    aptArchitectures: joined(apt.architectures, "amd64"),
    aptFlat: Boolean(apt.flat),
    aptEnforceDistribution: Boolean(apt.enforceDistribution),
    aptMetadataMode: apt.metadataMode ?? (type === "HOSTED" ? "RESIGN" : "PASSTHROUGH"),
    aptValidUntilDays: apt.validUntilDays ?? 0,
    aptOrigin: apt.origin ?? "kkRepo",
    aptLabel: apt.label ?? "kkRepo",
    alpineDistributions: joined(alpine.distributions, "v3.23"),
    alpineChannels: joined(alpine.channels, "main"),
    alpineArchitectures: joined(alpine.architectures, "x86_64, aarch64"),
    alpineMetadataMode: alpine.metadataMode ?? (type === "PROXY" ? "PASSTHROUGH" : "RESIGN"),
    alpineVerifyUpstreamSignatures: Boolean(alpine.verifyUpstreamSignatures),
    alpineStaleIfError: alpine.staleIfError !== false,
    alpineKeyFilename: alpine.keyFilename ?? `${repo.name}.rsa.pub`,
    alpineSignatureType: alpine.signatureType ?? "RSA",
    alpineDescription: alpine.description ?? "kkRepo Alpine repository",
    alpineUpstreamPublicKey: (alpine.upstreamPublicKeys ?? [])[0] ?? "",
    pypiIndexPath: repo.pypi?.indexPath ?? "/simple",
    yumRepodataDepth: repo.yum?.repodataDepth ?? 0,
    conanManifestMaxEntries: repo.conan?.manifestMaxEntries ?? null,
    conanManifestMaxBytes: repo.conan?.manifestMaxBytes ?? null,
  };
}

/**
 * Re-derives the values that depend on the selected recipe (proxy defaults,
 * forced metadata modes). Only called while creating; edits keep stored values.
 */
export function applyRecipeDefaults(draft: RepositoryDraft, format: string, type: string): void {
  if (type === "PROXY") {
    if (format === "swift") {
      draft.remoteUrl = SWIFT_REMOTE_URL;
    } else if (!draft.remoteUrl.trim() && PROXY_REMOTE_URLS[format]) {
      draft.remoteUrl = PROXY_REMOTE_URLS[format];
    }
  }
  if (format === "apt") {
    if (type === "HOSTED") {
      draft.aptMetadataMode = "RESIGN";
      draft.aptFlat = false;
      draft.aptEnforceDistribution = true;
    } else if (type === "PROXY" && draft.aptFlat) {
      draft.aptMetadataMode = "PASSTHROUGH";
    }
  }
  if (format === "alpine") {
    if (type !== "PROXY") {
      draft.alpineMetadataMode = "RESIGN";
      draft.alpineVerifyUpstreamSignatures = true;
    } else if (draft.alpineMetadataMode === "RESIGN") {
      draft.alpineVerifyUpstreamSignatures = true;
    }
  }
  if (format === "pypi" && type === "PROXY" && !draft.pypiIndexPath) {
    draft.pypiIndexPath = "/simple";
  }
}

/**
 * Alpine namespace targeted by the "rebuild index" action: the first configured
 * distribution/channel/architecture, matching the upstream console.
 */
export function firstAlpineNamespace(draft: RepositoryDraft): string {
  const first = (value: unknown, fallback: string) => splitList(value)[0] ?? fallback;
  return [
    first(draft.alpineDistributions, "v3.23"),
    first(draft.alpineChannels, "main"),
    first(draft.alpineArchitectures, "x86_64"),
  ].join("/");
}

/** Builds the create/update request body for the repository API. */
export function buildRepositoryPayload(
  draft: RepositoryDraft,
  format: string,
  type: string,
  creating: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    online: Boolean(draft.online),
    strictContentTypeValidation: Boolean(draft.strictContentTypeValidation),
  };
  if (creating) {
    payload.name = draft.name.trim();
    payload.recipe = draft.recipe || null;
    payload.blobStoreName = draft.blobStoreName || null;
  }
  if (type === "HOSTED") {
    payload.hosted = {
      writePolicy: draft.writePolicy,
      versionPolicy: format === "maven2" ? draft.versionPolicy : null,
      layoutPolicy: format === "maven2" ? draft.layoutPolicy : null,
    };
  } else if (type === "PROXY") {
    payload.proxy = {
      remoteUrl: format === "swift" ? SWIFT_REMOTE_URL : draft.remoteUrl.trim(),
      contentMaxAgeMinutes: numberOrNull(draft.contentMaxAgeMinutes),
      metadataMaxAgeMinutes: numberOrNull(draft.metadataMaxAgeMinutes),
      autoBlock: Boolean(draft.autoBlock),
      remoteAuthenticationType: format === "nuget" ? draft.remoteAuthenticationType || "auto" : "auto",
      remoteNtlmDomain: trimmedOrNull(draft.remoteNtlmDomain),
      remoteNtlmHost: trimmedOrNull(draft.remoteNtlmHost),
      remoteUsername: trimmedOrNull(draft.remoteUsername),
      remotePassword: trimmedOrNull(draft.remotePassword),
      remotePasswordConfigured: draft.remotePasswordClear ? false : null,
      remoteBearerToken: trimmedOrNull(draft.remoteBearerToken),
      remoteBearerTokenConfigured: draft.remoteBearerTokenClear ? false : null,
      outboundProxyType: draft.outboundProxyType,
      outboundProxyHost: trimmedOrNull(draft.outboundProxyHost),
      outboundProxyPort: numberOrNull(draft.outboundProxyPort),
      outboundProxyUsername: trimmedOrNull(draft.outboundProxyUsername),
      outboundProxyPassword: trimmedOrNull(draft.outboundProxyPassword),
      outboundProxyPasswordConfigured: draft.outboundProxyPasswordClear ? false : null,
      minimumReleaseAgeMinutes: format === "npm" ? numberOrNull(draft.minimumReleaseAgeMinutes) ?? 0 : null,
      allowedRedirectHosts: splitList(draft.allowedRedirectHosts),
    };
  } else if (type === "GROUP") {
    payload.group = { memberNames: splitList(draft.memberText) };
  }

  switch (format) {
    case "raw":
      payload.raw = { contentDisposition: trimmedOrNull(draft.contentDisposition) };
      break;
    case "docker":
      payload.docker = {
        connectorEnabled: Boolean(draft.dockerConnectorEnabled),
        connectorPort: numberOrNull(draft.dockerConnectorPort),
        connectorPublicUrl: trimmedOrNull(draft.dockerConnectorPublicUrl),
      };
      break;
    case "cargo":
      payload.cargo = { requireAuthentication: Boolean(draft.cargoRequireAuthentication) };
      break;
    case "apt": {
      const hosted = type === "HOSTED";
      const flat = hosted ? false : Boolean(draft.aptFlat);
      const metadataMode = hosted
        ? "RESIGN"
        : flat || draft.aptMetadataMode !== "RESIGN" ? "PASSTHROUGH" : "RESIGN";
      payload.apt = {
        distribution: draft.aptDistribution.trim(),
        component: draft.aptComponent.trim() || "main",
        architectures: splitList(draft.aptArchitectures),
        flat,
        enforceDistribution: hosted ? true : Boolean(draft.aptEnforceDistribution),
        metadataMode,
        validUntilDays: numberOrNull(draft.aptValidUntilDays) ?? 0,
        origin: draft.aptOrigin.trim(),
        label: draft.aptLabel.trim(),
      };
      break;
    }
    case "alpine": {
      const proxy = type === "PROXY";
      const metadataMode = proxy
        ? draft.alpineMetadataMode === "RESIGN" ? "RESIGN" : "PASSTHROUGH"
        : "RESIGN";
      const resignProxy = proxy && metadataMode === "RESIGN";
      payload.alpine = {
        distributions: splitList(draft.alpineDistributions),
        channels: splitList(draft.alpineChannels),
        architectures: splitList(draft.alpineArchitectures),
        metadataMode,
        verifyUpstreamSignatures: proxy ? Boolean(draft.alpineVerifyUpstreamSignatures) : true,
        staleIfError: Boolean(draft.alpineStaleIfError),
        keyFilename: trimmedOrNull(draft.alpineKeyFilename),
        signatureType: draft.alpineSignatureType || "RSA",
        description: trimmedOrNull(draft.alpineDescription),
        upstreamPublicKeys: resignProxy && draft.alpineUpstreamPublicKey.trim()
          ? [draft.alpineUpstreamPublicKey.trim()]
          : [],
      };
      break;
    }
    case "pypi":
      if (type === "PROXY") {
        payload.pypi = { indexPath: draft.pypiIndexPath.trim() };
      }
      break;
    case "yum":
      if (type === "HOSTED") {
        payload.yum = { repodataDepth: numberOrNull(draft.yumRepodataDepth) ?? 0 };
      }
      break;
    case "conan":
      if (type !== "GROUP") {
        payload.conan = {
          manifestMaxEntries: numberOrNull(draft.conanManifestMaxEntries),
          manifestMaxBytes: numberOrNull(draft.conanManifestMaxBytes),
        };
      }
      break;
    default:
      break;
  }
  return payload;
}
