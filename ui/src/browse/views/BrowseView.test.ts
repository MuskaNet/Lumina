import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBrowseChildren: vi.fn(),
  fetchBrowseDetail: vi.fn(),
  usageDetailForEntry: vi.fn(),
  canDeleteEntry: vi.fn(),
  canDeleteBrowseDirectory: vi.fn(),
  deleteBrowseEntry: vi.fn(),
  previewDirectoryDeletion: vi.fn(),
  confirmDirectoryDeletion: vi.fn(),
  hasDirectoryUsage: vi.fn(),
  canDeleteBrowseComponentDirectory: vi.fn(),
}));

vi.mock("../browseApi", () => ({
  fetchBrowseChildren: mocks.fetchBrowseChildren,
  fetchBrowseDetail: mocks.fetchBrowseDetail,
}));
vi.mock("../usage", () => ({ usageDetailForEntry: mocks.usageDetailForEntry }));
vi.mock("../delete", () => ({
  canDeleteEntry: mocks.canDeleteEntry,
  canDeleteBrowseDirectory: mocks.canDeleteBrowseDirectory,
  canDeleteBrowseComponentDirectory: mocks.canDeleteBrowseComponentDirectory,
  deleteBrowseEntry: mocks.deleteBrowseEntry,
  previewDirectoryDeletion: mocks.previewDirectoryDeletion,
  confirmDirectoryDeletion: mocks.confirmDirectoryDeletion,
  hasDirectoryUsage: mocks.hasDirectoryUsage,
  hasBrowseDeletePermission: vi.fn(() => true),
}));

import BrowseView from "./BrowseView.vue";
import BrowseDeleteDialog from "../components/BrowseDeleteDialog.vue";
import { route } from "../route";
import type { BrowseEntry } from "../browseModel";

const REPOSITORY = { name: "raw", format: "raw", type: "hosted", url: "/repository/raw/" };

const ROOT: BrowseEntry[] = [
  { name: "org", path: "org", leaf: false },
  {
    name: "readme.txt",
    path: "readme.txt",
    leaf: true,
    downloadUrl: "/repository/raw/readme.txt",
  },
];
const ORG: BrowseEntry[] = [
  { name: "app.jar", path: "org/app.jar", leaf: true, downloadUrl: "/repository/raw/org/app.jar" },
];

const DETAIL = {
  repository: "raw",
  path: "org/app.jar",
  name: "app.jar",
  size: 1024,
  contentType: "application/java-archive",
  downloadUrl: "/repository/raw/org/app.jar",
  uploader: "admin",
  checksum: { sha1: "abc123" },
  content: { last_modified: "2026-10-24T07:47:01Z" },
  provenance: { hashes_not_verified: false },
};

const USAGE = {
  summaryRows: [{ label: "Repository", value: "raw" }],
  snippets: [{ displayName: "Apache Maven", snippetText: "<dependency />" }],
};

let wrapper: VueWrapper | null = null;

async function settle(): Promise<void> {
  await flushPromises();
  await nextTick();
  await flushPromises();
}

async function mountView(
  path = "",
  options: {
    repositories?: { name: string; format?: string; type?: string; url?: string }[];
    root?: BrowseEntry[];
  } = {},
): Promise<VueWrapper> {
  const root = options.root ?? ROOT;
  mocks.fetchBrowseChildren.mockImplementation((_repository: string, currentPath: string) => {
    if (currentPath === "") return Promise.resolve(root);
    if (currentPath === "org") return Promise.resolve(ORG);
    return Promise.resolve([]);
  });
  mocks.fetchBrowseDetail.mockResolvedValue(DETAIL);
  mocks.usageDetailForEntry.mockResolvedValue(USAGE);
  mocks.canDeleteEntry.mockReturnValue(true);
  mocks.canDeleteBrowseDirectory.mockReturnValue(false);

  wrapper = mount(BrowseView, {
    props: {
      repositories: options.repositories ?? [REPOSITORY],
      repo: "raw",
      path,
      source: "",
    },
    attachTo: document.body,
  });
  await settle();
  return wrapper;
}

function labels(view: VueWrapper): string[] {
  return view.findAll(".kk-tree-row .kk-tree-label").map((label) => label.text());
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/browse/#browse/welcome");
});

beforeEach(() => {
  route.value = { view: "browse", repo: "raw", path: "", query: new URLSearchParams() };
});

