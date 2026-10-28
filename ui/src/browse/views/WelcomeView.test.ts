import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("../../shared/snackbar", () => notifications);
import WelcomeView from "./WelcomeView.vue";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function copyRepository() {
  const wrapper = mount(WelcomeView, {
    props: { repositories: [{ name: "raw hosted", format: "raw", type: "hosted", online: true }] },
  });
  await wrapper.get(".kk-repo-card__url").trigger("click");
  await flushPromises();
  expect(wrapper.emitted("open")).toBeUndefined();
  wrapper.unmount();
}

describe("Welcome repository copying", () => {
  it("copies the encoded URL and confirms through the Snackbar", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await copyRepository();
    expect(write).toHaveBeenCalledWith(`${location.origin}/repository/raw%20hosted/`);
    expect(notifications.showToast).toHaveBeenCalledWith("Copied", "ok");
  });

  it("reports a clipboard failure through the Snackbar", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    await copyRepository();
    expect(notifications.showToast).toHaveBeenCalledExactlyOnceWith("Unable to copy repository URL", "error");
  });
});
