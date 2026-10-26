import { describe, expect, it } from "vitest";
import {
  attributeGroups,
  directoryIcon,
  dockerCoordinates,
  dockerMetadataPanel,
  dockerTagFromDockerPath,
  fileIcon,
  imageNameFromDockerPath,
  isDockerDetail,
  summaryPanel,
} from "./detail";
import type { BrowseAssetDetail, BrowseEntry } from "./browseModel";
import { formatInstant } from "./formatters";

const UPDATED = "2026-01-02T03:04:05Z";
const DIGEST_64 = "a".repeat(64);

function entry(overrides: Partial<BrowseEntry> = {}): BrowseEntry {
  return {
    name: "app.jar",
    path: "com/acme/app/1.0/app.jar",
    leaf: true,
    ...overrides,
  };
}

describe("summaryPanel", () => {
  it("builds the generic rows with uploader, uploader IP and checksum", () => {
    const detail: BrowseAssetDetail = {
      uploader: "alice",
      uploaderIp: "10.0.0.7",
      size: 2048,
      contentType: "application/java-archive",
      lastUpdatedAt: UPDATED,
      checksum: { sha1: "abc123" },
    };

    const panel = summaryPanel("maven-hosted", entry(), detail);

    expect(panel.title).toBe("Summary");
    expect(panel.rows).toEqual([
      { label: "Repository", value: "maven-hosted" },
      { label: "Path", value: "com/acme/app/1.0/app.jar" },
      { label: "Uploader", value: "alice" },
      { label: "Uploader IP", value: "10.0.0.7" },
      { label: "Size", value: "2.0 KiB (2048 bytes)" },
      { label: "Content-Type", value: "application/java-archive" },
      { label: "Last updated", value: formatInstant(UPDATED) },
      { label: "SHA-1", value: "abc123", code: true },
    ]);
  });

  it("falls back to entry fields for a missing detail payload", () => {
    const panel = summaryPanel(
      "raw-hosted",
      entry({ name: "readme.txt", path: "docs/readme.txt", size: 1024, contentType: "text/plain", sha1: "entry-sha1", lastUpdatedAt: UPDATED }),
      null,
    );

    expect(panel.rows).toEqual([
      { label: "Repository", value: "raw-hosted" },
      { label: "Path", value: "docs/readme.txt" },
      { label: "Uploader", value: "-" },
      { label: "Size", value: "1.0 KiB (1024 bytes)" },
      { label: "Content-Type", value: "text/plain" },
      { label: "Last updated", value: formatInstant(UPDATED) },
      { label: "SHA-1", value: "entry-sha1", code: true },
    ]);
    expect(panel.rows.some((row) => row.label === "Uploader IP")).toBe(false);
  });

  it("shows the source repository only when it differs from the browsed repository", () => {
    const withSource = summaryPanel("group-repo", entry(), {
      sourceRepository: "member-repo",
      size: 1,
    });
    expect(withSource.rows).toContainEqual({ label: "Source repository", value: "member-repo" });

    const sameSource = summaryPanel("group-repo", entry(), {
      sourceRepository: "group-repo",
      size: 1,
    });
    expect(sameSource.rows.some((row) => row.label === "Source repository")).toBe(false);
  });

  it("builds the legacy Docker rows for manifests", () => {
    const detail: BrowseAssetDetail = {
      sourceRepository: "docker-proxy",
      uploader: "proxy",
      uploaderIp: "203.0.113.9",
      lastUpdatedAt: UPDATED,
      docker: {
        asset_kind: "MANIFEST",
        image_name: "library/nginx",
        reference: "1.25",
        digest: "sha256:deadbeef",
        manifest_size_bytes: 1536,
        layer_size_bytes: 4096,
        cached_image_size_bytes: 2048,
        cached_image_platform: "linux/amd64",
      },
    };

    const panel = summaryPanel(
      "docker-hosted",
      entry({ name: "manifest.json", path: "v2/library/nginx/manifests/1.25" }),
      detail,
    );

    expect(panel.rows).toEqual([
      { label: "Repository", value: "docker-hosted" },
      { label: "Source repository", value: "docker-proxy" },
      { label: "Path", value: "v2/library/nginx/manifests/1.25" },
      { label: "Image", value: "library/nginx" },
      { label: "Reference", value: "1.25" },
      { label: "Digest", value: "sha256:deadbeef", code: true },
      { label: "Asset type", value: "Manifest" },
      { label: "Manifest size", value: "1.5 KiB (1536 bytes)" },
      { label: "Image size", value: "4.0 KiB (4096 bytes)" },
      { label: "Cached image size", value: "2.0 KiB (2048 bytes)" },
      { label: "Cached platform", value: "linux/amd64" },
      { label: "Cached by", value: "proxy" },
      { label: "Remote", value: "203.0.113.9" },
      { label: "Last updated", value: formatInstant(UPDATED) },
    ]);
  });

  it("uses Blob size and the Blob asset type for Docker blobs", () => {
    const detail: BrowseAssetDetail = {
      uploader: "admin",
      docker: {
        asset_kind: "BLOB",
        blob_size_bytes: 512,
        digest: "sha256:blob",
      },
      size: 512,
    };

    const panel = summaryPanel(
      "docker-hosted",
      entry({ name: "blob", path: "v2/library/nginx/blobs/sha256:blob" }),
      detail,
    );

    expect(panel.rows).toContainEqual({ label: "Asset type", value: "Blob" });
    expect(panel.rows).toContainEqual({ label: "Blob size", value: "512 B (512 bytes)" });
    expect(panel.rows.some((row) => row.label === "Manifest size")).toBe(false);
    expect(panel.rows).toContainEqual({ label: "Uploaded by", value: "admin" });
  });

  it("derives Docker coordinates from the path and defaults the reference to latest", () => {
    const panel = summaryPanel(
      "docker-hosted",
      entry({ name: "manifest.json", path: "v2/library/nginx/manifests/1.25" }),
      { docker: { asset_kind: "MANIFEST" }, size: 100 },
    );

    expect(panel.rows).toContainEqual({ label: "Image", value: "library/nginx" });
    expect(panel.rows).toContainEqual({ label: "Reference", value: "1.25" });
    expect(panel.rows).toContainEqual({ label: "Digest", value: "-", code: true });
    expect(panel.rows).toContainEqual({ label: "Asset type", value: "Manifest" });
  });
});

