import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: { get: vi.fn(), getOrNull: vi.fn(), send: vi.fn(), delete: vi.fn() },
  };
});

import LoginDialog from "./LoginDialog.vue";
import { api } from "../api/client";

const get = vi.mocked(api.get);
const getOrNull = vi.mocked(api.getOrNull);
const send = vi.mocked(api.send);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/browse/?login=1#browse/welcome");
  getOrNull.mockResolvedValue(null);
  get.mockResolvedValue({ ldapEnabled: true, oidcEnabled: true });
  send.mockResolvedValue({ returnTo: "/browse/?login=1#browse/welcome" });
});

async function openDialog() {
  const wrapper = mount(LoginDialog, { props: { open: true } });
  await flushPromises();
  return wrapper;
}

describe("login dialog", () => {
  it("renders the heading without an icon or reserved icon space", async () => {
    const wrapper = await openDialog();

    expect(wrapper.find("dialog").classes()).not.toContain("has-icon");
    expect(wrapper.find(".micl-dialog__icon").exists()).toBe(false);
    expect(wrapper.find("#kk-login-title").text()).toBe("Sign in");
    expect(wrapper.find(".micl-dialog__supporting-text").text()).toBe(
      "Sign in to browse or manage this repository.",
    );
  });

  it("loads the server login options", async () => {
    const wrapper = await openDialog();

    expect(get).toHaveBeenCalledWith("/internal/security/login/options");
    expect(wrapper.text()).toContain("Local / LDAP");
    expect(wrapper.text()).toContain("OIDC");
  });

  it("posts the legacy password login and closes after a success", async () => {
    const wrapper = await openDialog();

    await wrapper.find("#kk-login-username").setValue("admin");
    await wrapper.find("#kk-login-password").setValue("secret");
    await wrapper.find("#kk-login-form").trigger("submit");
    await flushPromises();

    expect(send).toHaveBeenCalledWith("/internal/security/login", "POST", {
      username: "admin",
      password: "secret",
      returnTo: "/browse/?login=1#browse/welcome",
    });
    expect(wrapper.emitted("signedIn")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows the legacy message when the credentials are rejected", async () => {
    send.mockRejectedValueOnce(new ApiError(401, "Authentication required."));
    const wrapper = await openDialog();

    await wrapper.find("#kk-login-username").setValue("admin");
    await wrapper.find("#kk-login-password").setValue("wrong");
    await wrapper.find("#kk-login-form").trigger("submit");
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe("Invalid username or password.");
  });

  it("redirects to the OIDC login endpoint", async () => {
    const wrapper = await openDialog();
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});

    await wrapper.findAll('[role="tab"]')[1].trigger("click");
    const oidcButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Continue with OIDC"));
    expect(oidcButton).toBeTruthy();

    await oidcButton!.trigger("click");

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toBe(
      "/internal/security/oidc/login?returnTo=%2Fbrowse%2F%3Flogin%3D1%23browse%2Fwelcome",
    );
  });
});
