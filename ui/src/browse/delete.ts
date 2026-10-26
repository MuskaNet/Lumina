/**
 * Browse deletion helpers, ported from the legacy console.
 *
 * The tree and detail pane decide whether a row can be deleted here, the delete
 * dialog calls the two directory-deletion endpoints, and the repository listing
 * remains the single source for the format/type rules. Keeping the policy in a
 * pure module (instead of Vue components) mirrors `browse.js` and lets the
 * rules be tested without mounting anything.
 */
import { api } from "../shared/api/client";
import { permissions, session } from "../shared/session";
import type { BrowseEntry, BrowseRepository, DirectoryDeletionPreview } from "./browseModel";

const VERSION_DIR_RE = /^\d/;

/** Formats whose hosted repositories allow deleting a whole directory subtree. */
const DIRECTORY_DELETE_FORMATS = ["maven2", "npm", "pypi", "nuget", "yum", "rubygems", "raw"];

/** Formats whose package/version directories map to a deletable component. */
const COMPONENT_DIRECTORY_FORMATS = ["pypi", "npm", "cargo", "go", "pub", "composer"];

/** Composer paths reserved for repository metadata rather than a package. */
const COMPOSER_RESERVED_SEGMENTS = new Set(["p2", "providers", "packages", "_composer"]);

function pathSegments(path: string): string[] {
  return (path || "").split("/").filter(Boolean);
}

/** One `:`-separated permission part; `*` and comma-separated lists are wildcards. */
function permissionPartMatches(grantedPart: string | undefined, requestedPart: string | undefined): boolean {
  const requested = (requestedPart || "*").toLowerCase();
  return (grantedPart || "*").split(",").some((part) => {
    const normalized = part.trim().toLowerCase();
    return normalized === "*" || normalized === requested;
  });
}

/** Matches a granted permission against a requested one, part by part. */
function permissionMatches(granted: string | undefined, requested: string | undefined): boolean {
  const grantedParts = (granted || "").toLowerCase().split(":");
  const requestedParts = (requested || "").toLowerCase().split(":");
  const length = Math.max(grantedParts.length, requestedParts.length);
  for (let index = 0; index < length; index += 1) {
    if (!permissionPartMatches(grantedParts[index], requestedParts[index])) return false;
  }
  return true;
}

function hasPermission(permission: string): boolean {
  return permissions.value.some((granted) => permissionMatches(granted, permission));
}

/**
 * `Delete` is offered to signed-in accounts that hold the wildcard `nexus:*`
 * grant. Reading the refs at call time keeps the answer in sync with the
 * security context loaded after the browse app boots.
 */
export function hasBrowseDeletePermission(): boolean {
  return Boolean(session.value) && hasPermission("nexus:*");
}

/** Package name encoded by an npm directory path, or `""` for metadata paths. */
function npmPackageName(path: string): string {
  const clean = (path || "").split("/-/")[0] ?? "";
  const parts = pathSegments(clean);
  if (!parts.length) return "";
  if (parts[0]!.startsWith("@")) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "";
  }
  return parts[0]!;
}

/** Cargo index path (`ab/cd/name`) for a crate name. */
function cargoIndexPathForCrate(crateName: string): string {
  const name = String(crateName || "").toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(name)) return "";
  if (name.length === 1) return `1/${name}`;
  if (name.length === 2) return `2/${name}`;
  if (name.length === 3) return `3/${name[0]}/${name}`;
  return `${name.slice(0, 2)}/${name.slice(2, 4)}/${name}`;
}

/** Version encoded in a `<crate>-<version>.crate` filename. */
function cargoVersionFromCrateFile(filename: string, crateName: string): string {
  if (!filename || !filename.endsWith(".crate")) return "";
  const base = filename.slice(0, -".crate".length);
  const prefix = `${crateName}-`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : "";
}

