import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  deleteBrowseEntry: vi.fn(),
  previewDirectoryDeletion: vi.fn(),
  confirmDirectoryDeletion: vi.fn(),
  canDeleteBrowseDirectory: vi.fn(),
}));

vi.mock("../delete", () => ({
  hasBrowseDeletePermission: vi.fn(() => true),
  hasDirectoryUsage: vi.fn(() => false),
  canDeleteBrowseDirectory: mocks.canDeleteBrowseDirectory,
  canDeleteBrowseComponentDirectory: vi.fn(() => false),
  canDeleteEntry: vi.fn(() => true),
  deleteBrowseEntry: mocks.deleteBrowseEntry,
  previewDirectoryDeletion: mocks.previewDirectoryDeletion,
  confirmDirectoryDeletion: mocks.confirmDirectoryDeletion,
}));

import BrowseDeleteDialog from "./BrowseDeleteDialog.vue";
import type { BrowseEntry, DirectoryDeletionPreview } from "../browseModel";

const fileEntry: BrowseEntry = {
  name: "demo-1.0.0.jar",
  path: "com/acme/demo/1.0.0/demo-1.0.0.jar",
  leaf: true,
  downloadUrl: "/repository/maven-hosted/com/acme/demo/1.0.0/demo-1.0.0.jar",
};

const componentEntry: BrowseEntry = {
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
  items: [
    { path: "com/acme/demo/1.0.0/demo-1.0.0.jar" },
    { path: "com/acme/demo/1.0.0/maven-metadata.xml", action: "PROTOCOL_METADATA" },
  ],
};

type DialogVm = { open: () => Promise<void> };

async function mountDialog(entry: BrowseEntry, format = "maven2", type = "hosted") {
  const wrapper = mount(BrowseDeleteDialog, {
    props: {
      repository: "maven-hosted",
      repositoryFormat: format,
      repositoryType: type,
      entry,
    },
  });
  await (wrapper.vm as unknown as DialogVm).open();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canDeleteBrowseDirectory.mockReturnValue(false);
  mocks.deleteBrowseEntry.mockResolvedValue(undefined);
  mocks.previewDirectoryDeletion.mockResolvedValue(previewFixture);
  mocks.confirmDirectoryDeletion.mockResolvedValue(undefined);
});

describe("BrowseDeleteDialog asset mode", () => {
  it("confirms an asset deletion and reports the removed path", async () => {
    const wrapper = await mountDialog(fileEntry);

    expect(mocks.canDeleteBrowseDirectory).toHaveBeenCalled();
    expect(wrapper.get("#kk-dialog-title").text()).toBe("Delete file?");
    const summary = wrapper.get(".kk-browse-delete-summary").text();
    expect(summary).toContain("maven-hosted");
    expect(summary).toContain(fileEntry.path);

    await wrapper.get(".micl-dialog__actions .micl-button-filled-s").trigger("click");
    await flushPromises();

    expect(mocks.deleteBrowseEntry).toHaveBeenCalledWith("maven-hosted", fileEntry);
    expect(wrapper.emitted("deleted")).toEqual([[fileEntry.path]]);
    wrapper.unmount();
  });

  it("uses the component wording for a non-leaf asset entry", async () => {
    const wrapper = await mountDialog(componentEntry);

    expect(wrapper.get("#kk-dialog-title").text()).toBe("Delete component?");
    await wrapper.get(".micl-dialog__actions .micl-button-filled-s").trigger("click");
    await flushPromises();

    expect(mocks.deleteBrowseEntry).toHaveBeenCalledWith("maven-hosted", componentEntry);
    expect(wrapper.emitted("deleted")).toEqual([[componentEntry.path]]);
    wrapper.unmount();
  });

  it("shows the failure and keeps the dialog open instead of reporting success", async () => {
    mocks.deleteBrowseEntry.mockRejectedValueOnce(new Error("Delete failed: storage unavailable"));
    const wrapper = await mountDialog(fileEntry);

    await wrapper.get(".micl-dialog__actions .micl-button-filled-s").trigger("click");
    await flushPromises();

    expect(wrapper.get(".kk-form-error").text()).toContain("Delete failed: storage unavailable");
    expect(wrapper.emitted("deleted")).toBeFalsy();
    wrapper.unmount();
  });
});

