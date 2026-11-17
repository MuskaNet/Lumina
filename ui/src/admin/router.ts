import { createRouter, type RouteRecordRaw } from "vue-router";
import { h, type Component } from "vue";
import { ADMIN_NAV, ADMIN_NAV_BY_ID, adminLandingView } from "./nav";
import { canAccessAdminView } from "../shared/permissions";
import { permissions, securityContextLoaded } from "../shared/session";
import SharedNotFoundView from "../shared/components/NotFoundView.vue";
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
import RoutingRulesView from "./views/RoutingRulesView.vue";
import ScanningView from "./views/ScanningView.vue";
import UiSettingsView from "./views/UiSettingsView.vue";
import UsersView from "./views/UsersView.vue";

const VIEWS: Record<string, Component> = {
  repositories: RepositoriesView,
  "cleanup-policies": CleanupPoliciesView,
  "content-selectors": ContentSelectorsView,
  "routing-rules": RoutingRulesView,
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
  "#admin/repository/routingrules": "routing-rules",
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

/**
 * Route shown when the account can enter the workspace but holds no grant that
 * opens a single view. Rendering it beats showing the global default and having
 * every request fail.
 */
export const NO_ADMIN_VIEW_ROUTE = "no-admin-views";

const NoAdminViewsView: Component = {
  name: "NoAdminViewsView",
  render: () =>
    h(SharedNotFoundView, {
      icon: "lock",
      title: "No administration views are available.",
      description:
        "This account can sign in but holds no administration permission. Ask an administrator to grant access.",
    }),
};

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: canonicalPath("repositories") },
  { path: "/admin", redirect: canonicalPath("repositories") },
  ...ADMIN_NAV.map<RouteRecordRaw>((item) => ({
    path: canonicalPath(item.id),
    name: item.id,
    component: VIEWS[item.id] ?? NotFoundView,
  })),
  { path: "/admin/no-access", name: NO_ADMIN_VIEW_ROUTE, component: NoAdminViewsView },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
];

export const router = createRouter({
  history: createLegacyHashHistory(),
  routes,
});

/**
 * Route a scoped account may actually open, or `undefined` when it holds no
 * administration grant at all.
 */
export function adminLandingPath(): string | undefined {
  const landing = adminLandingView(permissions.value);
  return landing ? canonicalPath(landing) : undefined;
}

router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    beginTask();
  }
  const alias = LEGACY_HASH_ROUTES[`#${to.path.replace(/^\//, "")}`.toLowerCase()];
  if (alias && alias !== to.name) return canonicalPath(alias);

  // Authorization is enforced again by every endpoint. This guard only keeps an
  // account from landing on a view it cannot use, and it stays permissive until
  // the security context has actually loaded so a transient failure cannot lock
  // an administrator out of the console.
  if (!securityContextLoaded.value) return true;

  if (to.name === NO_ADMIN_VIEW_ROUTE) {
    // Leave the empty state as soon as an accessible view exists.
    return adminLandingPath() ?? true;
  }

  const name = typeof to.name === "string" ? to.name : undefined;
  if (!name || !ADMIN_NAV_BY_ID.has(name)) return true;
  if (canAccessAdminView(permissions.value, name)) return true;

  // `state` is set on the redirect target so the console can show the empty
  // state without the guard bouncing the navigation again.
  return adminLandingPath() ?? { name: NO_ADMIN_VIEW_ROUTE };
});

router.afterEach(() => {
  setTimeout(() => {
    endTask();
  }, 120);
});

router.onError(() => {
  fail();
});

/** Re-runs the guard after the security context changes, e.g. right after sign-in. */
export async function revalidateAdminRoute(): Promise<void> {
  const current = router.currentRoute.value;
  await router.replace(current.fullPath);
}