/** Cargo crate coordinates described by a directory path, or empty names. */
function cargoCoordinates(path: string): { name: string; version: string } {
  const parts = pathSegments(path);
  if (!parts.length || parts[0] === "config.json") {
    return { name: "", version: "" };
  }
  if (parts[0] === "crates" && parts.length >= 2) {
    const name = parts[1] || "";
    let version = parts[2] || "";
    const file = parts.at(-1) || "";
    if (!version && file.endsWith(".crate")) {
      version = cargoVersionFromCrateFile(file, name);
    }
    return { name, version };
  }
  if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "crates") {
    return { name: parts[3] || "", version: parts[4] || "" };
  }
  const leaf = parts.at(-1) || "";
  return parts.join("/") === cargoIndexPathForCrate(leaf)
    ? { name: leaf, version: "" }
    : { name: "", version: "" };
}

/** Go module path encoded by a proxy directory path, or `""`. */
function goModulePath(path: string): string {
  const marker = "/@v/";
  if (path.includes(marker)) return path.slice(0, path.indexOf(marker));
  if (path.endsWith("/@latest")) return path.slice(0, -"/@latest".length);
  const parts = pathSegments(path);
  if (parts.length < 2 || parts.includes("@v")) return "";
  return parts.join("/");
}

/** Version encoded in a Pub archive filename. */
function pubVersionFromArchiveFile(filename: string, packageName: string): string {
  if (!filename || !filename.endsWith(".tar.gz")) return "";
  const base = filename.slice(0, -".tar.gz".length);
  const prefix = `${packageName}-`;
  if (base.startsWith(prefix)) return base.slice(prefix.length);
  return base === packageName ? "" : base;
}

/** Dart Pub package coordinates described by a directory path, or empty names. */
function pubCoordinates(path: string): { name: string; version: string } {
  const parts = pathSegments(path);
  if (!parts.length) return { name: "", version: "" };
  if (parts[0] === "packages") {
    const name = parts[1] || "";
    if (parts[2] !== "versions") return { name, version: "" };
    const file = parts[3] || "";
    return { name, version: file.endsWith(".tar.gz") ? file.slice(0, -".tar.gz".length) : "" };
  }
  if (parts[0] === "api" && parts[1] === "archives") {
    const file = parts[2] || "";
    const base = file.endsWith(".tar.gz") ? file.slice(0, -".tar.gz".length) : "";
    const separator = base.indexOf("-");
    return separator > 0
      ? { name: base.slice(0, separator), version: base.slice(separator + 1) }
      : { name: "", version: "" };
  }
  const name = parts[0] || "";
  if (!name || name === "api") return { name: "", version: "" };
  const version = parts[1] || "";
  const file = parts[2] || "";
  if (file === "version.json") return { name, version };
  if (file.endsWith(".tar.gz")) return { name, version: pubVersionFromArchiveFile(file, name) || version };
  return { name, version: parts.length >= 2 ? version : "" };
}

