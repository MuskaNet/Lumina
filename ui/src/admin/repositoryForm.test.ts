import { describe, expect, it } from "vitest";
import {
  ALPINE_METADATA_MODES,
  ALPINE_SIGNATURE_TYPES,
  APT_METADATA_MODES,
  applyRecipeDefaults,
  buildRepositoryPayload,
  createRepositoryDraft,
  firstAlpineNamespace,
  repositoryDraftFromView,
  type RepositoryDraft,
} from "./repositoryForm";

const alpineRecipe = { value: "alpine-proxy", label: "alpine · PROXY", format: "alpine", type: "PROXY" };

function draftFor(format: string, type: string): RepositoryDraft {
  const draft = createRepositoryDraft();
  applyRecipeDefaults(draft, format, type);
  return draft;
}

function payloadFor(draft: RepositoryDraft, format: string, type: string) {
  return buildRepositoryPayload(draft, format, type, false);
}

interface ProxyPayload {
  proxy: {
    remoteUrl: string;
    contentMaxAgeMinutes: number | null;
    metadataMaxAgeMinutes: number | null;
    remoteAuthenticationType: string;
    remotePassword: string | null;
    remotePasswordConfigured: boolean | null;
    remoteBearerToken: string | null;
    remoteBearerTokenConfigured: boolean | null;
    outboundProxyType: string;
    outboundProxyHost: string | null;
    outboundProxyPort: number | null;
    outboundProxyUsername: string | null;
    outboundProxyPassword: string | null;
    outboundProxyPasswordConfigured: boolean | null;
    minimumReleaseAgeMinutes: number | null;
    allowedRedirectHosts: string[];
  };
}

interface AptPayload {
  apt: {
    distribution: string;
    component: string;
    architectures: string[];
    flat: boolean;
    enforceDistribution: boolean;
    metadataMode: string;
    validUntilDays: number;
    origin: string;
    label: string;
  };
}

interface AlpinePayload {
  alpine: {
    distributions: string[];
    channels: string[];
    architectures: string[];
    metadataMode: string;
    verifyUpstreamSignatures: boolean;
    staleIfError: boolean;
    keyFilename: string | null;
    signatureType: string;
    description: string | null;
    upstreamPublicKeys: string[];
  };
}

describe("repository form metadata modes", () => {
  it("uses the server-side metadata mode and signature enums", () => {
    expect(APT_METADATA_MODES.map((mode) => mode.value)).toEqual(["PASSTHROUGH", "RESIGN"]);
    expect(ALPINE_METADATA_MODES.map((mode) => mode.value)).toEqual(["PASSTHROUGH", "RESIGN"]);
    expect(ALPINE_SIGNATURE_TYPES.map((mode) => mode.value)).toEqual(["RSA", "RSA256", "RSA512"]);
  });

  it("creates with the upstream console defaults", () => {
    const draft = createRepositoryDraft(alpineRecipe, "default");

    expect(draft.recipe).toBe("alpine-proxy");
    expect(draft.strictContentTypeValidation).toBe(true);
    expect(draft.writePolicy).toBe("ALLOW_ONCE");
    expect(draft.aptDistribution).toBe("stable");
    expect(draft.aptArchitectures).toBe("amd64");
    expect(draft.alpineDistributions).toBe("v3.23");
    expect(draft.alpineMetadataMode).toBe("PASSTHROUGH");
    expect(draft.alpineSignatureType).toBe("RSA");
    expect(draft.pypiIndexPath).toBe("/simple");
    expect(draft.yumRepodataDepth).toBe(0);
  });

  it("forces locally signed metadata for hosted and group repositories", () => {
    const hosted = draftFor("apt", "HOSTED");
    expect(hosted.aptMetadataMode).toBe("RESIGN");
    expect(hosted.aptEnforceDistribution).toBe(true);
    const hostedAlpine = draftFor("alpine", "HOSTED");
    expect(hostedAlpine.alpineMetadataMode).toBe("RESIGN");
    expect(hostedAlpine.alpineVerifyUpstreamSignatures).toBe(true);
    const group = draftFor("alpine", "GROUP");
    expect(group.alpineMetadataMode).toBe("RESIGN");
  });

  it("defaults proxy repositories to the official upstream URLs", () => {
    expect(draftFor("npm", "PROXY").remoteUrl).toBe("https://registry.npmjs.org/");
    expect(draftFor("nuget", "PROXY").remoteUrl).toBe("https://api.nuget.org/v3/index.json");
    expect(draftFor("swift", "PROXY").remoteUrl).toBe("https://github.com/");
    expect(draftFor("maven2", "HOSTED").remoteUrl).toBe("");
  });
});

