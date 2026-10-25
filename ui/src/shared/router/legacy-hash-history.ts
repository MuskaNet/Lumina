import type { HistoryState, RouterHistory } from "vue-router";

/**
 * Hash history that keeps the legacy kkRepo URL shape.
 *
 * The console has always used `#admin/repository/blobstores` (no slash after
 * `#`), while vue-router's `createWebHashHistory` expects `#/path`. Browser
 * bookmarks, deep links and the Spring redirects all rely on the legacy shape,
 * so the router runs on this adapter instead.
 */
export function normalizeHashPath(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

type HistoryLocation = Parameters<RouterHistory["push"]>[0];
type NavigationCallback = Parameters<RouterHistory["listen"]>[0];
type NavigationInformation = Parameters<NavigationCallback>[2];
type NavigationDirection = NavigationInformation["direction"];

export function createLegacyHashHistory(): RouterHistory {
  const listeners = new Set<NavigationCallback>();
  let current = normalizeHashPath(globalThis.location?.hash ?? "");
  let pendingDirection = "forward" as NavigationDirection;

  const notify = (to: string, from: string, direction: NavigationDirection) => {
    const information = { type: "pop", direction, delta: 0 } as unknown as NavigationInformation;
    for (const listener of listeners) listener(to, from, information);
  };

  const onChange = () => {
    const next = normalizeHashPath(globalThis.location?.hash ?? "");
    if (next === current) return;
    const previous = current;
    current = next;
    notify(next, previous, pendingDirection);
    pendingDirection = "forward" as NavigationDirection;
  };

  globalThis.addEventListener?.("hashchange", onChange);
  globalThis.addEventListener?.("popstate", onChange);

  return {
    get base() {
      return "";
    },
    get location() {
      return current;
    },
    get state() {
      return historyState();
    },
    createHref: (location: HistoryLocation) => toLegacyHash(location),
    push(location: HistoryLocation) {
      const previous = current;
      globalThis.location.hash = toLegacyHash(location);
      current = normalizeHashPath(globalThis.location.hash);
      notify(current, previous, "forward" as NavigationDirection);
    },
    replace(location: HistoryLocation) {
      const previous = current;
      globalThis.history.replaceState(null, "", toLegacyHash(location));
      current = normalizeHashPath(globalThis.location.hash);
      notify(current, previous, "forward" as NavigationDirection);
    },
    go(delta: number) {
      pendingDirection = (delta < 0 ? "back" : "forward") as NavigationDirection;
      globalThis.history.go(delta);
    },
    listen(callback: NavigationCallback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    destroy() {
      listeners.clear();
      globalThis.removeEventListener?.("hashchange", onChange);
      globalThis.removeEventListener?.("popstate", onChange);
    },
  };
}

/** Writes the legacy `#admin/...` form, without a slash after the hash. */
function toLegacyHash(location: HistoryLocation): string {
  return `#${String(location).replace(/^\//, "")}`;
}

function historyState(): HistoryState {
  return (globalThis.history?.state as HistoryState) ?? {};
}


