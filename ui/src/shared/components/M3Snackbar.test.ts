import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3Snackbar from "./M3Snackbar.vue";
import { showToast, dismissToast, snackbar } from "../snackbar";

describe("M3Snackbar", () => {
  it("renders snackbar with body and close button when message is set", async () => {
    // Mock popover API methods for happy-dom if needed
    HTMLElement.prototype.showPopover = HTMLElement.prototype.showPopover || (() => {});
    HTMLElement.prototype.hidePopover = HTMLElement.prototype.hidePopover || (() => {});

    const wrapper = mount(M3Snackbar);

    showToast("Repository saved.", "ok");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".micl-snackbar").exists()).toBe(true);
    expect(wrapper.classes()).toContain("kk-snackbar");
    expect(wrapper.classes()).toContain("kk-snackbar--ok");

    // The body contains leading icon and supporting text together
    const body = wrapper.find(".kk-snackbar__body");
    expect(body.exists()).toBe(true);
    expect(body.find(".kk-snackbar__icon").text()).toBe("check_circle");
    expect(body.find(".micl-snackbar__supporting-text").text()).toBe("Repository saved.");

    // Close button exists and can dismiss
    const closeBtn = wrapper.find(".kk-snackbar__close");
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger("click");
    expect(snackbar.value).toBeNull();
  });

  it("handles different tones correctly", async () => {
    const wrapper = mount(M3Snackbar);

    showToast("Operation failed", "error");
    await wrapper.vm.$nextTick();
    expect(wrapper.classes()).toContain("kk-snackbar--error");
    expect(wrapper.find(".kk-snackbar__icon").text()).toBe("error");

    showToast("Information note", "info");
    await wrapper.vm.$nextTick();
    expect(wrapper.classes()).toContain("kk-snackbar--info");
    expect(wrapper.find(".kk-snackbar__icon").text()).toBe("info");

    dismissToast();
  });
});
