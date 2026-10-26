import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({ writeClipboard: vi.fn(async () => undefined) }));
vi.mock("../shared/clipboard", () => ({ writeClipboard: clipboard.writeClipboard }));

import BrowseDetailPane from "./BrowseDetailPane.vue";
import type { BrowseAssetDetail, BrowseEntry, UsageDetail } from "./browseModel";

const FILE: BrowseEntry = {
  name: "app.jar",
  path: "org/example/app.jar",
  leaf: true,
  size: 2048,
  contentType: "application/java-archive",
  sha1: "abc123",
  downloadUrl: "/repository/raw/org/example/app.jar",
};

const DIRECTORY: BrowseEntry = { name: "example", path: "org/example", leaf: false };

const USAGE: UsageDetail = {
  summaryRows: [
    { label: "Repository", value: "raw" },
    { label: "Group", value: "org.example" },
  ],
  snippets: [
    { displayName: "Apache Maven", snippetText: "<dependency>...</dependency>", description: "pom.xml" },
    { displayName: "Gradle", snippetText: "implementation 'org.example:app:1.0'" },
  ],
};

const GENERIC_DETAIL: BrowseAssetDetail = {
  repository: "raw",
  path: FILE.path,
  name: FILE.name,
  size: FILE.size,
  contentType: FILE.contentType,
  lastUpdatedAt: "2026-10-24T07:47:01Z",
  downloadUrl: FILE.downloadUrl,
  uploader: "admin",
  uploaderIp: "172.18.0.1",
  checksum: { sha1: "abc123", sha256: "def456" },
  content: { last_modified: "2026-10-24T07:47:01Z" },
  provenance: { hashes_not_verified: false },
};

function mountPane(overrides: Record<string, unknown> = {}) {
  return mount(BrowseDetailPane, {
    props: {
      repositoryName: "raw",
      repositoryFormat: "raw",
      entry: FILE,
      detail: GENERIC_DETAIL,
      loading: false,
      usage: USAGE,
      canDelete: true,
      ...overrides,
    },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("BrowseDetailPane", () => {
  it("renders the summary, usage and attributes for an asset", () => {
    const wrapper = mountPane();

    expect(wrapper.find(".kk-detail-head__path").text()).toBe(FILE.path);
    expect(wrapper.text()).toContain("Summary");
    expect(wrapper.text()).toContain("Uploader");
    expect(wrapper.text()).toContain("admin");
    expect(wrapper.text()).toContain("Uploader IP");
    expect(wrapper.text()).toContain("2.0 KiB (2048 bytes)");

    expect(wrapper.text()).toContain("Usage");
    expect(wrapper.find(".kk-usage__pick").text()).toContain("Apache Maven");
    expect(wrapper.find(".kk-usage__snippet").text()).toContain("<dependency>");
    expect(wrapper.find(".kk-usage__hint").text()).toBe("pom.xml");

    expect(wrapper.text()).toContain("Attributes");
    expect(wrapper.text()).toContain("Checksum");
    expect(wrapper.text()).toContain("sha256");

    const download = wrapper.find(".kk-detail-download a");
    expect(download.attributes("href")).toBe("/repository/raw/org/example/app.jar");
    expect(download.text()).toContain("Download");
  });

  it("switches usage snippets and copies the selected command", async () => {
    const wrapper = mountPane();

    await wrapper.find(".kk-usage__pick").setValue("Gradle");
    expect(wrapper.find(".kk-usage__snippet").text()).toContain("implementation");

    await wrapper.find(".kk-usage__copy").trigger("click");
    await Promise.resolve();
    expect(clipboard.writeClipboard).toHaveBeenCalledWith("implementation 'org.example:app:1.0'");
    expect(wrapper.find(".kk-usage__copy").attributes("aria-label")).toBe("Copied");
  });

  it("renders Docker metadata rows and descriptor groups", () => {
    const wrapper = mountPane({
      repositoryFormat: "docker",
      entry: { name: "sha256:abc", path: "team/app/manifests/latest", leaf: true },
      detail: {
        path: "team/app/manifests/latest",
        contentType: "application/vnd.oci.image.index.v1+json",
        uploader: "proxy",
        uploaderIp: "172.18.0.1",
        docker: {
          asset_kind: "MANIFEST",
          image_name: "team/app",
          reference: "latest",
          digest: "sha256:2595f44584cd8e6878ec016c7c82cf4dd73b8c3de6ab44998652fb1ae5375341",
          media_type: "application/vnd.oci.image.index.v1+json",
          manifest_size_bytes: 4932,
          platform_count: 2,
          platform_summary: "linux/amd64, linux/arm64",
          descriptor_count: 4,
          platforms: [
            { platform: "linux/amd64", digest: "sha256:aaa" },
            { platform: "linux/arm64", digest: "sha256:bbb" },
          ],
          tags: ["latest"],
        },
      },
    });

    expect(wrapper.text()).toContain("Docker metadata");
    expect(wrapper.text()).toContain("Cached by");
    expect(wrapper.text()).toContain("Media type");
    expect(wrapper.text()).toContain("Platform summary");
    expect(wrapper.text()).toContain("linux/amd64");
    expect(wrapper.text()).toContain("latest");
    expect(wrapper.findAll(".kk-descriptor-row").length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).not.toContain("linux/amd64 linux/amd64");
  });

  it("renders directory usage without download or attributes", () => {
    const wrapper = mountPane({ entry: DIRECTORY, detail: null });

    expect(wrapper.text()).toContain("org.example");
    expect(wrapper.text()).toContain("Usage");
    expect(wrapper.find(".kk-detail-download").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Attributes");
  });

  it("shows a loading state while the asset detail is loading", () => {
    const wrapper = mountPane({ loading: true, detail: null, usage: null });

    expect(wrapper.find(".kk-detail-loading").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Summary");
  });

  it("emits delete only when the caller allows it", async () => {
    const allowed = mountPane();
    await allowed.find(".kk-detail-head__delete").trigger("click");
    expect(allowed.emitted("delete")).toHaveLength(1);

    const denied = mountPane({ canDelete: false });
    expect(denied.find(".kk-detail-head__delete").exists()).toBe(false);
  });
});