describe("APT payload", () => {
  it("publishes locally signed metadata for hosted repositories", () => {
    const payload = payloadFor(draftFor("apt", "HOSTED"), "apt", "HOSTED") as unknown as AptPayload;

    expect(payload.apt).toMatchObject({
      distribution: "stable",
      component: "main",
      architectures: ["amd64"],
      flat: false,
      enforceDistribution: true,
      metadataMode: "RESIGN",
      validUntilDays: 30,
      origin: "kkRepo",
      label: "kkRepo",
    });
  });

  it("keeps proxy passthrough and never re-signs a flat upstream", () => {
    const draft = draftFor("apt", "PROXY");
    expect((payloadFor(draft, "apt", "PROXY") as unknown as AptPayload).apt.metadataMode).toBe(
      "PASSTHROUGH",
    );

    draft.aptMetadataMode = "RESIGN";
    draft.aptFlat = false;
    expect((payloadFor(draft, "apt", "PROXY") as unknown as AptPayload).apt.metadataMode).toBe(
      "RESIGN",
    );

    draft.aptFlat = true;
    expect((payloadFor(draft, "apt", "PROXY") as unknown as AptPayload).apt.metadataMode).toBe(
      "PASSTHROUGH",
    );
  });
});

describe("Alpine payload", () => {
  it("signs locally for hosted repositories and omits upstream trust entries", () => {
    const draft = draftFor("alpine", "HOSTED");
    draft.alpineUpstreamPublicKey = "filename=upstream.rsa.pub\n-----BEGIN PUBLIC KEY-----";
    const payload = payloadFor(draft, "alpine", "HOSTED") as unknown as AlpinePayload;

    expect(payload.alpine).toMatchObject({
      distributions: ["v3.23"],
      channels: ["main"],
      architectures: ["x86_64", "aarch64"],
      metadataMode: "RESIGN",
      verifyUpstreamSignatures: true,
      staleIfError: true,
      keyFilename: "kkrepo-alpine.rsa.pub",
      signatureType: "RSA",
      upstreamPublicKeys: [],
    });
  });

  it("passes through proxy indexes unless the operator selects re-signing", () => {
    const draft = draftFor("alpine", "PROXY");
    expect((payloadFor(draft, "alpine", "PROXY") as unknown as AlpinePayload).alpine).toMatchObject({
      metadataMode: "PASSTHROUGH",
      verifyUpstreamSignatures: false,
      upstreamPublicKeys: [],
    });

    draft.alpineMetadataMode = "RESIGN";
    draft.alpineVerifyUpstreamSignatures = true;
    draft.alpineUpstreamPublicKey = "filename=upstream.rsa.pub\n-----BEGIN PUBLIC KEY-----";
    draft.alpineSignatureType = "RSA256";
    const resign = (payloadFor(draft, "alpine", "PROXY") as unknown as AlpinePayload).alpine;
    expect(resign.metadataMode).toBe("RESIGN");
    expect(resign.verifyUpstreamSignatures).toBe(true);
    expect(resign.signatureType).toBe("RSA256");
    expect(resign.upstreamPublicKeys).toEqual(["filename=upstream.rsa.pub\n-----BEGIN PUBLIC KEY-----"]);
  });
  it("includes an optional routing rule in repository payloads", () => {
    const draft = createRepositoryDraft();
    draft.routingRuleName = "blocked-public";
    const payload = buildRepositoryPayload(draft, "maven2", "PROXY", false);
    expect(payload.routingRuleName).toBe("blocked-public");
  });

  it("carries upstream authentication, bearer token, cache ages and redirect hosts", () => {
    const draft = draftFor("nuget", "PROXY");
    draft.remoteAuthenticationType = "ntlm";
    draft.remoteNtlmDomain = "CORP";
    draft.remoteNtlmHost = "build-01";
    draft.remoteUsername = "svc";
    draft.remotePassword = "secret";
    draft.remoteBearerToken = "token";
    draft.remoteBearerTokenClear = true;
    draft.remotePasswordClear = true;
    draft.allowedRedirectHosts = "*.quay.io\nartifacts.example.com";
    const payload = payloadFor(draft, "nuget", "PROXY") as unknown as ProxyPayload;

    expect(payload.proxy).toMatchObject({
      remoteUrl: "https://api.nuget.org/v3/index.json",
      remoteAuthenticationType: "ntlm",
      remoteNtlmDomain: "CORP",
      remoteNtlmHost: "build-01",
      remoteUsername: "svc",
      remotePassword: "secret",
      remotePasswordConfigured: false,
      remoteBearerToken: "token",
      remoteBearerTokenConfigured: false,
      contentMaxAgeMinutes: 1440,
      metadataMaxAgeMinutes: 1440,
      minimumReleaseAgeMinutes: null,
      allowedRedirectHosts: ["*.quay.io", "artifacts.example.com"],
    });
  });

  it("configures the outbound network proxy block", () => {
    const draft = draftFor("npm", "PROXY");
    draft.outboundProxyType = "SOCKS";
    draft.outboundProxyHost = "192.168.1.10";
    draft.outboundProxyPort = 7890;
    draft.outboundProxyUsername = "proxy";
    draft.outboundProxyPassword = "pw";
    draft.outboundProxyPasswordClear = true;
    const payload = payloadFor(draft, "npm", "PROXY") as unknown as ProxyPayload;

    expect(payload.proxy).toMatchObject({
      outboundProxyType: "SOCKS",
      outboundProxyHost: "192.168.1.10",
      outboundProxyPort: 7890,
      outboundProxyUsername: "proxy",
      outboundProxyPassword: "pw",
      outboundProxyPasswordConfigured: false,
    });
  });

  it("only sends npm release-age protection and PyPI index paths where they apply", () => {
    const npm = payloadFor(draftFor("npm", "PROXY"), "npm", "PROXY") as unknown as ProxyPayload;
    expect(npm.proxy.minimumReleaseAgeMinutes).toBe(0);

    const maven = payloadFor(draftFor("maven2", "PROXY"), "maven2", "PROXY") as unknown as ProxyPayload;
    expect(maven.proxy.minimumReleaseAgeMinutes).toBeNull();

    const pypiPayload = payloadFor(draftFor("pypi", "PROXY"), "pypi", "PROXY");
    expect(pypiPayload.pypi).toEqual({ indexPath: "/simple" });
    expect(payloadFor(draftFor("pypi", "HOSTED"), "pypi", "HOSTED").pypi).toBeUndefined();
  });

  it("keeps version and layout policies Maven-only", () => {
    const maven = payloadFor(draftFor("maven2", "HOSTED"), "maven2", "HOSTED");
    expect(maven.hosted).toEqual({
      writePolicy: "ALLOW_ONCE",
      versionPolicy: "RELEASE",
      layoutPolicy: "STRICT",
    });
    const npm = payloadFor(draftFor("npm", "HOSTED"), "npm", "HOSTED");
    expect(npm.hosted).toEqual({
      writePolicy: "ALLOW_ONCE",
      versionPolicy: null,
      layoutPolicy: null,
    });
  });
});

