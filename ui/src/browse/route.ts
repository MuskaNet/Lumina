import { ref } from "vue";
import { beginTask, endTask } from "../shared/progress";

export type BrowseViewName = "welcome" | "browse" | "search" | "upload" | "my-token";

export interface BrowseRoute {
  view: BrowseViewName;
  repo: string;
  path: string;
  query: URLSearchParams;
}

export const BROWSE_PREFIX = "#browse/";

/**
 * Parses the legacy browse hash format:
 * `#browse/welcome`, `#browse/browse:<repo>:<path>`, `#browse/search?q=...`,
 * `#browse/upload`, `#browse/my-token`.
 */
export function parseBrowseHash(hash: string): BrowseRoute {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const bare = raw.startsWith("browse/") ? raw.slice("browse/".length) : raw;
  const [pathPart, queryPart = ""] = bare.split("?");
  const query = new URLSearchParams(queryPart);
  const segments = pathPart.split(":");

  switch (segments[0]) {
    case "browse":
      return {
        view: "browse",
        repo: decodeURIComponent(segments[1] ?? ""),
        path: segments.slice(2).join(":"),
        query,
      };
    case "search":
      return { view: "search", repo: "", path: "", query };
    case "upload":
      return { view: "upload", repo: "", path: "", query };
    case "my-token":
      return { view: "my-token", repo: "", path: "", query };
    default:
      return { view: "welcome", repo: "", path: "", query };
  }
}

export const route = ref<BrowseRoute>(parseBrowseHash(globalThis.location?.hash ?? ""));

globalThis.addEventListener?.("hashchange", () => {
  beginTask();
  route.value = parseBrowseHash(globalThis.location?.hash ?? "");
  setTimeout(() => {
    endTask();
  }, 120);
});

export function navigate(hash: string): void {
  beginTask();
  globalThis.location.hash = hash.replace(/^#/, "");
  route.value = parseBrowseHash(globalThis.location.hash);
  setTimeout(() => {
    endTask();
  }, 120);
}

export function browseHash(repo: string, path = "", source = ""): string {
  const base = `${BROWSE_PREFIX}browse:${repo}${path ? `:${path}` : ""}`;
  return source ? `${base}?source=${encodeURIComponent(source)}` : base;
}

export function searchHash(format: string, keyword: string): string {
  const params = new URLSearchParams();
  if (format) params.set("format", format);
  if (keyword) params.set("q", keyword);
  const query = params.toString();
  return `${BROWSE_PREFIX}search${query ? `?${query}` : ""}`;
}
