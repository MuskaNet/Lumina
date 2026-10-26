import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../shared/api/client", () => ({
  api: mocks,
  ApiError: class ApiError extends Error {},
}));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("../../shared/snackbar", () => ({
  showToast: toastMock,
}));

import AnonymousView from "./AnonymousView.vue";

describe("AnonymousView", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.send.mockReset();
    toastMock.mockReset();

    mocks.get.mockResolvedValue({
      enabled: true,
      userSource: "Local",
      userId: "anonymous",
      realmName: "NexusAuthorizingRealm",
    });
    mocks.send.mockResolvedValue({
      enabled: true,
      userSource: "Local",
      userId: "anonymous",
      realmName: "NexusAuthorizingRealm",
    });
  });

  it("loads and displays anonymous settings inside a full-width surface card", async () => {
    const wrapper = mount(AnonymousView);
    await flushPromises();

    expect(mocks.get).toHaveBeenCalledWith("/internal/security/anonymous");

    // Action bar with pill buttons
    const primaryBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    const secondaryBtn = wrapper.find(".micl-button-tonal-s");
    expect(primaryBtn.exists()).toBe(true);
    expect(secondaryBtn.exists()).toBe(true);
    expect(primaryBtn.text()).toContain("Save");
    expect(secondaryBtn.text()).toContain("Reload");

    // Full-width layout container (no max-width constraints)
    const layout = wrapper.find(".kk-settings-layout");
    expect(layout.exists()).toBe(true);
    expect(wrapper.find(".kk-settings-layout--constrained").exists()).toBe(false);

    // Surface card and card header
    const card = wrapper.find(".kk-surface-card");
    expect(card.exists()).toBe(true);
    expect(card.find(".kk-card-header").exists()).toBe(true);
    expect(card.find(".material-symbols-outlined").text()).toContain("person_off");

    // Banner switch
    const banner = card.find(".kk-banner-switch");
    expect(banner.exists()).toBe(true);
    const switchInput = banner.find<HTMLInputElement>('input.micl-switch[role="switch"]');
    expect(switchInput.exists()).toBe(true);
    expect(switchInput.element.checked).toBe(true);

    // 3-column grid fields
    const grid = card.find(".kk-grid-3");
    expect(grid.exists()).toBe(true);

    const userInput = wrapper.find<HTMLInputElement>("#anon-user");
    const realmInput = wrapper.find<HTMLInputElement>("#anon-realm");
    const sourceInput = wrapper.find<HTMLInputElement>("#anon-source");

    expect(userInput.element.value).toBe("anonymous");
    expect(realmInput.element.value).toBe("NexusAuthorizingRealm");
    expect(sourceInput.element.value).toBe("Local");
  });

  it("saves updated settings", async () => {
    const wrapper = mount(AnonymousView);
    await flushPromises();

    const userInput = wrapper.find<HTMLInputElement>("#anon-user");
    await userInput.setValue("new-anon");

    const saveBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith(
      "/internal/security/anonymous",
      "PUT",
      expect.objectContaining({
        enabled: true,
        userId: "new-anon",
        realmName: "NexusAuthorizingRealm",
      }),
    );
    expect(toastMock).toHaveBeenCalledWith("Anonymous access saved.", "ok");
  });

  it("validates required fields when enabled", async () => {
    const wrapper = mount(AnonymousView);
    await flushPromises();

    const userInput = wrapper.find<HTMLInputElement>("#anon-user");
    await userInput.setValue("");

    const saveBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("User ID and realm name are required.", "error");
  });
});