describe("dockerMetadataPanel", () => {
  it("returns null when the asset has no Docker attributes", () => {
    expect(dockerMetadataPanel(null)).toBeNull();
    expect(dockerMetadataPanel({})).toBeNull();
    expect(dockerMetadataPanel({ docker: {} })).toBeNull();
  });

  it("builds counts, tags and the platform/descriptor/referrer groups", () => {
    const detail: BrowseAssetDetail = {
      contentType: "application/vnd.oci.image.index.v1+json",
      docker: {
        asset_kind: "MANIFEST",
        media_type: "application/vnd.oci.image.index.v1+json",
        layer_count: 3,
        cached_layer_count: 2,
        layer_size_bytes: 3072,
        cached_layer_size_bytes: 2048,
        referenced_size_bytes: 4096,
        platform_count: 2,
        cached_platform_count: 1,
        platform_summary: "linux/amd64, linux/arm64/v8",
        descriptor_count: 3,
        tags: ["latest", "1.25"],
        referrer_count: 1,
        platforms: [
          {
            platform: "linux/amd64",
            digest: "sha256:aaa",
            media_type: "application/vnd.oci.image.manifest.v1+json",
            manifest_size_bytes: 1024,
            cached_image_size_bytes: 2048,
          },
          {
            platform: "linux/arm64",
            digest: "sha256:bbb",
            manifest_size_bytes: 2048,
          },
        ],
        config_descriptors: [
          {
            digest: "sha256:ccc",
            media_type: "application/vnd.oci.image.config.v1+json",
            size_bytes: 100,
          },
        ],
        layer_descriptors: [
          {
            digest: "sha256:ddd",
            media_type: "application/vnd.oci.image.layer.v1.tar+gzip",
            size_bytes: 5000,
          },
        ],
        manifest_descriptors: [
          {
            digest: "sha256:eee",
            media_type: "application/vnd.oci.image.manifest.v1+json",
            size_bytes: 1024,
            platform: "linux/amd64",
          },
        ],
        referrers: [
          {
            digest: "sha256:fff",
            artifact_type: "application/vnd.dev.sigstore.bundle.v0.3+json",
            size_bytes: 300,
            image_name: "library/nginx",
          },
        ],
      },
    };

    const panel = dockerMetadataPanel(detail);

    expect(panel).not.toBeNull();
    expect(panel?.title).toBe("Docker metadata");
    expect(panel?.rows).toEqual([
      { label: "Media type", value: "application/vnd.oci.image.index.v1+json" },
      { label: "Layers", value: "3" },
      { label: "Cached layers", value: "2 / 3" },
      { label: "Layer size", value: "3.0 KiB (3072 bytes)" },
      { label: "Cached layer size", value: "2.0 KiB (2048 bytes)" },
      { label: "Referenced size", value: "4.0 KiB (4096 bytes)" },
      { label: "Platforms", value: "2" },
      { label: "Cached platforms", value: "1 / 2" },
      { label: "Platform summary", value: "linux/amd64, linux/arm64/v8" },
      { label: "Descriptors", value: "3" },
      { label: "Tags", value: "latest, 1.25" },
      { label: "Referrers", value: "1" },
    ]);
    expect(panel?.groups).toEqual([
      {
        title: "Platforms",
        rows: [
          { digest: "sha256:aaa", sizeBytes: 2048, platform: "linux/amd64" },
          { digest: "sha256:bbb", sizeBytes: 2048, platform: "linux/arm64" },
        ],
      },
      {
        title: "Config",
        rows: [
          {
            digest: "sha256:ccc",
            mediaType: "application/vnd.oci.image.config.v1+json",
            sizeBytes: 100,
          },
        ],
      },
      {
        title: "Layers",
        rows: [
          {
            digest: "sha256:ddd",
            mediaType: "application/vnd.oci.image.layer.v1.tar+gzip",
            sizeBytes: 5000,
          },
        ],
      },
      {
        title: "Child manifests",
        rows: [
          {
            digest: "sha256:eee",
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            sizeBytes: 1024,
            platform: "linux/amd64",
          },
        ],
      },
      {
        title: "Referrers",
        rows: [
          {
            digest: "sha256:fff",
            artifactType: "application/vnd.dev.sigstore.bundle.v0.3+json",
            sizeBytes: 300,
            imageName: "library/nginx",
          },
        ],
      },
    ]);
  });

  it("falls back to the detail content type for the media type row", () => {
    const panel = dockerMetadataPanel({
      contentType: "application/vnd.oci.image.manifest.v1+json",
      docker: { asset_kind: "MANIFEST" },
    });

    expect(panel?.rows).toEqual([
      { label: "Media type", value: "application/vnd.oci.image.manifest.v1+json" },
    ]);
    expect(panel?.groups).toEqual([]);
  });
});

