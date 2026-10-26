/**
 * Shared types for the browse console.
 *
 * The tree, detail panel, usage snippets and deletion flow all talk about the
 * same shapes: the `GET /internal/browse/{repository}` listing entries, the
 * `GET /internal/browse/{repository}/attributes` asset detail and the panels the
 * detail pane renders. Keeping them here lets the pure modules stay testable
 * without importing Vue components.
 */

export interface DockerConnectorSettings {
  connectorEnabled?: boolean | null;
  connectorPort?: number | string | null;
  connectorPublicUrl?: string | null;
}

export interface AptRepositorySettings {
  distribution?: string | null;
  component?: string | null;
}

export interface AlpineRepositorySettings {
  distributions?: string[] | null;
  channels?: string[] | null;
  architectures?: string[] | null;
  keyFilename?: string | null;
}

/** Repository fields the browse console needs (from `GET /internal/repositories`). */
export interface BrowseRepository {
  name: string;
  format?: string | null;
  type?: string | null;
  online?: boolean;
  url?: string | null;
  docker?: DockerConnectorSettings | null;
  apt?: AptRepositorySettings | null;
  alpine?: AlpineRepositorySettings | null;
}

/** One row of a browse listing, ordered directories first by the server. */
export interface BrowseEntry {
  name: string;
  path: string;
  sourceRepository?: string | null;
  leaf: boolean;
  size?: number | null;
  contentType?: string | null;
  sha1?: string | null;
  lastUpdatedAt?: string | null;
  downloadUrl?: string | null;
}

export type AttributeValues = Record<string, unknown>;

/** Asset detail returned by `GET /internal/browse/{repository}/attributes`. */
export interface BrowseAssetDetail {
  repository?: string | null;
  sourceRepository?: string | null;
  path?: string | null;
  name?: string | null;
  size?: number | null;
  contentType?: string | null;
  lastUpdatedAt?: string | null;
  downloadUrl?: string | null;
  uploader?: string | null;
  uploaderIp?: string | null;
  checksum?: AttributeValues | null;
  content?: AttributeValues | null;
  docker?: AttributeValues | null;
  npm?: AttributeValues | null;
  pub?: AttributeValues | null;
  composer?: AttributeValues | null;
  conda?: AttributeValues | null;
  apt?: AttributeValues | null;
  alpine?: AttributeValues | null;
  r?: AttributeValues | null;
  huggingface?: AttributeValues | null;
  swift?: AttributeValues | null;
  ansible?: AttributeValues | null;
  provenance?: AttributeValues | null;
}

/** A label/value row; `code` renders the value as monospace text. */
export interface SummaryRow {
  label: string;
  value: string;
  code?: boolean;
}

export interface DescriptorRow {
  digest: string;
  mediaType?: string;
  sizeBytes?: number | null;
  platform?: string;
  imageName?: string;
  artifactType?: string;
}

export interface DescriptorGroup {
  title: string;
  rows: DescriptorRow[];
}

/** A rendered detail panel (Summary, Docker metadata, ...). */
export interface DetailPanel {
  title: string;
  rows: SummaryRow[];
  groups?: DescriptorGroup[];
}

export interface AttributeGroup {
  title: string;
  rows: SummaryRow[];
}

export interface UsageSnippet {
  displayName: string;
  snippetText: string;
  description?: string;
}

export interface UsageDetail {
  /** Component-level summary used when a directory (not a single asset) is selected. */
  summaryRows?: SummaryRow[];
  snippets: UsageSnippet[];
}

/** Everything the usage snippet builders need to produce client commands. */
export interface UsageContext {
  repository: BrowseRepository;
  /** Absolute base URL of the repository content, e.g. `https://host/repository/<repo>/`. */
  baseUrl: string;
  origin: string;
  host: string;
  protocol: string;
  /** Loads one browse level; used for latest-version lookups on package directories. */
  fetchChildren: (path: string) => Promise<BrowseEntry[]>;
}

export interface DirectoryDeletionPreviewItem {
  path: string;
  action?: string | null;
}

/** Response of `GET /internal/browse/{repository}/directory-deletion`. */
export interface DirectoryDeletionPreview {
  path: string;
  assetCount: number;
  componentCount: number;
  estimatedBytes?: number | null;
  metadataAssetCount?: number | null;
  selectionToken?: string | null;
  items?: DirectoryDeletionPreviewItem[];
}