describe("BrowseView", () => {
  it.each([
    [null, 68],
    ["58", 65],
    ["90", 70],
    ["67", 67],
  ])("constrains stored tree width %s to %s percent", async (stored, expected) => {
    const key = "kkrepo.browse.treePaneWidthPct";
    const previous = localStorage.getItem(key);
    try {
      if (stored === null) localStorage.removeItem(key);
      else localStorage.setItem(key, stored);
      const view = await mountView();
      expect(view.get(".kk-browse-split").attributes("style")).toContain(`--kk-browse-tree-width: ${expected}%`);
      const resizer = view.get('[role="separator"]');
      expect(resizer.attributes("aria-valuemin")).toBe("65");
      expect(resizer.attributes("aria-valuemax")).toBe("70");
      for (let step = 0; step < 5; step++) await resizer.trigger("keydown", { key: "ArrowRight" });
      expect(resizer.attributes("aria-valuenow")).toBe("70");
      for (let step = 0; step < 5; step++) await resizer.trigger("keydown", { key: "ArrowLeft" });
      expect(resizer.attributes("aria-valuenow")).toBe("65");
      await resizer.trigger("keydown", { key: "Home" });
      expect(resizer.attributes("aria-valuenow")).toBe("68");
    } finally {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
  });

  it("renders the breadcrumb, tree and detail for a deep-linked file", async () => {
    const view = await mountView("org/app.jar");

    expect(view.find(".kk-browse-crumbs__repo").text()).toBe("raw");
    expect(view.find(".kk-browse-crumbs__format").exists()).toBe(true);
    expect(labels(view)).toEqual(["org", "app.jar", "readme.txt"]);

    expect(mocks.fetchBrowseDetail).toHaveBeenCalledWith("raw", "org/app.jar", "");
    expect(view.find(".kk-detail-head__path").text()).toBe("org/app.jar");
    expect(view.text()).toContain("Summary");
    expect(view.text()).toContain("Usage");
    expect(view.text()).toContain("Apache Maven");
    expect(view.find(".kk-browse-placeholder").exists()).toBe(false);

    expect(view.find(".kk-browse-bar__actions a").attributes("href")).toBe(
      "/service/rest/repository/browse/raw/",
    );
  });

  it("shows a centered loading state before the first tree level resolves", async () => {
    let resolveRoot: ((entries: BrowseEntry[]) => void) | null = null;
    mocks.fetchBrowseChildren.mockImplementation(
      () => new Promise<BrowseEntry[]>((resolve) => { resolveRoot = resolve; }),
    );
    mocks.fetchBrowseDetail.mockResolvedValue(DETAIL);
    mocks.usageDetailForEntry.mockResolvedValue(USAGE);
    mocks.canDeleteEntry.mockReturnValue(true);
    mocks.canDeleteBrowseDirectory.mockReturnValue(false);

    wrapper = mount(BrowseView, {
      props: { repositories: [REPOSITORY], repo: "raw", path: "", source: "" },
      attachTo: document.body,
    });
    await nextTick();
    await flushPromises();

    expect(wrapper.find(".kk-browse-split").isVisible()).toBe(false);
    expect(wrapper.find(".kk-empty-state").text()).toContain("Loading…");

    resolveRoot!(ROOT);
    await settle();

    expect(wrapper.find(".kk-empty-state").exists()).toBe(false);
    expect(wrapper.find(".kk-browse-split").isVisible()).toBe(true);
  });
  it("selects a file from the tree, loads its detail and updates the URL", async () => {
    const view = await mountView();

    expect(view.find(".kk-browse-placeholder").exists()).toBe(true);
    const fileRow = view.findAll(".kk-tree-row").find((row) => row.text().includes("readme.txt"));
    await fileRow!.find(".kk-tree-label").trigger("click");
    await settle();

    expect(mocks.fetchBrowseDetail).toHaveBeenCalledWith("raw", "readme.txt", "");
    expect(window.location.hash).toBe("#browse/browse:raw:readme.txt");
    expect(route.value.path).toBe("readme.txt");
    expect(view.find(".kk-detail-head__path").text()).toBe("readme.txt");
  });

  it("shows the not-found view for a deep link that no longer exists", async () => {
    const view = await mountView("org/missing.bin");

    expect(view.text()).toContain("Path not found");
    expect(view.find(".kk-browse-placeholder").exists()).toBe(false);
    expect(view.find(".kk-empty-state a.micl-button-text-s").attributes("href")).toBe("#browse/browse:raw");
  });

  it("shows the empty-repository state instead of the split layout", async () => {
    const view = await mountView("", { root: [] });

    expect(view.text()).toContain("This repository is empty.");
    expect(view.find(".kk-browse-split").isVisible()).toBe(false);
    expect(view.find(".kk-empty-state a.micl-button-text-s").attributes("href")).toBe("#browse/browse");
  });

  it("shows the not-found view when the repository is missing from the catalog", async () => {
    const view = await mountView("", {
      repositories: [{ name: "other", format: "raw", type: "hosted" }],
    });

    expect(view.text()).toContain("Repository not found");
    expect(view.find(".kk-browse-split").isVisible()).toBe(false);
    expect(mocks.fetchBrowseChildren).not.toHaveBeenCalled();
  });

  it("links to the HTML view and opens the format search", async () => {
    const view = await mountView();

    const actions = view.findAll(".kk-browse-bar__actions button");
    await actions[0].trigger("click");
    await settle();

    expect(window.location.hash).toContain("#browse/search");
    expect(window.location.hash).toContain("format=raw");
  });

  it("refreshes the tree and keeps the selection after a successful delete", async () => {
    const view = await mountView("org/app.jar");
    const rootCalls = mocks.fetchBrowseChildren.mock.calls.filter((call) => call[1] === "").length;

    view.findComponent(BrowseDeleteDialog).vm.$emit("deleted", "org/app.jar");
    await settle();

    const refreshedRootCalls = mocks.fetchBrowseChildren.mock.calls.filter(
      (call) => call[1] === "",
    ).length;
    expect(refreshedRootCalls).toBeGreaterThan(rootCalls);
    expect(mocks.fetchBrowseDetail.mock.calls.length).toBeGreaterThan(1);
    expect(view.find(".kk-detail-head__path").text()).toBe("org/app.jar");
  });

  it("offers the delete action when the user may delete the selected entry", async () => {
    const view = await mountView("org/app.jar");

    expect(view.find(".kk-detail-head__delete").exists()).toBe(true);
  });
});
