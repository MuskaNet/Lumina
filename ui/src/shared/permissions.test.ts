import { describe, expect, it } from "vitest";
import {
  adminEntryUrl,
  canAccessAdminView,
  hasAdminEntryPermission,
  hasPermission,
  isAdmin,
  permissionMatches,
} from "./permissions";

/**
 * Behavior ported from the upstream `security-scan-permissions.test.js`
 * authorization cases, rewritten for the Vue permission module.
 */
describe("permissionMatches action aliases", () => {
  it.each<[string, string, boolean]>([
    ["nexus:security-scanning:edit,read", "nexus:security-scanning:update", true],
    ["nexus:security-scanning:update", "nexus:security-scanning:edit", true],
    ["nexus:security-scanning:all", "nexus:security-scanning:read", true],
    ["nexus:security-scanning:all", "nexus:security-scanning:*", false],
    ["nexus:security-scanning:all", "nexus:*", false],
    ["nexus:security-scanning-waivers:add", "nexus:security-scanning-waivers:create", true],
    ["nexus:security-scanning:read", "nexus:security-scanning:update", false],
    ["nexus:edit:read", "nexus:update:read", false],
    ["nexus:repository-admin:raw:edit:read", "nexus:repository-admin:raw:update:read", false],
    ["nexus:repository-admin:raw:releases:edit", "nexus:repository-admin:raw:releases:update", true],
    [
      "nexus:repository-content-selector:edit:raw:releases:read",
      "nexus:repository-content-selector:update:raw:releases:read",
      false,
    ],
    [
      "nexus:repository-content-selector:team:raw:releases:edit",
      "nexus:repository-content-selector:team:raw:releases:update",
      true,
    ],
  ])("maps %s against %s to %s", (granted, requested, allowed) => {
    expect(permissionMatches(granted, requested)).toBe(allowed);
  });

  it("honors wildcard and comma-separated grants", () => {
    expect(permissionMatches("nexus:*", "nexus:security-scanning:update")).toBe(true);
    expect(permissionMatches("nexus:security-scanning:read,update", "nexus:security-scanning:update")).toBe(true);
    expect(permissionMatches("nexus:security-scanning:read", "nexus:security-scanning:update")).toBe(false);
  });
});

describe("admin entry authorization", () => {
  it.each<[string[], boolean]>([
    [[], false],
    [["nexus:security-scanning:read"], true],
    [["nexus:security-scanning:read,update"], true],
    [["nexus:selectors:read"], true],
    [["nexus:*"], true],
    [["nexus:security-scanning:*"], true],
    [["nexus:security-scanning:update"], false],
    [["nexus:security-scanning-waivers:create"], false],
  ])("treats %j as entry=%s", (granted, expected) => {
    expect(hasAdminEntryPermission(granted)).toBe(expected);
  });

  it("agrees with scoped view routing for every grant", () => {
    const cases: Array<[string[], boolean]> = [
      [[], false],
      [["nexus:security-scanning:read"], true],
      [["nexus:security-scanning:read,update"], true],
      [["nexus:selectors:read"], true],
      [["nexus:*"], true],
      [["nexus:security-scanning:*"], true],
      [["nexus:security-scanning:update"], false],
      [["nexus:security-scanning-waivers:create"], false],
    ];
    for (const [granted, expected] of cases) {
      expect(
        canAccessAdminView(granted, "security-scanning") || canAccessAdminView(granted, "content-selectors"),
        JSON.stringify(granted),
      ).toBe(expected);
    }
  });

  it("sends scoped readers to the view they can open", () => {
    expect(adminEntryUrl(["nexus:*"])).toBe("/admin/");
    expect(adminEntryUrl(["nexus:security-scanning:read"])).toBe("/admin/#admin/security/artifact-scanning");
    expect(adminEntryUrl(["nexus:selectors:read"])).toBe("/admin/#admin/repository/content-selectors");
  });

  it("keeps global administration required for ordinary views", () => {
    expect(canAccessAdminView(["nexus:security-scanning:read"], "repositories")).toBe(false);
    expect(canAccessAdminView(["nexus:security-scanning:read"], "security-users")).toBe(false);
    expect(canAccessAdminView(["nexus:*"], "repositories")).toBe(true);
  });

  it("never resolves a view through an inherited object key", () => {
    // A plain-object lookup would expose `constructor`/`toString` and friends.
    for (const viewId of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      expect(canAccessAdminView(["nexus:security-scanning:read"], viewId), viewId).toBe(false);
    }
  });
});

describe("hasPermission and isAdmin", () => {
  it("handles undefined grants", () => {
    expect(hasPermission(undefined, "nexus:*")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(canAccessAdminView(undefined, "security-scanning")).toBe(false);
  });
});
