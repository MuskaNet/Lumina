/**
 * Client-facing repository URLs shown by the browse console.
 *
 * Mirrors the legacy browse UI: Docker repositories advertise their registry
 * connector endpoint, while every other format advertises the Nexus-compatible
 * `/repository/<name>/` base URL. Docker connector settings arrive on the
 * `GET /internal/repositories` payload as the `docker` object; when the
 * connector is disabled the repository is only reachable through the shared
 * `/v2/<name>` registry path.
 *
 * The helpers take an injectable location so unit tests can pin scheme/host
 * behaviour instead of depending on the test DOM.
 */
export interface DockerConnectorSettings {
  connectorEnabled?: boolean | null;
  connectorPort?: number | string | null;
  connectorPublicUrl?: string | null;
}

/**
 * The browse console's repository shape; shared with the tree, usage and detail
 * modules so every browse surface agrees on one type.
 */
import type { BrowseRepository } from "./browseModel";
export type Repository = BrowseRepository;

export interface LocationLike {
  origin?: string;
  protocol?: string;
  hostname?: string;
}

const TRAILING_SLASHES = /\/+$/;

function trimTrailingSlashes(value: string): string {
  return value.replace(TRAILING_SLASHES, "");
}

/** Docker registry endpoint used by `docker login/pull`, without a trailing slash. */
export function dockerRepositoryBaseUrl(
  repo: Pick<Repository, "name" | "docker">,
  location: LocationLike | null = globalThis.location,
): string {
  const docker = repo.docker ?? {};
  if (docker.connectorEnabled && docker.connectorPublicUrl) {
    return trimTrailingSlashes(docker.connectorPublicUrl);
  }
  if (docker.connectorEnabled && docker.connectorPort) {
    const protocol = location?.protocol ?? "http:";
    const hostname = location?.hostname ?? "";
    return `${protocol}//${hostname}:${docker.connectorPort}`;
  }
  return trimTrailingSlashes(`${location?.origin ?? ""}/v2/${encodeURIComponent(repo.name)}`);
}

/**
 * Absolute URL a client uses to reach the repository. Falls back to the raw
 * relative path when no location is available (e.g. SSR-less unit tests).
 */
export function repositoryClientUrl(
  repo: Pick<Repository, "name" | "format" | "url" | "docker">,
  location: LocationLike | null = globalThis.location,
): string {
  const isDocker = String(repo.format ?? "").trim().toLowerCase() === "docker";
  // Docker clients get the connector endpoint verbatim: URL normalisation would
  // append a trailing slash that registry clients and the legacy console omit.
  if (isDocker) return dockerRepositoryBaseUrl(repo, location);
  const path = repo.url || `/repository/${encodeURIComponent(repo.name)}/`;
  try {
    return new URL(path, location?.origin || undefined).href;
  } catch {
    return path;
  }
}
