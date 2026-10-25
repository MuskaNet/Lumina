import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import CleanupRepositoryPicker from "./CleanupRepositoryPicker.vue";

const repositories = [
  { id: 1, name: "maven-hosted", format: "maven2", type: "HOSTED", online: true },
  { id: 2, name: "maven-proxy", format: "maven2", type: "PROXY", online: false },
  { id: 3, name: "maven-group", format: "maven2", type: "GROUP", online: true },
  { id: 4, name: "maven-central", format: "maven2", type: "PROXY", online: true },
  { id: 5, name: "npm-hosted", format: "npm", type: "HOSTED", online: true },
];

function mountPicker(modelValue: number[] = [], format = "maven2") {
  return mount(CleanupRepositoryPicker, {
    props: { repositories, format, modelValue },
  });
}

async function openPicker(wrapper: ReturnType<typeof mountPicker>) {
  await wrapper.find(".kk-cleanup-repo-trigger").trigger("click");
  await flushPromises();
}

describe("CleanupRepositoryPicker", () => {
  it("only lists hosted/proxy repositories of the selected format", async () => {
    const wrapper = mountPicker();
    expect(wrapper.find(".kk-cleanup-repo-placeholder").text()).toContain("Maven");

    await openPicker(wrapper);
    const rows = wrapper.findAll(".kk-cleanup-repo-option");
    expect(rows).toHaveLength(3);
    const text = rows.map((row) => row.text());
    expect(text[0]).toContain("maven-central");
    expect(text.some((value) => value.includes("maven-group"))).toBe(false);
    expect(text.some((value) => value.includes("npm-hosted"))).toBe(false);
    expect(rows[0]!.find(".format-logo-maven").exists()).toBe(true);
    expect(wrapper.find(".kk-cleanup-repo-footer").text()).toBe("0 selected · 3 available");
  });

  it("toggles individual repositories", async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);

    // Candidates are name-sorted, so maven-central (id 4) is the first row.
    await wrapper.find(".kk-cleanup-repo-option input").setValue(true);
    expect(wrapper.emitted("update:modelValue")).toEqual([[[4]]]);
  });

  it("selects all visible repositories and clears the selection", async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);

    const buttons = wrapper.findAll(".kk-cleanup-repo-actions button");
    await buttons[0]!.trigger("click");
    const emitted = (wrapper.emitted("update:modelValue")?.at(-1)?.[0] as number[]) ?? [];
    expect([...emitted].sort((a, b) => a - b)).toEqual([1, 2, 4]);

    await wrapper.setProps({ modelValue: [1, 2] });
    await wrapper.findAll(".kk-cleanup-repo-actions button")[1]!.trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([[]]);
  });

  it("filters the list by name, type and online state", async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);
    const search = wrapper.find(".kk-cleanup-repo-search input");

    await search.setValue("proxy");
    await flushPromises();
    expect(wrapper.findAll(".kk-cleanup-repo-option")).toHaveLength(2);

    await search.setValue("offline");
    await flushPromises();
    const rows = wrapper.findAll(".kk-cleanup-repo-option");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain("maven-proxy");

    await search.setValue("zzz");
    await flushPromises();
    expect(wrapper.find(".kk-cleanup-repo-empty").text()).toContain("No repositories match");
  });

  it("shows selected repositories as chips and prunes them when the format changes", async () => {
    const wrapper = mountPicker([1, 2, 4]);
    const chips = wrapper.findAll(".kk-cleanup-repo-chip");
    expect(chips.map((chip) => chip.text())).toEqual(["maven-central", "maven-hosted"]);
    expect(wrapper.find(".kk-cleanup-repo-more").text()).toBe("+1 more");

    await wrapper.setProps({ format: "npm" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([[]]);
  });
});
