import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MemberTransferPicker from "./MemberTransferPicker.vue";

function mountPicker(modelValue: string[] = []) {
  return mount(MemberTransferPicker, {
    props: {
      modelValue,
      options: [{ name: "alpha" }, { name: "beta" }, { name: "gamma" }],
      availableTitle: "Available Privileges",
      selectedTitle: "Selected Privileges",
      filterId: "test-transfer-filter",
    },
  });
}

describe("MemberTransferPicker", () => {
  it("shows the order index and both arrows for every selected member", () => {
    const wrapper = mountPicker(["beta", "gamma"]);

    const selectedPane = wrapper.findAll(".kk-member-pane")[1];
    const rows = selectedPane.findAll(".kk-member-list-item");

    expect(rows).toHaveLength(2);
    expect(rows[0].find(".kk-member-option__index").text()).toBe("1");
    expect(rows[1].find(".kk-member-option__index").text()).toBe("2");
    expect(rows[0].findAll(".kk-member-order")).toHaveLength(2);
    expect(rows[1].findAll(".kk-member-order")).toHaveLength(2);
  });

  it("reorders the selected list when an arrow is activated", async () => {
    const wrapper = mountPicker(["beta", "gamma"]);

    const secondRow = wrapper.findAll(".kk-member-pane")[1].findAll(".kk-member-list-item")[1];
    await secondRow.findAll(".kk-member-order")[0].trigger("click");

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([["gamma", "beta"]]);
  });

  it("centers an empty state with an icon when nothing is selected", () => {
    const wrapper = mountPicker([]);

    const empty = wrapper.findAll(".kk-member-empty");
    expect(empty).toHaveLength(1);
    expect(empty[0].find(".kk-member-empty__icon").exists()).toBe(true);
  });
});
