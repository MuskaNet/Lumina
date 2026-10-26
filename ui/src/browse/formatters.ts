/** Formatting helpers shared by the browse tree, detail panel and tests. */
import type { BrowseRepository } from "./browseModel";

export function formatBytes(size: number | null | undefined): string {
  if (size == null || Number.isNaN(Number(size))) return "";
  const value = Number(size);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

/** "1.6 KiB (1609 bytes)" — the exact form used by the Summary panels. */
export function formatBytesDetail(size: number | null | undefined): string {
  if (size == null || Number.isNaN(Number(size))) return "-";
  return `${formatBytes(Number(size))} (${Number(size)} bytes)`;
}

export function formatInstant(text: string | null | undefined): string {
  if (!text) return "";
  try {
    return new Date(text).toLocaleString();
  } catch {
    return text;
  }
}

/** Abbreviates long `sha256:` digests the same way the legacy console did. */
export function shortDigest(value: string | null | undefined): string {
  const text = value ?? "";
  if (text.startsWith("sha256:") && text.length > 26) {
    return `${text.slice(0, 19)}...${text.slice(-8)}`;
  }
  return text;
}

/** Renders an attribute value (scalar, array or nested object) for a panel row. */
export function formatAttributeValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => formatAttributeValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Absolute `/repository/<name>/` base URL of a repository, matching the legacy console. */
export function repositoryBaseUrl(
  repository: Pick<BrowseRepository, "name" | "url">,
  origin: string = globalThis.location?.origin ?? "",
): string {
  const path = repository.url || `/repository/${encodeURIComponent(repository.name)}/`;
  try {
    return new URL(path, origin || undefined).href;
  } catch {
    return path;
  }
}
