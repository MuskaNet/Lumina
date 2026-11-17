import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  adminFallbackView,
  adminLandingView,
  visibleAdminNav,
  visibleAdminNavGroups,
} from "./nav";
import { canonicalPath } from "./router";

/**
 * Scoped administration authorization, ported from upstream PR #466
 * (`canAccessAdminView` / bootstrap fallback) onto the Vue console.
 */
const ADMIN = ["nexus:*"];
const SCAN_READER = ["nexus:security-scanning:read"];
const SELECTOR_READER = ["nexus:selectors:read"];

afterEach(() => {
  expect(ADMIN_NAV.length).toBeGreaterThan(0);
});

describe("scoped admin navigation", () => {
  it("offers the whole catalog only to a global administrator", () => {
    expect(visibleAdminNav(ADMIN).map((item) => item.id)).toEqual(ADMIN_NAV.map((item) => item.id));
  });

  it("offers a scanning reader only the artifact scanning view", () => {
    expect(visibleAdminNav(SCAN_READER).map((item) => item.id)).toEqual(["security-scanning"]);
  });

  it("offers a selector reader only the content selectors view", () => {
    expect(visibleAdminNav(SELECTOR_READER).map((item) => item.id)).toEqual(["content-selectors"]);
  });

  it("offers nothing to an account without an administration grant", () => {
    expect(visibleAdminNav([])).toEqual([]);
    expect(visibleAdminNav(["nexus:repository-view:read"])).toEqual([]);
    expect(visibleAdminNav(undefined)).toEqual([]);
  });

  it("drops a nav group when every entry in it is hidden", () => {
    const groups = visibleAdminNavGroups(SCAN_READER);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.group).toBe("Security");
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["security-scanning"]);

    // The global administrator keeps every group, including the empty ones.
    const allGroups = visibleAdminNavGroups(ADMIN);
    expect(allGroups.map((entry) => entry.group)).toEqual(["Repository", "Security", "System"]);
    expect(allGroups.flatMap((entry) => entry.items)).toHaveLength(ADMIN_NAV.length);
  });

  it("selects the landing and fallback views by grant", () => {
    expect(adminLandingView(ADMIN)).toBe("repositories");
    expect(adminLandingView(SCAN_READER)).toBe("security-scanning");
    expect(adminLandingView(SELECTOR_READER)).toBe("content-selectors");
    expect(adminLandingView([])).toBeUndefined();

    // Fallback order prefers scanning, then content selectors.
    expect(adminFallbackView(ADMIN)).toBe("security-scanning");
    expect(adminFallbackView(SCAN_READER)).toBe("security-scanning");
    expect(adminFallbackView(SELECTOR_READER)).toBe("content-selectors");
    expect(adminFallbackView([])).toBeUndefined();
  });

  it("maps every scoped landing view onto a real route", () => {
    for (const view of ["repositories", "security-scanning", "content-selectors"]) {
      expect(canonicalPath(view)).toMatch(/^\/admin\//);
    }
  });
});

describe("admin router guard", () => {
  let router: typeof import("./router").router;
  /** Monotonic suffix that keeps each baseline navigation distinct. */
  let baseline = 0;

  beforeEach(async () => {
    const sessions = await import("../shared/session");
    const loaded = await import("./router");
    router = loaded.router;
    baseline = 0;
    sessions.securityContextLoaded.value = false;
    sessions.permissions.value = [];
  });

  afterEach(async () => {
    const sessions = await import("../shared/session");
    sessions.securityContextLoaded.value = false;
    sessions.permissions.value = [];
  });

  /** Pushes a path with one grant set and reports the resolved route name. */
  async function resolve(path: string, granted: string[], loaded = true): Promise<string | undefined> {
    const sessions = await import("../shared/session");
    sessions.permissions.value = granted;
    sessions.securityContextLoaded.value = loaded;
    // vue-router skips guards on duplicate navigation, so always start from an
    // unmatched baseline path before pushing the case under test. A counter
    // keeps the baseline distinct without depending on a random value.
    baseline += 1;
    await router.push(`/__baseline__${baseline}`);
    await router.push(path);
    const name = router.currentRoute.value.name;
    return typeof name === "string" ? name : undefined;
  }

  it("keeps the historical repositories landing for an administrator", async () => {
    expect(await resolve(canonicalPath("repositories"), ADMIN)).toBe("repositories");
  });

  it("sends a scanning reader from the default view to artifact scanning", async () => {
    expect(await resolve(canonicalPath("repositories"), SCAN_READER)).toBe("security-scanning");
  });

  it("sends a selector reader from the default view to content selectors", async () => {
    expect(await resolve(canonicalPath("repositories"), SELECTOR_READER)).toBe("content-selectors");
  });

  it("allows a scoped reader to reach its own view directly", async () => {
    expect(await resolve(canonicalPath("security-scanning"), SCAN_READER)).toBe("security-scanning");
    expect(await resolve(canonicalPath("content-selectors"), SELECTOR_READER)).toBe("content-selectors");
  });

  it("refuses an ordinary view for a scoped reader and redirects to its own", async () => {
    expect(await resolve(canonicalPath("security-users"), SCAN_READER)).toBe("security-scanning");
    expect(await resolve(canonicalPath("repositories"), SELECTOR_READER)).toBe("content-selectors");
  });

  it("shows the empty state when no administration view is available", async () => {
    const { NO_ADMIN_VIEW_ROUTE } = await import("./router");
    expect(await resolve(canonicalPath("repositories"), [])).toBe(NO_ADMIN_VIEW_ROUTE);
    expect(await resolve("/admin/no-access", ["nexus:repository-view:read"])).toBe(NO_ADMIN_VIEW_ROUTE);
  });

  it("stays permissive until the security context has loaded", async () => {
    // A failed context load must not lock an administrator out of the console.
    expect(await resolve(canonicalPath("repositories"), [], false)).toBe("repositories");
  });
});
