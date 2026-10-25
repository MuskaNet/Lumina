import { describe, expect, it } from "vitest";
import { ADMIN_NAV, ADMIN_NAV_BY_ID } from "./nav";
import { LEGACY_HASH_ROUTES, canonicalPath, router } from "./router";

/**
 * Navigation hashes are bookmarks and deep links into the console, so the list
 * below is a compatibility contract rather than an implementation detail.
 */
const LEGACY_HREFS = [
  "#admin/repository/repositories",
  "#admin/repository/cleanup-policies",
  "#admin/repository/content-selectors",
  "#admin/repository/blobstores",
  "#admin/repository/docker",
  "#admin/security/users",
  "#admin/security/roles",
  "#admin/security/privileges",
  "#admin/security/realms",
  "#admin/security/ldap",
  "#admin/security/oidc",
  "#admin/security/anonymous",
  "#admin/security/api-keys",
  "#admin/security/artifact-scanning",
  "#admin/security/audit-log",
  "#admin/system/ui-settings",
  "#admin/migration/nexus",
  "#admin/migration/repository-data",
];

describe("admin navigation", () => {
  it("keeps every legacy hash route", () => {
    expect(ADMIN_NAV.map((item) => item.href)).toEqual(LEGACY_HREFS);
  });

  it("keeps the documented legacy aliases", () => {
    expect(LEGACY_HASH_ROUTES).toMatchObject({
      "#admin/repository": "repositories",
      "#admin/repository/cleanup": "cleanup-policies",
      "#admin/repository/blob-stores": "blobstores",
      "#admin/repository/docker-registry": "docker-registry",
      "#admin/security/apikeys": "security-api-keys",
      "#admin/security/scanning": "security-scanning",
      "#admin/security/audit": "security-audit-log",
      "#admin/system/ui": "ui-settings",
      "#admin/migration": "nexus-migration",
    });
  });

  it("wires every navigation destination to a view", () => {
    const routeNames = new Set(router.getRoutes().map((record) => record.name).filter(Boolean));

    for (const item of ADMIN_NAV) {
      expect(routeNames.has(item.id), item.id).toBe(true);
      expect(router.resolve(canonicalPath(item.id)).name, item.id).toBe(item.id);
    }
  });

  it("resolves every legacy hash alias to its current view", async () => {
    for (const [hash, viewId] of Object.entries(LEGACY_HASH_ROUTES)) {
      expect(ADMIN_NAV_BY_ID.has(viewId), hash).toBe(true);

      // The guard matches the legacy `#admin/...` path shape, which vue-router
      // receives as a regular absolute path.
      await router.push(`/${hash.slice(1)}`);

      expect(router.currentRoute.value.name, hash).toBe(viewId);
    }
  });
});
