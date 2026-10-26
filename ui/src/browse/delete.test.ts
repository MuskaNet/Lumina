import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  send: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../shared/api/client", () => ({ api: mocks }));

import { permissions, session } from "../shared/session";
import {
  canDeleteBrowseComponentDirectory,
  canDeleteBrowseDirectory,
  canDeleteEntry,
  confirmDirectoryDeletion,
  deleteBrowseEntry,
  hasBrowseDeletePermission,
  hasDirectoryUsage,
  previewDirectoryDeletion,
} from "./delete";
import type { BrowseEntry, DirectoryDeletionPreview } from "./browseModel";

const originalSession = session.value;
const originalPermissions = [...permissions.value];

const fileEntry: BrowseEntry = {
  name: "demo-1.0.0.jar",
  path: "com/acme/demo/1.0.0/demo-1.0.0.jar",
  leaf: true,
  downloadUrl: "/repository/maven-hosted/com/acme/demo/1.0.0/demo-1.0.0.jar",
};

const versionDirectory: BrowseEntry = {
  name: "1.0.0",
  path: "com/acme/demo/1.0.0",
  leaf: false,
};

const previewFixture: DirectoryDeletionPreview = {
  path: "com/acme/demo/1.0.0",
  assetCount: 2,
  componentCount: 1,
  estimatedBytes: 4096,
  metadataAssetCount: 1,
  selectionToken: "token-1",
  items: [{ path: "com/acme/demo/1.0.0/demo-1.0.0.jar" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { userId: "admin", source: "local" };
  permissions.value = ["nexus:*"];
  mocks.get.mockResolvedValue(previewFixture);
  mocks.send.mockResolvedValue(null);
  mocks.delete.mockResolvedValue(null);
});

afterEach(() => {
  session.value = originalSession;
  permissions.value = originalPermissions;
});

describe("hasBrowseDeletePermission", () => {
  it("accepts the wildcard nexus:* grant", () => {
    expect(hasBrowseDeletePermission()).toBe(true);
  });

  it("rejects unrelated and narrower grants", () => {
    permissions.value = ["nexus:read", "nexus:repository-view:read"];
    expect(hasBrowseDeletePermission()).toBe(false);
  });

  it("rejects anonymous visitors even when a wildcard is present", () => {
    session.value = null;
    expect(hasBrowseDeletePermission()).toBe(false);
  });
});

describe("canDeleteEntry", () => {
  it("allows a permission-holding user to delete a concrete asset", () => {
    expect(canDeleteEntry({ format: "maven2", type: "hosted" }, fileEntry)).toBe(true);
  });

  it("rejects assets without a download URL (dynamically generated documents)", () => {
    expect(canDeleteEntry({ format: "maven2", type: "hosted" }, { ...fileEntry, downloadUrl: null })).toBe(false);
  });

  it("rejects assets when the delete permission is missing", () => {
    permissions.value = [];
    expect(canDeleteEntry({ format: "maven2", type: "hosted" }, fileEntry)).toBe(false);
  });

  it("rejects a missing selection", () => {
    expect(canDeleteEntry({ format: "maven2", type: "hosted" }, null)).toBe(false);
  });
});

describe("canDeleteBrowseDirectory", () => {
  it("allows a hosted maven2 version directory", () => {
    expect(canDeleteBrowseDirectory({ format: "maven2", type: "hosted" }, versionDirectory)).toBe(true);
  });

  it("rejects the same directory in a non-hosted repository", () => {
    expect(canDeleteBrowseDirectory({ format: "maven2", type: "proxy" }, versionDirectory)).toBe(false);
  });

  it("rejects leaf entries", () => {
    expect(canDeleteBrowseDirectory({ format: "maven2", type: "hosted" }, fileEntry)).toBe(false);
  });

  it("rejects formats outside the hosted directory-deletion list", () => {
    expect(canDeleteBrowseDirectory({ format: "docker", type: "hosted" }, versionDirectory)).toBe(false);
  });
});

describe("canDeleteBrowseComponentDirectory", () => {
  it("allows a PyPI package directory even outside a hosted repository", () => {
    const packageDirectory: BrowseEntry = { name: "demo-package", path: "demo-package", leaf: false };
    expect(canDeleteBrowseComponentDirectory({ format: "pypi", type: "proxy" }, packageDirectory)).toBe(true);
    expect(hasDirectoryUsage({ format: "pypi", type: "proxy" }, packageDirectory)).toBe(true);
  });

  it("rejects PyPI metadata and non-version maven2 directories", () => {
    expect(hasDirectoryUsage({ format: "pypi", type: "proxy" }, { name: "simple", path: "simple", leaf: false })).toBe(false);
    expect(canDeleteBrowseComponentDirectory(
      { format: "maven2", type: "hosted" },
      { name: "acme", path: "com/acme", leaf: false },
    )).toBe(false);
  });

  it("allows a maven2 version directory outside a hosted repository", () => {
    expect(canDeleteBrowseComponentDirectory({ format: "maven2", type: "proxy" }, versionDirectory)).toBe(true);
  });
});

describe("browse deletion API", () => {
  it("deletes one entry and forwards the source repository when set", async () => {
    await deleteBrowseEntry("maven-hosted", { ...fileEntry, sourceRepository: "maven-proxy" });

    expect(mocks.delete).toHaveBeenCalledWith(
      "/internal/browse/maven-hosted?path=com%2Facme%2Fdemo%2F1.0.0%2Fdemo-1.0.0.jar&source=maven-proxy",
    );
  });

  it("omits the source parameter when the entry has none", async () => {
    await deleteBrowseEntry("maven-hosted", fileEntry);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/internal/browse/maven-hosted?path=com%2Facme%2Fdemo%2F1.0.0%2Fdemo-1.0.0.jar",
    );
  });

  it("loads the directory-deletion preview", async () => {
    await expect(previewDirectoryDeletion("maven-hosted", "com/acme/demo/1.0.0")).resolves.toEqual(previewFixture);

    expect(mocks.get).toHaveBeenCalledWith(
      "/internal/browse/maven-hosted/directory-deletion?path=com%2Facme%2Fdemo%2F1.0.0",
    );
  });

  it("confirms a directory deletion with the reviewed selection token", async () => {
    await confirmDirectoryDeletion("maven-hosted", "com/acme/demo/1.0.0", "com/acme/demo/1.0.0", "token-1");

    expect(mocks.send).toHaveBeenCalledWith(
      "/internal/browse/maven-hosted/directory-deletion",
      "POST",
      {
        path: "com/acme/demo/1.0.0",
        confirmationPath: "com/acme/demo/1.0.0",
        selectionToken: "token-1",
      },
    );
  });

  it("sends a null selection token when the preview did not provide one", async () => {
    await confirmDirectoryDeletion("maven-hosted", "com/acme/demo/1.0.0", "com/acme/demo/1.0.0");

    expect(mocks.send).toHaveBeenCalledWith(
      "/internal/browse/maven-hosted/directory-deletion",
      "POST",
      {
        path: "com/acme/demo/1.0.0",
        confirmationPath: "com/acme/demo/1.0.0",
        selectionToken: null,
      },
    );
  });
});
