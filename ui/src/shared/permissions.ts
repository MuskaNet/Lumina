/**
 * Nexus-compatible permission matching shared by the Admin and Browse Vue apps.
 *
 * Ported from the upstream `permissionPartMatches` / `permissionMatches` helpers
 * (upstream `admin.js` / `browse.js`) into the MICL Vue frontend. The backend
 * stores *concrete* action verbs, while permission requests use the Nexus verbs
 * `create`/`update`. Matching therefore normalizes a request action to its stored
 * form (`create` -> `add`, `update` -> `edit`, `all` -> `*`) but only at the
 * position that actually holds an action, so a repository-scoped grant is never
 * mistaken for an action grant.
 *
 * The rules are kept pure and free of Vue state so both apps (and Vitest) can
 * exercise them without booting a session.
 */

/** Part of a permission that holds an action verb, per permission domain. */
function actionIndexFor(grantedParts: string[], requestedParts: string[]): number {
  const domain = requestedParts[1];
  if (domain === "repository-view" || domain === "repository-admin") return 4;
  if (domain === "repository-content-selector") return 5;
  if (grantedParts[0] === "nexus" && requestedParts[0] === "nexus") return 2;
  return -1;
}

/** Normalizes one `:`-separated permission part, optionally as an action verb. */
function normalizePart(part: string | undefined, action: boolean): string {
  const value = (part || "*").trim().toLowerCase();
  if (!action) return value;
  if (value === "create") return "add";
  if (value === "update") return "edit";
  return value === "all" ? "*" : value;
}

/**
 * Matches a single granted part against a requested part.
 *
 * When matching an action part, `all` is treated as a concrete `*` grant: it
 * satisfies concrete requests, but only a literal `*` grant satisfies a wildcard
 * request. This mirrors how the backend expands an ALL action grant.
 */
export function permissionPartMatches(
  grantedPart: string | undefined,
  requestedPart: string | undefined,
  action = false,
): boolean {
  const requested = normalizePart(requestedPart, action);
  return (grantedPart || "*").split(",").some((part) => {
    if (action && (requestedPart || "*").trim() === "*") return part.trim() === "*";
    const normalized = normalizePart(part, action);
    return normalized === "*" || normalized === requested;
  });
}

/** Matches a granted permission string against a requested one, part by part. */
export function permissionMatches(granted: string | undefined, requested: string | undefined): boolean {
  const grantedParts = (granted || "").toLowerCase().split(":");
  const requestedParts = (requested || "").toLowerCase().split(":");
  const actionIndex = actionIndexFor(grantedParts, requestedParts);
  const length = Math.max(grantedParts.length, requestedParts.length);
  for (let index = 0; index < length; index += 1) {
    if (!permissionPartMatches(grantedParts[index], requestedParts[index], index === actionIndex)) return false;
  }
  return true;
}

/** True when any granted permission satisfies `permission`. */
export function hasPermission(granted: readonly string[] | undefined, permission: string): boolean {
  return (granted ?? []).some((entry) => permissionMatches(entry, permission));
}

/** Admin actions that may be granted through a content-selector scope. */
const SELECTOR_ACTIONS = ["read", "create", "update", "delete"] as const;

/**
 * View ids reachable with a narrow grant instead of global administration.
 * Every other Admin view requires the `nexus:*` wildcard. A `Map` keeps the
 * lookup immune to inherited keys (`constructor`, `toString`, ...) that would
 * otherwise be reachable through a plain object.
 */
const SCOPED_VIEWS = new Map<string, readonly string[]>([
  ["security-scanning", ["nexus:security-scanning:read"]],
  ["content-selectors", SELECTOR_ACTIONS.map((action) => `nexus:selectors:${action}`)],
]);

/** True when the account holds the global administration wildcard. */
export function isAdmin(granted: readonly string[] | undefined): boolean {
  return hasPermission(granted, "nexus:*");
}

/** True when the account may open one Admin view. */
export function canAccessAdminView(granted: readonly string[] | undefined, viewId: string): boolean {
  if (isAdmin(granted)) return true;
  const alternatives = SCOPED_VIEWS.get(viewId);
  return alternatives !== undefined && alternatives.some((permission) => hasPermission(granted, permission));
}

/**
 * True when the account may enter the Admin workspace at all. Mirrors the
 * upstream `hasAdminEntryPermission` so the Browse top bar and the Admin router
 * agree on who sees the entry point.
 */
export function hasAdminEntryPermission(granted: readonly string[] | undefined): boolean {
  if (isAdmin(granted)) return true;
  if (hasPermission(granted, "nexus:security-scanning:read")) return true;
  return SELECTOR_ACTIONS.some((action) => hasPermission(granted, `nexus:selectors:${action}`));
}

/**
 * Landing route for the Admin entry. Scoped readers land on the view they can
 * actually open instead of the global default, matching upstream behavior.
 */
export function adminEntryUrl(granted: readonly string[] | undefined): string {
  if (isAdmin(granted)) return "/admin/";
  if (hasPermission(granted, "nexus:security-scanning:read")) {
    return "/admin/#admin/security/artifact-scanning";
  }
  return "/admin/#admin/repository/content-selectors";
}
