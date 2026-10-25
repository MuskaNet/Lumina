import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import RepositoryRecipeCombobox from "./RepositoryRecipeCombobox.vue";
import { buildRecipeOptions } from "../repositoryRecipes";

const options = buildRecipeOptions([
  { name: "maven2-hosted", format: "maven2", type: "HOSTED" },
  { name: "maven2-proxy", format: "maven2", type: "PROXY" },
  { name: "maven2-group", format: "maven2", type: "GROUP" },
  { name: "docker-proxy", format: "docker", type: "PROXY" },
]);

function mountCombobox(modelValue = "maven2-hosted", extra: Record<string, unknown> = {}) {
  return mount(RepositoryRecipeCombobox, {
    props: { options, modelValue, ...extra },
  });
}

async function openCombobox(wrapper: ReturnType<typeof mountCombobox>) {
  await wrapper.find(".kk-recipe-trigger").trigger("click");
  await flushPromises();
}

describe("RepositoryRecipeCombobox", () => {
  it("shows the selected recipe with its brand logo and type badge", () => {
    const wrapper = mountCombobox();
    const trigger = wrapper.find(".kk-recipe-trigger");

    expect(trigger.attributes("role")).toBe("combobox");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find(".kk-recipe-selection .format-logo-maven").exists()).toBe(true);
    expect(wrapper.find(".kk-recipe-name").text()).toBe("Maven");
    expect(wrapper.find(".kk-recipe-type").text()).toBe("Hosted");
    expect(wrapper.find(".kk-recipe-popover").exists()).toBe(false);
  });

  it("lists every recipe with its logo and type badge", async () => {
    const wrapper = mountCombobox();
    await openCombobox(wrapper);

    expect(wrapper.find(".kk-recipe-popover").exists()).toBe(true);
    const rows = wrapper.findAll(".kk-recipe-options .micl-list-item-one");
    expect(rows).toHaveLength(options.length);
    expect(rows[0]!.find(".format-logo-maven").exists()).toBe(true);
    expect(rows[3]!.find(".format-logo-docker").exists()).toBe(true);
    expect(rows[2]!.text()).toContain("Group");
    expect(rows[3]!.text()).toContain("Docker / OCI");
  });

  it("filters recipes by format and type", async () => {
    const wrapper = mountCombobox();
    await openCombobox(wrapper);
    const search = wrapper.find(".kk-recipe-search input");

    await search.setValue("docker");
    await flushPromises();
    let rows = wrapper.findAll(".kk-recipe-options .micl-list-item-one");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain("Docker / OCI");

    await search.setValue("group");
    await flushPromises();
    rows = wrapper.findAll(".kk-recipe-options .micl-list-item-one");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain("Maven");
    expect(rows[0]!.text()).toContain("Group");

    await search.setValue("zzz");
    await flushPromises();
    expect(wrapper.find(".kk-recipe-empty").text()).toBe("No matching recipes");
  });

  it("emits the chosen recipe and closes the popover", async () => {
    const wrapper = mountCombobox();
    await openCombobox(wrapper);

    await wrapper.find('[data-recipe-value="docker-proxy"]').trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update:modelValue")).toEqual([["docker-proxy"]]);
    expect(wrapper.find(".kk-recipe-popover").exists()).toBe(false);
  });

  it("supports keyboard navigation in the filtered list", async () => {
    const wrapper = mountCombobox();
    await openCombobox(wrapper);
    const search = wrapper.find(".kk-recipe-search input");

    await search.trigger("keydown", { key: "ArrowDown" });
    await search.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.emitted("update:modelValue")).toEqual([["maven2-proxy"]]);
  });

  it("is disabled while editing and when no recipes are available", async () => {
    const disabled = mountCombobox("maven2-hosted", { disabled: true });
    expect(disabled.find(".kk-recipe-trigger").attributes("disabled")).toBeDefined();
    await disabled.find(".kk-recipe-trigger").trigger("click");
    expect(disabled.find(".kk-recipe-popover").exists()).toBe(false);

    const empty = mount(RepositoryRecipeCombobox, {
      props: { options: [], modelValue: "" },
    });
    expect(empty.find(".kk-recipe-trigger").attributes("disabled")).toBeDefined();
    expect(empty.text()).toContain("No recipes available");
  });
});