describe("BrowseDeleteDialog directory mode", () => {
  beforeEach(() => {
    mocks.canDeleteBrowseDirectory.mockReturnValue(true);
  });

  it("loads the preview before rendering the confirmed directory deletion", async () => {
    const wrapper = await mountDialog(componentEntry);

    expect(mocks.previewDirectoryDeletion).toHaveBeenCalledWith("maven-hosted", componentEntry.path);
    expect(wrapper.get("#kk-browse-delete-directory-title").text()).toBe("Delete directory contents?");
    const summary = wrapper.get(".kk-browse-delete-summary").text();
    expect(summary).toMatch(/2\s+files/);
    expect(summary).toMatch(/1\s+component/);
    expect(summary).toContain("4.0 KiB");
    expect(wrapper.get(".kk-browse-delete-warning").text()).toContain("Deletion is permanent");
    expect(wrapper.get(".kk-browse-delete-paths").text()).toContain("(protocol metadata)");
    wrapper.unmount();
  });

  it("enables the destructive button only when the exact path is typed", async () => {
    const wrapper = await mountDialog(componentEntry);
    const confirmButton = wrapper.get(".micl-dialog__actions .micl-button-filled-s");

    expect(confirmButton.attributes("disabled")).toBeDefined();

    const input = wrapper.get(".kk-browse-delete-confirm");
    await input.setValue("com/acme/demo");
    expect(confirmButton.attributes("disabled")).toBeDefined();

    await input.setValue(componentEntry.path);
    expect(confirmButton.attributes("disabled")).toBeUndefined();

    await confirmButton.trigger("click");
    await flushPromises();

    expect(mocks.confirmDirectoryDeletion).toHaveBeenCalledWith(
      "maven-hosted",
      componentEntry.path,
      componentEntry.path,
      "token-1",
    );
    expect(wrapper.emitted("deleted")).toEqual([[componentEntry.path]]);
    wrapper.unmount();
  });

  it("shows a preview failure and re-previews when Review again is used", async () => {
    mocks.previewDirectoryDeletion.mockRejectedValueOnce(new Error("Preview unavailable"));
    const wrapper = await mountDialog(componentEntry);

    expect(wrapper.get(".kk-form-error").text()).toContain("Preview unavailable");
    expect(wrapper.find(".kk-browse-delete-confirm").exists()).toBe(false);
    expect(wrapper.find(".kk-browse-delete-summary").exists()).toBe(false);

    mocks.previewDirectoryDeletion.mockResolvedValueOnce(previewFixture);
    await wrapper.get(".kk-browse-delete-review").trigger("click");
    await flushPromises();

    expect(mocks.previewDirectoryDeletion).toHaveBeenCalledTimes(2);
    expect(wrapper.find(".kk-browse-delete-summary").exists()).toBe(true);
    expect(wrapper.find(".kk-form-error").exists()).toBe(false);
    wrapper.unmount();
  });

  it("invalidates the reviewed selection after a failed confirmation", async () => {
    mocks.confirmDirectoryDeletion.mockRejectedValueOnce(new Error("Selection changed"));
    const wrapper = await mountDialog(componentEntry);

    await wrapper.get(".kk-browse-delete-confirm").setValue(componentEntry.path);
    await wrapper.get(".micl-dialog__actions .micl-button-filled-s").trigger("click");
    await flushPromises();

    expect(wrapper.get(".kk-form-error").text()).toContain("Selection changed");
    expect(wrapper.find(".kk-browse-delete-review").exists()).toBe(true);
    expect(wrapper.emitted("deleted")).toBeFalsy();
    wrapper.unmount();
  });
});