describe("attributeGroups", () => {
  const detail: BrowseAssetDetail = {
    checksum: {
      sha1: "abc123",
      algorithms: ["sha1", "sha256"],
      digest: { value: "x" },
      absent: null,
    },
    content: {},
    docker: { asset_kind: "MANIFEST", platform_summary: "linux/amd64" },
    npm: { package_name: "left-pad" },
    apt: { distribution: "bookworm" },
    provenance: { predicate: "slsa" },
  };

  it("skips empty groups and formats array/object attribute values", () => {
    const groups = attributeGroups(detail);

    expect(groups.map((group) => group.title)).toEqual([
      "Checksum",
      "Docker",
      "Npm",
      "Apt",
      "Provenance",
    ]);
    expect(groups[0].rows).toEqual([
      { label: "sha1", value: "abc123" },
      { label: "algorithms", value: "sha1, sha256" },
      { label: "digest", value: '{"value":"x"}' },
    ]);
    expect(groups[1].rows).toEqual([
      { label: "asset_kind", value: "MANIFEST" },
      { label: "platform_summary", value: "linux/amd64" },
    ]);
  });

  it("hides the Docker group when the dedicated Docker panel is rendered", () => {
    const groups = attributeGroups(detail, { hideDocker: true });

    expect(groups.map((group) => group.title)).toEqual([
      "Checksum",
      "Npm",
      "Apt",
      "Provenance",
    ]);
  });

  it("returns no groups for a missing detail payload", () => {
    expect(attributeGroups(null)).toEqual([]);
  });

  it("keeps the legacy group order", () => {
    const populated: BrowseAssetDetail = {
      checksum: { sha1: "a" },
      content: { content_type: "x" },
      docker: { asset_kind: "MANIFEST" },
      npm: { package_name: "x" },
      pub: { package_name: "x" },
      composer: { package_name: "x" },
      conda: { package_name: "x" },
      apt: { distribution: "x" },
      alpine: { distribution: "x" },
      r: { package_name: "x" },
      huggingface: { repo_id: "x" },
      swift: { identity: "x" },
      ansible: { namespace: "x" },
      provenance: { predicate_type: "x" },
    };

    expect(attributeGroups(populated).map((group) => group.title)).toEqual([
      "Checksum",
      "Content",
      "Docker",
      "Npm",
      "Pub",
      "Composer",
      "Conda",
      "Apt",
      "Alpine",
      "R / CRAN",
      "Hugging Face",
      "Swift",
      "Ansible Galaxy",
      "Provenance",
    ]);
  });
});

