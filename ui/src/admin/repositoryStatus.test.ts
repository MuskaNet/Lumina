import { describe, expect, it } from "vitest";
import { formatAlpineStatus, formatAptStatus, formatConanStatus } from "./repositoryStatus";

describe("repository status summaries", () => {
  it("summarises Conan repository counters", () => {
    expect(
      formatConanStatus({
        repositoryRevision: 3,
        recipes: 7,
        recipeRevisions: 9,
        packages: 12,
        packageRevisions: 14,
        committedFiles: 21,
        openUploadSessions: 1,
        cachedProxyFiles: 2,
      }),
    ).toBe(
      "7 recipes · 9 recipe revisions · 12 packages · 14 package revisions · 21 committed files"
      + " · 1 open upload sessions · 2 cached proxy files",
    );
  });

  it("summarises APT signing key, suites and upstream distributions", () => {
    const text = formatAptStatus({
      activeKey: { revision: 4, keyId: "ABC", fingerprint: "FPR", createdAt: "2026-10-25T00:00:00Z" },
      suites: [
        { distribution: "stable", desiredRevision: 5, publishedRevision: 4, lastError: "publish failed" },
      ],
      proxyDistributions: [{ distribution: "bookworm", indexCount: 8 }],
    });

    expect(text).toContain("key FPR (revision 4)");
    expect(text).toContain("stable: 4/5, last error: publish failed");
    expect(text).toContain("Upstream: bookworm: 8 Release entries");
  });

  it("falls back to the pre-publication states for APT", () => {
    expect(formatAptStatus({})).toBe(
      "signing key will be generated on first publication. Suites: no metadata snapshot published.",
    );
  });

  it("summarises Alpine signing key, namespaces and upstream proxies", () => {
    const text = formatAlpineStatus({
      activeKey: { revision: 2, keyFilename: "acme.rsa.pub", fingerprint: "FPR2", signatureType: "RSA256" },
      namespaces: [{ namespace: "v3.23/main/x86_64", desiredRevision: 3, publishedRevision: 3 }],
      proxyNamespaces: [{ namespace: "v3.23/main/x86_64", signatureVerified: true }],
    });

    expect(text).toContain("acme.rsa.pub · FPR2 · revision 2");
    expect(text).toContain("v3.23/main/x86_64: 3/3");
    expect(text).toContain("Upstream: v3.23/main/x86_64: verified");
  });

  it("falls back to the pre-publication states for Alpine", () => {
    expect(formatAlpineStatus({})).toBe(
      "Key: no active signing key. Namespaces: no signed index snapshot published.",
    );
  });
});