/** Docker image name encoded by a manifest/blob directory path, or `""`. */
function imageNameFromDockerPath(path: string): string {
  const parts = pathSegments(path);
  const manifests = parts.lastIndexOf("manifests");
  if (manifests > 0) {
    const start = parts[0] === "v2" ? 1 : parts[0] === "docker" && parts[1] === "manifests" ? 2 : 0;
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
 * Whether a directory path describes a package (rather than pure metadata), so
 * deleting it deletes a component. Usage snippets can describe arbitrary
 * prefixes; they do not establish a deletable component on their own.
 */
export function hasDirectoryUsage(
  repository: Pick<BrowseRepository, "format" | "type">,
  entry: BrowseEntry,
): boolean {
  if (!repository || !entry || entry.leaf) return false;
  const parts = pathSegments(entry.path);
  switch (repository.format) {
    case "pypi":
      return parts.length >= 1 && parts[0] !== "simple";
    case "npm":
      return Boolean(npmPackageName(entry.path));
    case "cargo":
      return Boolean(cargoCoordinates(entry.path).name);
    case "go":
      return goModulePath(entry.path) === entry.path;
    case "pub":
      return Boolean(pubCoordinates(entry.path).name);
    case "composer":
      return (parts.length === 2 || parts.length === 3)
        && !COMPOSER_RESERVED_SEGMENTS.has(parts[0] || "");
    case "terraform":
      return parts[0] === "v1";
    default:
      return false;
  }
}

/**
 * A hosted repository directory that can be deleted wholesale with the
 * directory-deletion preview endpoint.
 */
export function canDeleteBrowseDirectory(
  repository: Pick<BrowseRepository, "format" | "type">,
  entry: BrowseEntry,
): boolean {
  return hasBrowseDeletePermission()
    && Boolean(entry)
    && !entry.leaf
    && Boolean(entry.path)
    && String(repository.type).toLowerCase() === "hosted"
    && DIRECTORY_DELETE_FORMATS.includes(repository.format || "");
}

/**
 * A directory that maps to one package/version component even when the
 * repository is not hosted (for example a proxy cache entry).
 */
export function canDeleteBrowseComponentDirectory(
  repository: Pick<BrowseRepository, "format" | "type">,
  entry: BrowseEntry,
): boolean {
  if (!hasBrowseDeletePermission() || !entry || entry.leaf || !entry.path) return false;
  const format = repository.format;
  const parts = pathSegments(entry.path);
  if (COMPONENT_DIRECTORY_FORMATS.includes(format || "")) {
    return hasDirectoryUsage(repository, entry);
  }
  if (format === "maven2") return parts.length >= 3 && VERSION_DIR_RE.test(parts.at(-1) || "");
  if (format === "nuget") return parts.length === 2 && VERSION_DIR_RE.test(parts.at(-1) || "");
  if (format === "swift") return parts.length === 3 && VERSION_DIR_RE.test(parts.at(-1) || "");
  if (format === "terraform") {
    return parts[0] === "v1"
      && VERSION_DIR_RE.test(parts.at(-1) || "")
      && ((parts[1] === "modules" && parts.length === 6)
        || (parts[1] === "providers" && parts.length === 5));
  }
  if (format === "docker") {
    return Boolean(imageNameFromDockerPath(entry.path)) && parts.at(-2) === "manifests";
  }
  return false;
}

/**
 * Whether the detail pane should offer the Delete action for the selected row.
 * Assets need the permission and a concrete download URL (dynamically generated
 * documents cannot be deleted); directories need one of the two directory rules.
 */
export function canDeleteEntry(
  repository: Pick<BrowseRepository, "format" | "type">,
  entry: BrowseEntry | null,
): boolean {
  if (!entry) return false;
  if (entry.leaf) return hasBrowseDeletePermission() && Boolean(entry.downloadUrl);
  return canDeleteBrowseDirectory(repository, entry)
    || canDeleteBrowseComponentDirectory(repository, entry);
}

/** Deletes one asset (or component directory) from a repository. */
export async function deleteBrowseEntry(repository: string, entry: BrowseEntry): Promise<void> {
  const params = new URLSearchParams({ path: entry.path });
  if (entry.sourceRepository) params.set("source", entry.sourceRepository);
  await api.delete(`/internal/browse/${encodeURIComponent(repository)}?${params.toString()}`);
}

/** Reviews what a directory deletion would remove before asking for confirmation. */
export async function previewDirectoryDeletion(
  repository: string,
  path: string,
): Promise<DirectoryDeletionPreview> {
  const params = new URLSearchParams({ path });
  return api.get<DirectoryDeletionPreview>(
    `/internal/browse/${encodeURIComponent(repository)}/directory-deletion?${params.toString()}`,
  );
}

/** Confirms a reviewed directory deletion; the server verifies the typed path. */
export async function confirmDirectoryDeletion(
  repository: string,
  path: string,
  confirmationPath: string,
  selectionToken: string | null = null,
): Promise<void> {
  await api.send<null>(
    `/internal/browse/${encodeURIComponent(repository)}/directory-deletion`,
    "POST",
    { path, confirmationPath, selectionToken },
  );
}