describe("isDockerDetail", () => {
  it("treats Docker repositories and Docker asset kinds as Docker details", () => {
    expect(isDockerDetail("docker", null)).toBe(true);
    expect(isDockerDetail("Docker", null)).toBe(true);
    expect(isDockerDetail("maven2", { docker: { asset_kind: "MANIFEST" } })).toBe(true);
    expect(isDockerDetail(null, { docker: { asset_kind: "BLOB" } })).toBe(true);
  });

  it("returns false for non-Docker repositories without Docker asset metadata", () => {
    expect(isDockerDetail("maven2", null)).toBe(false);
    expect(isDockerDetail(undefined, { docker: {} })).toBe(false);
    expect(isDockerDetail(null, null)).toBe(false);
  });
});

describe("Docker path helpers", () => {
  it("derives the image name from manifests and blobs paths", () => {
    expect(imageNameFromDockerPath("v2/library/nginx/manifests/1.25")).toBe("library/nginx");
    expect(imageNameFromDockerPath("library/nginx/manifests/1.25")).toBe("library/nginx");
    expect(imageNameFromDockerPath(`v2/library/nginx/blobs/sha256:${DIGEST_64}`)).toBe("library/nginx");
    expect(imageNameFromDockerPath(`library/nginx/blobs/sha256:${DIGEST_64}`)).toBe("library/nginx");
    expect(imageNameFromDockerPath("plain/file.txt")).toBe("");
    expect(imageNameFromDockerPath("")).toBe("");
  });

  it("derives tags but rejects digest references", () => {
    expect(dockerTagFromDockerPath("v2/app/manifests/1.0")).toBe("1.0");
    expect(dockerTagFromDockerPath(`v2/app/manifests/sha256:${DIGEST_64}`)).toBe("");
    expect(dockerTagFromDockerPath(`v2/app/blobs/sha256:${DIGEST_64}`)).toBe("");
    expect(dockerTagFromDockerPath("v2/app")).toBe("");
  });

  it("prefers Docker attributes and falls back to path values and latest", () => {
    const pathEntry = entry({ name: "manifest.json", path: "v2/library/nginx/manifests/1.25" });

    expect(dockerCoordinates(pathEntry, null)).toEqual({
      image: "library/nginx",
      reference: "1.25",
      digest: "",
    });

    const fromBlobPath = entry({ name: "blob", path: `v2/library/nginx/blobs/sha256:${DIGEST_64}` });
    expect(dockerCoordinates(fromBlobPath, null)).toEqual({
      image: "library/nginx",
      reference: "latest",
      digest: "",
    });

    expect(
      dockerCoordinates(pathEntry, {
        docker: { image_name: "custom/app", reference: "stable", digest: "sha256:attribute" },
      }),
    ).toEqual({ image: "custom/app", reference: "stable", digest: "sha256:attribute" });

    expect(
      dockerCoordinates(pathEntry, { docker: { raw_bytes_digest: "sha256:raw" } }),
    ).toEqual({ image: "library/nginx", reference: "1.25", digest: "sha256:raw" });
  });
});

