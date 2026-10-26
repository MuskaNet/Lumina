import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("../../shared/snackbar", () => notifications);
import WelcomeView from "./WelcomeView.vue";

const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
  else delete (document as unknown as { execCommand?: unknown }).execCommand;
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

function legacyClipboard(success: boolean) {
  const copy = vi.fn(() => {
    expect(document.querySelector("textarea")?.value).toBe(`${location.origin}/repository/raw%20hosted/`);
    return success;
  });
  Object.defineProperty(document, "execCommand", { configurable: true, value: copy });
  return copy;
}

describe("Welcome repository copying", () => {
  it("copies the encoded URL and confirms through the Snackbar", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await copyRepository();
    expect(write).toHaveBeenCalledWith(`${location.origin}/repository/raw%20hosted/`);
    expect(notifications.showToast).toHaveBeenCalledWith("Copied", "ok");
  });

  it("copies on plain HTTP without the Clipboard API", async () => {
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue(undefined as unknown as Clipboard);
    const copy = legacyClipboard(true);
    await copyRepository();
    expect(copy).toHaveBeenCalledWith("copy");
    expect(notifications.showToast).toHaveBeenCalledWith("Copied", "ok");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when Clipboard API permission is denied", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    const copy = legacyClipboard(true);
    await copyRepository();
    expect(copy).toHaveBeenCalledWith("copy");
    expect(notifications.showToast).toHaveBeenCalledWith("Copied", "ok");
  });

  it("reports actual failure rather than displaying the URL as a success", async () => {
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue(undefined as unknown as Clipboard);
    legacyClipboard(false);
    await copyRepository();
    expect(notifications.showToast).toHaveBeenCalledExactlyOnceWith("Unable to copy repository URL", "error");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
