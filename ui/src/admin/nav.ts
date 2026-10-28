export interface AdminNavItem {
  id: string;
  label: string;
  icon: string;
  /** Canonical hash route, kept identical to the legacy console. */
  href: string;
  group?: string;
}

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
