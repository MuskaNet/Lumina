import { describe, expect, it } from "vitest";
import { authRequiredLocation, safeReturnTo } from "./client";

describe("safeReturnTo", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeReturnTo("/admin/#admin/repository/blobstores")).toBe("/admin/#admin/repository/blobstores");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeReturnTo("//evil.example/x")).toBeNull();
    expect(safeReturnTo("https://evil.example/x")).toBeNull();
    expect(safeReturnTo("javascript:alert(1)")).toBeNull();
    expect(safeReturnTo("")).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
  });
});

describe("authRequiredLocation", () => {
  it("always targets the browse sign-in entry", () => {
    expect(authRequiredLocation()).toBe("/browse/?login=1#browse/welcome");
  });

  it("keeps a safe return target", () => {
    expect(authRequiredLocation("/admin/#admin/security/users")).toBe(
      "/browse/?login=1&returnTo=%2Fadmin%2F%23admin%2Fsecurity%2Fusers#browse/welcome",
    );
  });

  it("drops an unsafe return target", () => {
    expect(authRequiredLocation("//evil.example")).toBe("/browse/?login=1#browse/welcome");
  });
});
