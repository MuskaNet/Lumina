import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "../shared/i18n";
import { formatAlpineStatus, formatAptStatus, formatConanStatus } from "./repositoryStatus";

beforeEach(() => setLanguage("en"));
afterEach(() => setLanguage("en"));

describe("repository status summaries", () => {
  it("translates Chinese status prose without changing namespaces, key filenames, fingerprints or server errors", () => {
    setLanguage("zh-CN");
    expect(formatConanStatus({ recipes: 7, packages: 12 })).toContain("7 个配方");
    expect(formatConanStatus({ recipes: 7, packages: 12 })).toContain("12 个软件包");
    expect(formatAptStatus({})).toBe("首次发布时将生成签名密钥. 发行版套件: 尚未发布元数据快照.");
    expect(formatAlpineStatus({})).toBe("密钥: 没有有效的签名密钥. 命名空间: 尚未发布签名索引快照.");
    const apt = formatAptStatus({
      activeKey: { fingerprint: "FPR", revision: 4 },
      suites: [{ distribution: "bookworm", publishedRevision: 4, desiredRevision: 5, lastError: "publish failed" }],
      proxyDistributions: [{ distribution: "stable", indexCount: 8 }],
    });
    expect(apt).toContain("密钥 FPR (修订版本 4)");
    expect(apt).toContain("bookworm: 4/5, 最近错误: publish failed");
    expect(apt).toContain("上游: stable: 8 个 Release 条目");
    const alpine = formatAlpineStatus({
      activeKey: { keyFilename: "acme.rsa.pub", fingerprint: "FPR2", revision: 2 },
      proxyNamespaces: [
        { namespace: "v3.23/main/x86_64", signatureVerified: true },
        { namespace: "edge/community/aarch64", signatureVerified: false },
      ],
    });
    expect(alpine).toContain("acme.rsa.pub · FPR2 · 修订版本 2");
    expect(alpine).toContain("v3.23/main/x86_64: 已验证");
    expect(alpine).toContain("edge/community/aarch64: 未验证");
  });
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
