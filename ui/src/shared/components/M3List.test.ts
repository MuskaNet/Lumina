import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3List from "./M3List.vue";
import M3ListItem from "./M3ListItem.vue";

describe("M3List and M3ListItem", () => {
  it("renders a standard MICL list", () => {
    const wrapper = mount(M3List, {
      props: {
        ariaLabel: "Test list",
      },
      slots: {
        default: `<li class="micl-list-item-one">Item 1</li>`,
      },
    });

    expect(wrapper.element.tagName).toBe("UL");
    expect(wrapper.classes()).toContain("micl-list");
    expect(wrapper.attributes("aria-label")).toBe("Test list");
    expect(wrapper.text()).toContain("Item 1");
  });

  it("renders segmented variant with micl-list--segmented class", () => {
    const wrapper = mount(M3List, {
      props: {
        segmented: true,
      },
    });

    expect(wrapper.classes()).toContain("micl-list");
    expect(wrapper.classes()).toContain("micl-list--segmented");
  });

  it("renders M3ListItem with one, two, or three lines", () => {
    const item1 = mount(M3ListItem, {
      props: {
        lines: 1,
        headline: "Single line headline",
      },
    });
    expect(item1.classes()).toContain("micl-list-item-one");
    expect(item1.find(".micl-list-item__headline").text()).toBe("Single line headline");

    const item2 = mount(M3ListItem, {
      props: {
        lines: 2,
        headline: "Two line headline",
        supportingText: "Supporting info",
      },
    });
    expect(item2.classes()).toContain("micl-list-item-two");
    expect(item2.find(".micl-list-item__supporting-text").text()).toBe("Supporting info");

    const item3 = mount(M3ListItem, {
      props: {
        lines: 3,
        headline: "Three line headline",
        supportingText: "Detailed explanation spanning multiple lines",
      },
    });
    expect(item3.classes()).toContain("micl-list-item-three");
  });

  it("renders leading icon and trailing text", () => {
    const wrapper = mount(M3ListItem, {
      props: {
        headline: "Repositories",
        leadingIcon: "inventory_2",
        trailingText: "100+",
      },
    });

    expect(wrapper.find(".micl-list-item__icon").text()).toBe("inventory_2");
    expect(wrapper.find(".micl-list-item__trailing-text").text()).toBe("100+");
  });

  it("emits click when clickable item is clicked", async () => {
    const wrapper = mount(M3ListItem, {
      props: {
        headline: "Clickable item",
        clickable: true,
      },
    });

    expect(wrapper.attributes("tabindex")).toBe("0");
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);

    await wrapper.trigger("keydown.enter");
    expect(wrapper.emitted("click")).toHaveLength(2);
  });

  it("does not emit click when disabled", async () => {
    const wrapper = mount(M3ListItem, {
      props: {
        headline: "Disabled item",
        clickable: true,
        disabled: true,
      },
    });

    expect(wrapper.classes()).toContain("micl-list-item--disabled");
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    expect(wrapper.attributes("aria-disabled")).toBe("true");

    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });
});