describe("format payload scoping", () => {
  it("sends Yum depth only for hosted repositories", () => {
    expect(payloadFor(draftFor("yum", "HOSTED"), "yum", "HOSTED").yum).toEqual({ repodataDepth: 0 });
    expect(payloadFor(draftFor("yum", "PROXY"), "yum", "PROXY").yum).toBeUndefined();
  });

  it("sends Conan limits except for groups", () => {
    expect(payloadFor(draftFor("conan", "PROXY"), "conan", "PROXY").conan).toEqual({
      manifestMaxEntries: null,
      manifestMaxBytes: null,
    });
    expect(payloadFor(draftFor("conan", "GROUP"), "conan", "GROUP").conan).toBeUndefined();
  });

  it("omits identity fields on update", () => {
    const payload = payloadFor(draftFor("raw", "HOSTED"), "raw", "HOSTED");
    expect(payload.name).toBeUndefined();
    expect(payload.recipe).toBeUndefined();
    expect(payload.blobStoreName).toBeUndefined();
    expect(payload.raw).toEqual({ contentDisposition: null });
  });
});

describe("edit drafts", () => {
  it("prefills stored settings but never the secrets", () => {
    const draft = repositoryDraftFromView({
      name: "alpine-proxy",
      recipe: "alpine-proxy",
      format: "alpine",
      type: "PROXY",
      strictContentTypeValidation: true,
      proxy: {
        remoteUrl: "https://dl-cdn.alpinelinux.org/alpine/",
        contentMaxAgeMinutes: 1440,
        metadataMaxAgeMinutes: 1440,
        autoBlock: true,
        outboundProxyType: "SOCKS5",
        outboundProxyHost: "192.168.1.10",
        outboundProxyPort: 7890,
        remotePasswordConfigured: true,
        remoteBearerTokenConfigured: true,
        outboundProxyPasswordConfigured: true,
        minimumReleaseAgeMinutes: 0,
        allowedRedirectHosts: ["artifacts.example.com"],
      },
      alpine: {
        distributions: ["v3.20"],
        channels: ["main", "community"],
        architectures: ["x86_64"],
        metadataMode: "PASSTHROUGH",
        verifyUpstreamSignatures: true,
        staleIfError: false,
        keyFilename: "acme.rsa.pub",
        signatureType: "RSA512",
        description: "ACME",
        upstreamPublicKeys: ["filename=key.rsa.pub\n-----BEGIN PUBLIC KEY-----"],
      },
    });

    expect(draft.outboundProxyType).toBe("SOCKS");
    expect(draft.remotePassword).toBe("");
    expect(draft.remoteBearerToken).toBe("");
    expect(draft.outboundProxyPassword).toBe("");
    expect(draft.remotePasswordClear).toBe(false);
    expect(draft.alpineDistributions).toBe("v3.20");
    expect(draft.alpineChannels).toBe("main, community");
    expect(draft.alpineMetadataMode).toBe("PASSTHROUGH");
    expect(draft.alpineSignatureType).toBe("RSA512");
    expect(draft.alpineKeyFilename).toBe("acme.rsa.pub");
    expect(draft.alpineUpstreamPublicKey).toBe("filename=key.rsa.pub\n-----BEGIN PUBLIC KEY-----");
    expect(draft.allowedRedirectHosts).toBe("artifacts.example.com");
  });

  it("falls back to the type defaults for legacy APT/Alpine records", () => {
    const hosted = repositoryDraftFromView({
      name: "apt-hosted",
      type: "HOSTED",
      format: "apt",
      apt: {},
    });
    expect(hosted.aptMetadataMode).toBe("RESIGN");
    expect(hosted.aptArchitectures).toBe("amd64");

    const proxy = repositoryDraftFromView({
      name: "alpine-proxy",
      type: "PROXY",
      format: "alpine",
      alpine: {},
    });
    expect(proxy.alpineMetadataMode).toBe("PASSTHROUGH");
    expect(proxy.alpineKeyFilename).toBe("alpine-proxy.rsa.pub");
    expect(proxy.alpineSignatureType).toBe("RSA");
  });
});

describe("alpine rebuild namespace", () => {
  it("uses the first configured distribution, channel and architecture", () => {
    const draft = createRepositoryDraft();
    draft.alpineDistributions = "v3.20, v3.23";
    draft.alpineChannels = "main, community";
    draft.alpineArchitectures = "aarch64, x86_64";
    expect(firstAlpineNamespace(draft)).toBe("v3.20/main/aarch64");
  });

  it("falls back to the official defaults when the lists are empty", () => {
    const draft = createRepositoryDraft();
    draft.alpineDistributions = "";
    draft.alpineChannels = "";
    draft.alpineArchitectures = "";
    expect(firstAlpineNamespace(draft)).toBe("v3.23/main/x86_64");
  });
});
