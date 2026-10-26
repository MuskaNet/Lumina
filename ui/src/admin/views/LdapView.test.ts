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

import LdapView from "./LdapView.vue";

describe("LdapView", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.send.mockReset();
    toastMock.mockReset();

    mocks.get.mockResolvedValue({
      enabled: true,
      priority: 10,
      name: "LDAP",
      source: "LDAP",
      url: "ldap://localhost:389",
      protocol: "ldap",
      host: "localhost",
      port: 389,
      useTrustStore: false,
      searchBase: "dc=example,dc=org",
      connectionTimeout: 30,
      connectionRetryDelay: 5,
      maxIncidentsCount: 3,
      authScheme: "simple",
      authRealm: "default",
      authUsername: "cn=admin,dc=example,dc=org",
      userBaseDn: "ou=users,dc=example,dc=org",
      userSubtree: true,
      userObjectClass: "inetOrgPerson",
      userLdapFilter: "(uid={0})",
      userIdAttribute: "uid",
    });
    mocks.send.mockResolvedValue({});
  });

  it("loads and renders 4 surface cards with structured grids", async () => {
    const wrapper = mount(LdapView);
    await flushPromises();

    expect(mocks.get).toHaveBeenCalledWith("/internal/security/ldap");

    // Action bar with pill buttons
    const primaryBtn = wrapper.find(".kk-btn-pill-primary");
    const secondaryBtn = wrapper.find(".kk-btn-pill-secondary");
    expect(primaryBtn.exists()).toBe(true);
    expect(secondaryBtn.exists()).toBe(true);
    expect(primaryBtn.text()).toContain("Save LDAP settings");

    // 4 Surface container cards
    const cards = wrapper.findAll(".kk-surface-card");
    expect(cards.length).toBe(4);

    // Card 1: Basic settings
    const card1 = cards[0];
    expect(card1.find(".kk-card-header").text()).toContain("Basic settings");
    expect(card1.find('input.micl-switch[role="switch"]').exists()).toBe(true);
    expect(card1.find(".kk-grid-3").exists()).toBe(true);

    // Card 2: Connection settings
    const card2 = cards[1];
    expect(card2.find(".kk-card-header").text()).toContain("Connection settings");
    expect(card2.find("#ldap-url").classes()).not.toContain("kk-grid-3"); // 100% full-width
    expect(card2.findAll(".kk-grid-3").length).toBe(2); // (protocol/host/port) and (timeout/retry/incidents)
    expect(card2.find("#ldap-search-base").exists()).toBe(true);
    expect(card2.find('input.micl-switch[role="switch"]').exists()).toBe(true);

    // Card 3: Authentication settings
    const card3 = cards[2];
    expect(card3.find(".kk-card-header").text()).toContain("Authentication settings");
    expect(card3.find("#ldap-auth-scheme").exists()).toBe(true);
    expect(card3.find(".kk-grid-3").exists()).toBe(true);
    expect(card3.find("#ldap-auth-password").exists()).toBe(true);

    // Card 4: User mapping
    const card4 = cards[3];
    expect(card4.find(".kk-card-header").text()).toContain("User mapping");
    expect(card4.find("#ldap-user-base-dn").exists()).toBe(true);
    expect(card4.find('input.micl-switch[role="switch"]').exists()).toBe(true);
    expect(card4.find(".kk-grid-3").exists()).toBe(true);
    expect(card4.find("#ldap-user-id-attr").exists()).toBe(true);
  });

  it("keeps advanced user and group mappings editable and saves them", async () => {
    const wrapper = mount(LdapView);
    await flushPromises();

    await wrapper.get("#field-userEmailAddressAttribute").setValue("mail");
    await wrapper.get("#field-groupBaseDn").setValue("ou=groups,dc=example,dc=org");
    await wrapper.get("#field-groupMemberAttribute").setValue("member");
    await wrapper.get(".kk-btn-pill-primary").trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith("/internal/security/ldap", "PUT", expect.objectContaining({
      userEmailAddressAttribute: "mail",
      groupBaseDn: "ou=groups,dc=example,dc=org",
      groupMemberAttribute: "member",
    }));
  });

  it("validates url and host when enabled", async () => {
    const wrapper = mount(LdapView);
    await flushPromises();

    await wrapper.find<HTMLInputElement>("#ldap-url").setValue("");

    const saveBtn = wrapper.find(".kk-btn-pill-primary");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("URL and host are required when LDAP is enabled.", "error");
  });

  it("saves updated LDAP configuration", async () => {
    const wrapper = mount(LdapView);
    await flushPromises();

    await wrapper.find<HTMLInputElement>("#ldap-host").setValue("ldap.example.com");

    const saveBtn = wrapper.find(".kk-btn-pill-primary");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith(
      "/internal/security/ldap",
      "PUT",
      expect.objectContaining({
        host: "ldap.example.com",
        protocol: "ldap",
      }),
    );
    expect(toastMock).toHaveBeenCalledWith("LDAP settings saved.", "ok");
  });
});
