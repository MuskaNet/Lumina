/** Browse API helpers used by the tree, the detail pane and the usage context. */
import { api } from "../shared/api/client";
import type { BrowseAssetDetail, BrowseEntry } from "./browseModel";

interface BrowseListing {
  repository?: string;
  path?: string;
  entries?: BrowseEntry[];
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

/** One browse level; the server orders directories first and merges group members. */
export async function fetchBrowseChildren(
  repository: string,
  path = "",
  source = "",
  signal?: AbortSignal,
): Promise<BrowseEntry[]> {
  const payload = await api.get<BrowseListing>(
    `/internal/browse/${encodeURIComponent(repository)}${query({ path, source })}`,
    signal,
  );
  return Array.isArray(payload?.entries) ? payload.entries : [];
}

/**
 * Asset detail, or `null` for entries the detail service cannot describe (for
 * example dynamically generated documents). The legacy console degrades to the
 * listing metadata in that case instead of failing the whole browse page.
 */
export async function fetchBrowseDetail(
  repository: string,
  path: string,
  source = "",
  signal?: AbortSignal,
): Promise<BrowseAssetDetail | null> {
  try {
    return await api.get<BrowseAssetDetail>(
      `/internal/browse/${encodeURIComponent(repository)}/attributes${query({ path, source })}`,
      signal,
    );
  } catch {
    return null;
  }
}
