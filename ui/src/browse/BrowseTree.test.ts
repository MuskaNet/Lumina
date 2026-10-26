import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchBrowseChildren: vi.fn() }));
vi.mock("./browseApi", () => ({ fetchBrowseChildren: mocks.fetchBrowseChildren }));

import BrowseTree from "./BrowseTree.vue";
import type { BrowseEntry } from "./browseModel";

function entry(name: string, path: string, leaf: boolean): BrowseEntry {
  return { name, path, leaf };
}

const ROOT = [entry("org", "org", false), entry("readme.txt", "readme.txt", true)];
const ORG = [entry("app", "org/app", false)];
const APP = [entry("a.jar", "org/app/a.jar", true)];

function respond(path: string): BrowseEntry[] {
  if (path === "") return ROOT;
  if (path === "org") return ORG;
  if (path === "org/app") return APP;
  return [];
}

function rowLabels(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll(".kk-tree-row .kk-tree-label").map((label) => label.text());
}

async function mountTree(selectedPath = "") {
  mocks.fetchBrowseChildren.mockImplementation((_repo: string, path: string) => Promise.resolve(respond(path)));
  const wrapper = mount(BrowseTree, {
    props: { repository: "repo", source: "", format: "raw", selectedPath },
  });
  await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("BrowseTree", () => {
  beforeEach(() => {
    mocks.fetchBrowseChildren.mockReset();
  });

  it("renders the root level and expands folders lazily", async () => {
    const wrapper = await mountTree();

    let rows = wrapper.findAll(".kk-tree-row");
    expect(rows).toHaveLength(2);
    expect(mocks.fetchBrowseChildren).toHaveBeenCalledWith("repo", "", "");

    await rows[0].find(".kk-tree-toggle").trigger("click");
    await flushPromises();

    rows = wrapper.findAll(".kk-tree-row");
    expect(rows).toHaveLength(3);
    expect(rowLabels(wrapper)).toEqual(["org", "app", "readme.txt"]);
    expect(mocks.fetchBrowseChildren).toHaveBeenCalledWith("repo", "org", "");

    await rows[1].find(".kk-tree-label").trigger("click");
    await flushPromises();
    expect(rowLabels(wrapper)).toEqual(["org", "app", "a.jar", "readme.txt"]);
  });

  it("collapses an expanded folder without dropping its children", async () => {
    const wrapper = await mountTree();
    const toggle = wrapper.findAll(".kk-tree-row")[0].find(".kk-tree-toggle");
    await toggle.trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".kk-tree-row")).toHaveLength(3);

    await toggle.trigger("click");
    expect(wrapper.findAll(".kk-tree-row")).toHaveLength(2);
    expect(mocks.fetchBrowseChildren.mock.calls.filter((call) => call[1] === "org")).toHaveLength(1);
  });

  it("emits select for files and folders", async () => {
    const wrapper = await mountTree();

    await wrapper.findAll(".kk-tree-row")[1].find(".kk-tree-label").trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual([ROOT[1]]);

    await wrapper.findAll(".kk-tree-row")[0].find(".kk-tree-label").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("select")?.[1]).toEqual([ROOT[0]]);
  });

  it("expands to a deep link path and returns the matching entry", async () => {
    const wrapper = await mountTree();

    const found = await (wrapper.vm as unknown as {
      expandTo: (path: string) => Promise<BrowseEntry | null>;
    }).expandTo("org/app/a.jar");
    await flushPromises();

    expect(found?.path).toBe("org/app/a.jar");
    expect(rowLabels(wrapper)).toEqual(["org", "app", "a.jar", "readme.txt"]);
    expect(mocks.fetchBrowseChildren.mock.calls.map((call) => call[1])).toEqual([
      "",
      "org",
      "org/app",
    ]);
  });

  it("marks the selected row from the route", async () => {
    const wrapper = await mountTree("readme.txt");

    const selected = wrapper.findAll(".kk-tree-row").filter((row) => row.classes("is-selected"));
    expect(selected).toHaveLength(1);
    expect(selected[0].find(".kk-tree-label").text()).toBe("readme.txt");
    expect(selected[0].attributes("aria-selected")).toBe("true");
  });

  it("shows the empty state and surfaces load failures with a retry", async () => {
    mocks.fetchBrowseChildren.mockResolvedValueOnce([]);
    const wrapper = mount(BrowseTree, { props: { repository: "empty", format: "raw" } });
    await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
    await flushPromises();
    expect(wrapper.text()).toContain("(empty)");
  });

  it("renders a retry action when the root level fails", async () => {
    mocks.fetchBrowseChildren.mockRejectedValueOnce(new Error("boom"));
    const wrapper = mount(BrowseTree, { props: { repository: "repo", format: "raw" } });
    await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
    await flushPromises();

    expect(wrapper.text()).toContain("boom");
    const retry = wrapper.findAll("button").find((button) => button.text() === "Retry");
    expect(retry).toBeDefined();

    mocks.fetchBrowseChildren.mockResolvedValueOnce(ROOT);
    await retry!.trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".kk-tree-row")).toHaveLength(2);
  });
});
