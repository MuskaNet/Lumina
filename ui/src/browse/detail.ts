/**
 * Data builders for the repository detail pane and tree icons.
 *
 * These functions port the legacy browse console's Summary, Docker metadata,
 * attribute and file-icon logic to plain data structures. The Vue pane only
 * renders what is returned here, so label wording and formatting match the
 * legacy strings exactly.
 */
import type {
  AttributeGroup,
  AttributeValues,
  BrowseAssetDetail,
  BrowseEntry,
  DescriptorGroup,
  DescriptorRow,
  DetailPanel,
  SummaryRow,
} from "./browseModel";
import { formatAttributeValue, formatBytesDetail, formatInstant } from "./formatters";

interface FileIconRule {
  readonly icon: string;
  readonly suffixes: ReadonlyArray<string>;
}

/**
 * Legacy suffix rules in their original priority order, translated from lucide
 * icon names to Material Symbols ligatures.
 */
const FILE_ICON_RULES: ReadonlyArray<FileIconRule> = [
  { icon: "key", suffixes: [".tgz.prov", ".prov", ".asc", ".sig", ".key"] },
  { icon: "fact_check", suffixes: [".sha1", ".sha256", ".sha512", ".md5"] },
  { icon: "data_object", suffixes: [".json", ".module", ".info"] },
  { icon: "code", suffixes: [".pom", ".xml", ".nuspec"] },
  { icon: "description", suffixes: [".mod", ".sum", ".list", ".yaml", ".yml"] },
  { icon: "layers", suffixes: [".safetensors"] },
  { icon: "data_object", suffixes: [".bin"] },
  {
    icon: "inventory_2",
    suffixes: [".whl", ".egg", ".nupkg", ".snupkg", ".crate", ".gem", ".rpm"],
  },
  { icon: "deployed_code", suffixes: [".jar", ".war", ".ear", ".aar"] },
  {
    icon: "archive",
    suffixes: [
      ".zip", ".tar.bz2", ".tbz", ".tar.gz", ".tgz",
      ".tlz", ".tar.lz", ".tar.lzma", ".tar.xz", ".txz", ".tar.z", ".tz", ".taz",
      ".tar", ".gemspec.rz", ".rz", ".xml.gz", ".sqlite.bz2", ".gz",
    ],
  },
];

const DEFAULT_FILE_ICON = "description";
const VERSION_DIR_RE = /^\d/;

const ATTRIBUTE_GROUP_DEFINITIONS: ReadonlyArray<readonly [string, keyof BrowseAssetDetail]> = [
  ["Checksum", "checksum"],
  ["Content", "content"],
  ["Docker", "docker"],
  ["Npm", "npm"],
  ["Pub", "pub"],
  ["Composer", "composer"],
  ["Conda", "conda"],
  ["Apt", "apt"],
  ["Alpine", "alpine"],
  ["R / CRAN", "r"],
  ["Hugging Face", "huggingface"],
  ["Swift", "swift"],
  ["Ansible Galaxy", "ansible"],
  ["Provenance", "provenance"],
];

