import { describe, expect, it } from "vitest";
import { normalizeHashPath } from "./legacy-hash-history";

describe("normalizeHashPath", () => {
  it("keeps the legacy hash shape", () => {
    expect(normalizeHashPath("#admin/repository/blobstores")).toBe("/admin/repository/blobstores");
    expect(normalizeHashPath("#admin")).toBe("/admin");
  });

  it("accepts router-native hashes", () => {
    expect(normalizeHashPath("#/admin/security/users")).toBe("/admin/security/users");
  });

  it("falls back to the root path for an empty hash", () => {
    expect(normalizeHashPath("")).toBe("/");
    expect(normalizeHashPath("#")).toBe("/");
  });
});