describe("fileIcon", () => {
  it("maps representative suffixes to Material Symbols ligatures", () => {
    const cases: Array<[string, string]> = [
      ["app.json", "data_object"],
      ["app.module", "data_object"],
      ["app.info", "data_object"],
      ["app.pom", "code"],
      ["app.xml", "code"],
      ["app.nuspec", "code"],
      ["go.mod", "description"],
      ["go.sum", "description"],
      ["values.yaml", "description"],
      ["values.yml", "description"],
      ["model.safetensors", "layers"],
      ["tool.bin", "data_object"],
      ["pkg.whl", "inventory_2"],
      ["pkg.egg", "inventory_2"],
      ["pkg.nupkg", "inventory_2"],
      ["pkg.crate", "inventory_2"],
      ["pkg.gem", "inventory_2"],
      ["pkg.rpm", "inventory_2"],
      ["app.jar", "deployed_code"],
      ["app.war", "deployed_code"],
      ["app.ear", "deployed_code"],
      ["app.aar", "deployed_code"],
      ["bundle.zip", "archive"],
      ["bundle.tar", "archive"],
      ["bundle.tar.gz", "archive"],
      ["bundle.tgz", "archive"],
      ["release.asc", "key"],
      ["release.sig", "key"],
      ["release.key", "key"],
      ["release.tgz.prov", "key"],
      ["app.jar.sha1", "fact_check"],
      ["app.jar.sha256", "fact_check"],
      ["app.jar.sha512", "fact_check"],
      ["app.jar.md5", "fact_check"],
      ["README", "description"],
      ["notes.txt", "description"],
    ];

    for (const [name, icon] of cases) {
      expect(fileIcon(name, "raw"), name).toBe(icon);
    }
  });

  it("keeps the legacy format-specific overrides", () => {
    expect(fileIcon("pkg.apk", "alpine")).toBe("archive");
    expect(fileIcon("pkg.apk", "raw")).toBe("description");
    expect(fileIcon("pkg.tar.gz", "r")).toBe("archive");
    expect(fileIcon("config", "cargo")).toBe("data_object");
    expect(fileIcon("config", "raw")).toBe("description");
    expect(fileIcon("list", "go")).toBe("description");
    expect(fileIcon("@latest", "go")).toBe("data_object");
    expect(fileIcon("@latest", "raw")).toBe("description");
    expect(fileIcon("versions", "rubygems")).toBe("description");
    expect(fileIcon("names", "rubygems")).toBe("description");
  });

  it("recognizes Docker blob digests as data objects", () => {
    expect(fileIcon(DIGEST_64, "docker")).toBe("data_object");
    expect(fileIcon(`sha256:${DIGEST_64}`, "docker")).toBe("data_object");
    expect(fileIcon(DIGEST_64, "raw")).toBe("description");
    expect(fileIcon(`sha256:${DIGEST_64}`, "maven2")).toBe("description");
  });

  it("matches suffixes case-insensitively and defaults to description", () => {
    expect(fileIcon("APP.JAR", "maven2")).toBe("deployed_code");
    expect(fileIcon("MODEL.SAFETENSORS", null)).toBe("layers");
    expect(fileIcon("", null)).toBe("description");
  });
});

describe("directoryIcon", () => {
  it("uses the archive icon for version-looking directory names", () => {
    expect(directoryIcon("1.6")).toBe("archive");
    expect(directoryIcon("1.7.0")).toBe("archive");
    expect(directoryIcon("1.0-SNAPSHOT")).toBe("archive");
    expect(directoryIcon("2024")).toBe("archive");
  });

  it("uses the folder icon for normal directory names", () => {
    expect(directoryIcon("com")).toBe("folder");
    expect(directoryIcon("latest")).toBe("folder");
    expect(directoryIcon("")).toBe("folder");
  });
});
