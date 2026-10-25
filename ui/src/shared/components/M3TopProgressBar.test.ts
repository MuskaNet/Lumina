import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3TopProgressBar from "./M3TopProgressBar.vue";
import { fail, finish, reset, set, start } from "../progress";

describe("M3TopProgressBar", () => {
  beforeEach(() => {
    reset();
  });

  it("is hidden when idle", () => {
    const wrapper = mount(M3TopProgressBar);
    expect(wrapper.find(".kk-top-progress-bar").exists()).toBe(false);
  });

  it("renders progress bar and indicator when started", async () => {
    const wrapper = mount(M3TopProgressBar);
    start();
    await wrapper.vm.$nextTick();

    const bar = wrapper.find(".kk-top-progress-bar");
    expect(bar.exists()).toBe(true);
    expect(bar.attributes("role")).toBe("progressbar");
    expect(bar.find(".kk-top-progress-bar__indicator").exists()).toBe(true);
  });

  it("reflects explicit progress value", async () => {
    const wrapper = mount(M3TopProgressBar);
    set(75);
    await wrapper.vm.$nextTick();

    const indicator = wrapper.find(".kk-top-progress-bar__indicator");
    expect(indicator.attributes("style")).toContain("inline-size: 75%");
  });

  it("adds is-finishing class on finish", async () => {
    const wrapper = mount(M3TopProgressBar);
    start();
    await wrapper.vm.$nextTick();

    finish();
    await wrapper.vm.$nextTick();

    const bar = wrapper.find(".kk-top-progress-bar");
    expect(bar.classes()).toContain("is-finishing");
  });

  it("adds is-error class on failure", async () => {
    const wrapper = mount(M3TopProgressBar);
    start();
    await wrapper.vm.$nextTick();

    fail();
    await wrapper.vm.$nextTick();

    const bar = wrapper.find(".kk-top-progress-bar");
    expect(bar.classes()).toContain("is-error");
  });
});
