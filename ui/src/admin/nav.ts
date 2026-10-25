export interface AdminNavItem {
  id: string;
  label: string;
  icon: string;
  /** Canonical hash route, kept identical to the legacy console. */
  href: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "repositories", label: "Repositories", icon: "inventory_2", href: "#admin/repository/repositories" },
  { id: "cleanup-policies", label: "Cleanup Policies", icon: "auto_delete", href: "#admin/repository/cleanup-policies" },
  { id: "content-selectors", label: "Content Selectors", icon: "filter_list", href: "#admin/repository/content-selectors" },
  { id: "blobstores", label: "Blob Stores", icon: "database", href: "#admin/repository/blobstores" },
  { id: "docker-registry", label: "Docker Registry", icon: "deployed_code", href: "#admin/repository/docker" },
  { id: "security-users", label: "Users", icon: "group", href: "#admin/security/users" },
  { id: "security-roles", label: "Roles", icon: "verified_user", href: "#admin/security/roles" },
  { id: "security-privileges", label: "Privileges", icon: "key", href: "#admin/security/privileges" },
  { id: "security-realms", label: "Realms", icon: "hub", href: "#admin/security/realms" },
  { id: "security-ldap", label: "LDAP", icon: "lan", href: "#admin/security/ldap" },
  { id: "security-oidc", label: "OIDC", icon: "passkey", href: "#admin/security/oidc" },
  { id: "security-anonymous", label: "Anonymous", icon: "person_off", href: "#admin/security/anonymous" },
  { id: "security-api-keys", label: "API Keys", icon: "vpn_key", href: "#admin/security/api-keys" },
  { id: "security-scanning", label: "Artifact Scanning", icon: "security", href: "#admin/security/artifact-scanning" },
  { id: "security-audit-log", label: "Audit Log", icon: "receipt_long", href: "#admin/security/audit-log" },
  { id: "ui-settings", label: "UI Settings", icon: "tune", href: "#admin/system/ui-settings" },
  { id: "nexus-migration", label: "Nexus Metadata", icon: "swap_horiz", href: "#admin/migration/nexus" },
  {
    id: "repository-data-migration",
    label: "Nexus Repository Data",
    icon: "compare_arrows",
    href: "#admin/migration/repository-data",
  },
];

export const ADMIN_NAV_BY_ID = new Map(ADMIN_NAV.map((item) => [item.id, item]));
