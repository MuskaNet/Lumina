import { createRouter, type RouteRecordRaw } from "vue-router";
import type { Component } from "vue";
import { ADMIN_NAV, ADMIN_NAV_BY_ID } from "./nav";
import { createLegacyHashHistory } from "../shared/router/legacy-hash-history";
import { beginTask, endTask, fail } from "../shared/progress";

import AnonymousView from "./views/AnonymousView.vue";
import ApiKeysView from "./views/ApiKeysView.vue";
import AuditLogView from "./views/AuditLogView.vue";
import BlobStoresView from "./views/BlobStoresView.vue";
import CleanupPoliciesView from "./views/CleanupPoliciesView.vue";
import ContentSelectorsView from "./views/ContentSelectorsView.vue";
import DockerRegistryView from "./views/DockerRegistryView.vue";
import LdapView from "./views/LdapView.vue";
import NexusMigrationView from "./views/NexusMigrationView.vue";
import OidcView from "./views/OidcView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import PrivilegesView from "./views/PrivilegesView.vue";
import RealmsView from "./views/RealmsView.vue";
import RepositoriesView from "./views/RepositoriesView.vue";
import RepositoryDataMigrationView from "./views/RepositoryDataMigrationView.vue";
import RolesView from "./views/RolesView.vue";
import ScanningView from "./views/ScanningView.vue";
import UiSettingsView from "./views/UiSettingsView.vue";
import UsersView from "./views/UsersView.vue";

const VIEWS: Record<string, Component> = {
  repositories: RepositoriesView,
  "cleanup-policies": CleanupPoliciesView,
  "content-selectors": ContentSelectorsView,
  blobstores: BlobStoresView,
  "docker-registry": DockerRegistryView,
  "security-users": UsersView,
  "security-roles": RolesView,
  "security-privileges": PrivilegesView,
  "security-realms": RealmsView,
  "security-ldap": LdapView,
  "security-oidc": OidcView,
  "security-anonymous": AnonymousView,
  "security-api-keys": ApiKeysView,
  "security-scanning": ScanningView,
  "security-audit-log": AuditLogView,
  "ui-settings": UiSettingsView,
  "nexus-migration": NexusMigrationView,
  "repository-data-migration": RepositoryDataMigrationView,
};

/**
 * Legacy hash aliases that must keep resolving. Each entry maps a historical
 * `#admin/...` URL to the view that owns it today.
 */
export const LEGACY_HASH_ROUTES: Record<string, string> = {
  "#admin/repository": "repositories",
  "#admin/repository/cleanup": "cleanup-policies",
  "#admin/repository/blob-stores": "blobstores",
  "#admin/repository/docker-registry": "docker-registry",
  "#admin/security": "security-users",
  "#admin/security/apikeys": "security-api-keys",
  "#admin/security/scanning": "security-scanning",
  "#admin/security/audit": "security-audit-log",
  "#admin/system": "ui-settings",
  "#admin/system/ui": "ui-settings",
  "#admin/migration": "nexus-migration",
};

export function canonicalPath(viewId: string): string {
  const item = ADMIN_NAV_BY_ID.get(viewId) ?? ADMIN_NAV_BY_ID.get("repositories")!;
  return `/${item.href.replace(/^#/, "")}`;
}

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: canonicalPath("repositories") },
  { path: "/admin", redirect: canonicalPath("repositories") },
  ...ADMIN_NAV.map<RouteRecordRaw>((item) => ({
    path: canonicalPath(item.id),
    name: item.id,
    component: VIEWS[item.id] ?? NotFoundView,
  })),
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
];

export const router = createRouter({
  history: createLegacyHashHistory(),
  routes,
});

router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    beginTask();
  }
  const alias = LEGACY_HASH_ROUTES[`#${to.path.replace(/^\//, "")}`.toLowerCase()];
  if (alias && alias !== to.name) return canonicalPath(alias);
  return true;
});

router.afterEach(() => {
  setTimeout(() => {
    endTask();
  }, 120);
});

router.onError(() => {
  fail();
});