function pathSegments(path: string): string[] {
  return (path || "").split("/").filter(Boolean);
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Returns the value when it should be shown in a key/value row, `null` otherwise. */
function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function bytesValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function row(label: string, value: string, code = false): SummaryRow {
  return code ? { label, value, code: true } : { label, value };
}

function optionalRow(label: string, value: string | null, code = false): SummaryRow | null {
  if (value === null || value === "") return null;
  return row(label, value, code);
}

function optionalBytesRow(label: string, value: unknown): SummaryRow | null {
  const bytes = bytesValue(value);
  return bytes === null ? null : row(label, formatBytesDetail(bytes));
}

function compactRows(rows: ReadonlyArray<SummaryRow | null>): SummaryRow[] {
  const result: SummaryRow[] = [];
  for (const item of rows) {
    if (item !== null) result.push(item);
  }
  return result;
}

/** Docker attributes arrive as an untyped attribute map from the browse API. */
function dockerAttributes(detail: BrowseAssetDetail | null): AttributeValues {
  return detail?.docker ?? {};
}

/** Reads an array-of-objects attribute (platforms, descriptors, referrers). */
function attributeList(docker: AttributeValues, key: string): AttributeValues[] {
  const value = docker[key];
  if (!Array.isArray(value)) return [];
  const entries: AttributeValues[] = [];
  for (const item of value) {
    if (item !== null && typeof item === "object") entries.push(item as AttributeValues);
  }
  return entries;
}

function dockerKindLabel(kind: unknown): string {
  const normalized = textValue(kind).toUpperCase();
  if (normalized === "MANIFEST") return "Manifest";
  if (normalized === "BLOB") return "Blob";
  return normalized || "-";
}

function dockerActorRows(detail: BrowseAssetDetail | null): SummaryRow[] {
  const uploader = detail?.uploader || "-";
  const uploaderIp = detail?.uploaderIp || "";
  const proxy = uploader === "proxy";
  const rows = [row(proxy ? "Cached by" : "Uploaded by", uploader)];
  if (uploaderIp) rows.push(row(proxy ? "Remote" : "Uploader IP", uploaderIp));
  return rows;
}

function dockerSizeRows(
  docker: AttributeValues,
  detail: BrowseAssetDetail | null,
  entry: BrowseEntry,
): SummaryRow[] {
  const fallback = bytesValue(detail?.size) ?? bytesValue(entry.size);
  const manifestSize = bytesValue(docker.manifest_size_bytes) ?? fallback;
  const blobSize = bytesValue(docker.blob_size_bytes) ?? fallback;
  if (textValue(docker.asset_kind).toUpperCase() === "BLOB") {
    return [row("Blob size", formatBytesDetail(blobSize))];
  }
  const rows = [row("Manifest size", formatBytesDetail(manifestSize))];
  const imageSize = bytesValue(docker.layer_size_bytes);
  if (imageSize !== null) rows.push(row("Image size", formatBytesDetail(imageSize)));
  const cachedImageSize = bytesValue(docker.cached_image_size_bytes);
  if (cachedImageSize !== null) {
    rows.push(row("Cached image size", formatBytesDetail(cachedImageSize)));
  }
  return rows;
}

function platformDescriptorRows(platforms: AttributeValues[]): DescriptorRow[] {
  return platforms.map((platform) => {
    const descriptor: DescriptorRow = { digest: textValue(platform.digest) };
    const sizeBytes = bytesValue(platform.cached_image_size_bytes)
      ?? bytesValue(platform.manifest_size_bytes);
    if (sizeBytes !== null) descriptor.sizeBytes = sizeBytes;
    const label = optionalText(platform.platform);
    if (label !== null) descriptor.platform = label;
    return descriptor;
  });
}

function descriptorRows(descriptors: AttributeValues[]): DescriptorRow[] {
  return descriptors.map((item) => {
    const descriptor: DescriptorRow = { digest: textValue(item.digest) };
    const mediaType = optionalText(item.media_type);
    if (mediaType !== null) descriptor.mediaType = mediaType;
    const sizeBytes = bytesValue(item.size_bytes);
    if (sizeBytes !== null) descriptor.sizeBytes = sizeBytes;
    const platform = optionalText(item.platform);
    if (platform !== null) descriptor.platform = platform;
    return descriptor;
  });
}

function referrerRows(referrers: AttributeValues[]): DescriptorRow[] {
  return referrers.map((referrer) => {
    const descriptor: DescriptorRow = { digest: textValue(referrer.digest) };
    const artifactType = optionalText(referrer.artifact_type) ?? optionalText(referrer.media_type);
    if (artifactType !== null) descriptor.artifactType = artifactType;
    const sizeBytes = bytesValue(referrer.size_bytes);
    if (sizeBytes !== null) descriptor.sizeBytes = sizeBytes;
    const imageName = optionalText(referrer.image_name);
    if (imageName !== null) descriptor.imageName = imageName;
    return descriptor;
  });
}

/**
 * True when the selected asset belongs to a Docker/OCI repository.
 *
 * Mirrors the legacy check: the repository format is authoritative, but assets
 * can still expose Docker metadata through their `asset_kind` attribute (for
 * example when the caller only has the asset detail payload).
 */
export function isDockerDetail(
  repositoryFormat: string | null | undefined,
  detail: BrowseAssetDetail | null,
): boolean {
  const format = textValue(repositoryFormat).toLowerCase();
  return format === "docker" || optionalText(dockerAttributes(detail).asset_kind) !== null;
}

/**
 * Derives the image name from a Docker repository path.
 *
 * Handles both the shared `/v2` layout and the legacy `docker/manifests/...`
 * prefix; returns an empty string for paths that are not Docker asset paths.
 */
export function imageNameFromDockerPath(path: string): string {
  const parts = pathSegments(path);
  const manifests = parts.lastIndexOf("manifests");
  if (manifests > 0) {
    const start = parts[0] === "v2"
      ? 1
      : parts[0] === "docker" && parts[1] === "manifests" ? 2 : 0;
    return parts.slice(start, manifests).join("/");
  }
  const blobs = parts.lastIndexOf("blobs");
  if (blobs > 0) {
    const start = parts[0] === "v2" ? 1 : 0;
    return parts.slice(start, blobs).join("/");
  }
  return "";
}

/**
 * Derives the tag from a Docker repository path, or an empty string when the
 * reference segment is a digest.
 */
export function dockerTagFromDockerPath(path: string): string {
  const parts = pathSegments(path);
  const manifests = parts.lastIndexOf("manifests");
  if (manifests >= 0 && parts[manifests + 1]) {
    const reference = parts[manifests + 1];
    return reference.includes(":") ? "" : reference;
  }
  return "";
}

/**
 * Resolves the image, tag/reference and digest shown by the Docker summary.
 *
 * Docker attributes win over path-derived values; the digest falls back to the
 * raw bytes digest and the reference falls back to `latest`, as in the legacy
 * console.
 */
export function dockerCoordinates(
  entry: BrowseEntry,
  detail: BrowseAssetDetail | null,
): { image: string; reference: string; digest: string } {
  const docker = dockerAttributes(detail);
  const image = textValue(docker.image_name) || imageNameFromDockerPath(entry.path);
  const reference = textValue(docker.reference) || dockerTagFromDockerPath(entry.path) || "latest";
  const digest = textValue(docker.digest) || textValue(docker.raw_bytes_digest);
  return { image, reference, digest };
}

/**
 * Builds the Summary panel for the selected asset.
 *
 * Docker assets use the legacy Docker rows (image, reference, digest, asset
 * type, manifest/blob size, cached platform, actor rows); every other format
 * uses the generic uploader/size/content-type/SHA-1 rows.
 */
export function summaryPanel(
  repositoryName: string,
  entry: BrowseEntry,
  detail: BrowseAssetDetail | null,
): DetailPanel {
  const sourceRepository = detail?.sourceRepository || entry.sourceRepository || "";
  const rows: SummaryRow[] = [row("Repository", repositoryName)];
  if (sourceRepository && sourceRepository !== repositoryName) {
    rows.push(row("Source repository", sourceRepository));
  }
  rows.push(row("Path", entry.path));

  if (!isDockerDetail(undefined, detail)) {
    rows.push(row("Uploader", detail?.uploader || "-"));
    const uploaderIp = detail?.uploaderIp || "";
    if (uploaderIp) rows.push(row("Uploader IP", uploaderIp));
    rows.push(row("Size", formatBytesDetail(detail?.size ?? entry.size)));
    rows.push(row("Content-Type", detail?.contentType || entry.contentType || "-"));
    rows.push(row("Last updated", formatInstant(detail?.lastUpdatedAt || entry.lastUpdatedAt)));
    rows.push(row("SHA-1", textValue(detail?.checksum?.sha1) || entry.sha1 || "-", true));
    return { title: "Summary", rows };
  }

  const docker = dockerAttributes(detail);
  const { image, reference, digest } = dockerCoordinates(entry, detail);
  const imageRow = optionalRow("Image", optionalText(image));
  if (imageRow !== null) rows.push(imageRow);
  rows.push(row("Reference", reference || digest || "-"));
  rows.push(row("Digest", digest || textValue(docker.raw_bytes_digest) || "-", true));
  rows.push(row("Asset type", dockerKindLabel(docker.asset_kind)));
  rows.push(...dockerSizeRows(docker, detail, entry));
  const cachedPlatform = optionalRow("Cached platform", optionalText(docker.cached_image_platform));
  if (cachedPlatform !== null) rows.push(cachedPlatform);
  rows.push(...dockerActorRows(detail));
  rows.push(row("Last updated", formatInstant(detail?.lastUpdatedAt || entry.lastUpdatedAt)));
  return { title: "Summary", rows };
}

/**
 * Builds the Docker metadata panel with its counts, tags and descriptor groups.
 *
 * Returns `null` when the asset has no Docker attributes at all, matching the
 * legacy behavior of not rendering the panel.
 */
export function dockerMetadataPanel(detail: BrowseAssetDetail | null): DetailPanel | null {
  const docker = dockerAttributes(detail);
  if (Object.keys(docker).length === 0) return null;

  const platforms = attributeList(docker, "platforms");
  const configs = attributeList(docker, "config_descriptors");
  const layers = attributeList(docker, "layer_descriptors");
  const manifests = attributeList(docker, "manifest_descriptors");
  const referrers = attributeList(docker, "referrers");

  const layerCount = optionalText(docker.layer_count);
  const cachedLayerCount = optionalText(docker.cached_layer_count);
  const cachedLayers = cachedLayerCount === null
    ? null
    : layerCount === null ? cachedLayerCount : `${cachedLayerCount} / ${layerCount}`;

  const platformCount = optionalText(docker.platform_count);
  const cachedPlatformCount = optionalText(docker.cached_platform_count);
  const cachedPlatforms = cachedPlatformCount === null
    ? null
    : platformCount === null ? cachedPlatformCount : `${cachedPlatformCount} / ${platformCount}`;

  const rows = compactRows([
    optionalRow("Media type", optionalText(docker.media_type) ?? optionalText(detail?.contentType)),
    optionalRow("Layers", layerCount),
    optionalRow("Cached layers", cachedLayers),
    optionalBytesRow("Layer size", docker.layer_size_bytes),
    optionalBytesRow("Cached layer size", docker.cached_layer_size_bytes),
    optionalBytesRow("Referenced size", docker.referenced_size_bytes),
    optionalRow("Platforms", platformCount),
    optionalRow("Cached platforms", cachedPlatforms),
    optionalRow("Platform summary", optionalText(docker.platform_summary)),
    optionalRow("Descriptors", optionalText(docker.descriptor_count)),
    optionalRow(
      "Tags",
      Array.isArray(docker.tags) ? docker.tags.map((tag) => textValue(tag)).join(", ") : null,
    ),
    optionalRow("Referrers", optionalText(docker.referrer_count)),
  ]);

  const groups: DescriptorGroup[] = [];
  if (platforms.length) groups.push({ title: "Platforms", rows: platformDescriptorRows(platforms) });
  if (configs.length) groups.push({ title: "Config", rows: descriptorRows(configs) });
  if (layers.length) groups.push({ title: "Layers", rows: descriptorRows(layers) });
  if (manifests.length) {
    groups.push({ title: "Child manifests", rows: descriptorRows(manifests) });
  }
  if (referrers.length) groups.push({ title: "Referrers", rows: referrerRows(referrers) });
  return { title: "Docker metadata", rows, groups };
}

function attributeMap(
  detail: BrowseAssetDetail | null,
  key: keyof BrowseAssetDetail,
): AttributeValues | null {
  const value = detail?.[key];
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as AttributeValues;
}

/**
 * Builds the Attributes panel groups in the legacy order, skipping empty ones.
 *
 * Row labels stay as the raw attribute keys (the legacy pane printed
 * `asset_kind`, `platform_summary`, ... verbatim); values are rendered through
 * the shared `formatAttributeValue`. Docker attributes are omitted when the
 * caller renders a dedicated Docker metadata panel (`hideDocker`).
 */
export function attributeGroups(
  detail: BrowseAssetDetail | null,
  opts: { hideDocker?: boolean } = {},
): AttributeGroup[] {
  if (!detail) return [];
  const groups: AttributeGroup[] = [];
  for (const [title, key] of ATTRIBUTE_GROUP_DEFINITIONS) {
    if (opts.hideDocker && key === "docker") continue;
    const values = attributeMap(detail, key);
    if (values === null) continue;
    const rows: SummaryRow[] = [];
    for (const [label, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      rows.push({ label, value: formatAttributeValue(value) });
    }
    if (rows.length) groups.push({ title, rows });
  }
  return groups;
}

/**
 * Maps a file name (and optional repository format) to a Material Symbols
 * ligature, preserving the legacy format-specific overrides before the generic
 * suffix rules.
 */
export function fileIcon(name: string, format?: string | null): string {
  const normalized = textValue(name).toLowerCase();
  const repositoryFormat = textValue(format).toLowerCase();
  if (repositoryFormat === "alpine" && normalized.endsWith(".apk")) return "archive";
  if (repositoryFormat === "r" && normalized.endsWith(".tar.gz")) return "archive";
  if (repositoryFormat === "cargo" && normalized !== "" && !normalized.includes(".")) {
    return "data_object";
  }
  if (repositoryFormat === "go" && normalized === "list") return "description";
  if (repositoryFormat === "go" && normalized === "@latest") return "data_object";
  if (repositoryFormat === "rubygems"
      && (normalized === "versions" || normalized === "names")) {
    return "description";
  }
  if (repositoryFormat === "docker"
      && (/^[a-f0-9]{64}$/.test(normalized) || /^sha256:[a-f0-9]{64}$/.test(normalized))) {
    return "data_object";
  }
  const rule = FILE_ICON_RULES.find(({ suffixes }) =>
    suffixes.some((suffix) => normalized.endsWith(suffix)));
  return rule?.icon ?? DEFAULT_FILE_ICON;
}

/**
 * Maps a directory name to a Material Symbols ligature: version directories
 * (names starting with a digit, e.g. `1.6`, `1.0-SNAPSHOT`) use the archive
 * icon, everything else uses the folder icon.
 */
export function directoryIcon(name: string): string {
  return VERSION_DIR_RE.test(textValue(name)) ? "archive" : "folder";
}
