import { canAccessAdminView, isAdmin } from "../shared/permissions";

export interface AdminNavItem {
  id: string;
  label: string;
  icon: string;
  /** Canonical hash route, kept identical to the legacy console. */
  href: string;
  group?: string;
}

/** Visible entries of one sidebar group, in catalog order. */
export interface AdminNavGroup {
  /** Group heading, or `undefined` for entries the catalog leaves ungrouped. */
  group?: string;
  items: AdminNavItem[];
}

/**
 * Views a scoped account may still open without the global wildcard, best
 * first. Mirrors the upstream bootstrap fallback order.
 */
export const ADMIN_FALLBACK_VIEWS = ["security-scanning", "content-selectors"] as const;

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "repositories", label: "Repositories", icon: "inventory_2", href: "#admin/repository/repositories", group: "Repository" },
  { id: "cleanup-policies", label: "Cleanup Policies", icon: "auto_delete", href: "#admin/repository/cleanup-policies", group: "Repository" },
  { id: "content-selectors", label: "Content Selectors", icon: "filter_list", href: "#admin/repository/content-selectors", group: "Repository" },
  { id: "routing-rules", label: "Routing Rules", icon: "rule", href: "#admin/repository/routingrules", group: "Repository" },
  { id: "blobstores", label: "Blob Stores", icon: "database", href: "#admin/repository/blobstores", group: "Repository" },
  { id: "docker-registry", label: "Docker Registry", icon: "deployed_code", href: "#admin/repository/docker", group: "Repository" },
  { id: "security-users", label: "Users", icon: "group", href: "#admin/security/users", group: "Security" },
  { id: "security-roles", label: "Roles", icon: "verified_user", href: "#admin/security/roles", group: "Security" },
  { id: "security-privileges", label: "Privileges", icon: "key", href: "#admin/security/privileges", group: "Security" },
  { id: "security-realms", label: "Realms", icon: "hub", href: "#admin/security/realms", group: "Security" },
  { id: "security-ldap", label: "LDAP", icon: "lan", href: "#admin/security/ldap", group: "Security" },
  { id: "security-oidc", label: "OIDC", icon: "passkey", href: "#admin/security/oidc", group: "Security" },
  { id: "security-anonymous", label: "Anonymous", icon: "person_off", href: "#admin/security/anonymous", group: "Security" },
  { id: "security-api-keys", label: "API Keys", icon: "vpn_key", href: "#admin/security/api-keys", group: "Security" },
  { id: "security-scanning", label: "Artifact Scanning", icon: "security", href: "#admin/security/artifact-scanning", group: "Security" },
  { id: "security-audit-log", label: "Audit Log", icon: "receipt_long", href: "#admin/security/audit-log", group: "Security" },
  { id: "ui-settings", label: "UI Settings", icon: "tune", href: "#admin/system/ui-settings", group: "System" },
  { id: "nexus-migration", label: "Nexus Metadata", icon: "swap_horiz", href: "#admin/migration/nexus", group: "System" },
  {
    id: "repository-data-migration",
    label: "Nexus Repository Data",
    icon: "compare_arrows",
    href: "#admin/migration/repository-data",
    group: "System",
  },
];

export const ADMIN_NAV_BY_ID = new Map(ADMIN_NAV.map((item) => [item.id, item]));

/**
 * Entries the account can actually open. `ADMIN_NAV` stays the full catalog so
 * legacy hrefs and deep links keep resolving; only the rendered navigation is
 * narrowed.
 */
export function visibleAdminNav(granted: readonly string[] | undefined): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => canAccessAdminView(granted, item.id));
}

/**
 * Groups the visible entries, dropping any group whose items are all hidden.
 * Ungrouped entries are collected under a single `undefined` group so the shell
 * can render them without a heading.
 */
export function visibleAdminNavGroups(granted: readonly string[] | undefined): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [];
  for (const item of visibleAdminNav(granted)) {
    const last = groups.at(-1);
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

/**
 * First view a scoped account may open, best first. Returns `undefined` when
 * the account has no administration view at all, which the shell reports as an
 * explicit empty state instead of rendering a broken console.
 */
export function adminFallbackView(granted: readonly string[] | undefined): string | undefined {
  return ADMIN_FALLBACK_VIEWS.find((view) => canAccessAdminView(granted, view));
}

/**
 * View the console opens when the URL names no particular view (`/` or
 * `/admin`). Global administrators keep the historical `repositories` landing
 * page; scoped readers are sent to the first view they can open, and accounts
 * with no administration grant get `undefined` so the shell can say so.
 */
export function adminLandingView(granted: readonly string[] | undefined): string | undefined {
  if (isAdmin(granted)) return "repositories";
  return adminFallbackView(granted);
}
