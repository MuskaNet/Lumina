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

import OidcView from "./OidcView.vue";

describe("OidcView", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.send.mockReset();
    toastMock.mockReset();

    mocks.get.mockResolvedValue({
      enabled: true,
      priority: 20,
      name: "OIDC",
      source: "OIDC",
      issuer: "https://auth.example.com",
      issuerUri: "https://auth.example.com/.well-known/openid-configuration",
      jwksUri: "https://auth.example.com/jwks",
      audience: "kkrepo-client",
      authorizationEndpoint: "https://auth.example.com/oauth/authorize",
      tokenEndpoint: "https://auth.example.com/oauth/token",
      scopes: "openid profile email",
      clientId: "kkrepo-admin",
      clientSecret: "",
      redirectUri: "https://kkrepo.example.com/login/oauth2/code/oidc",
      userIdClaim: "sub",
      firstNameClaim: "given_name",
      lastNameClaim: "family_name",
      groupsClaim: "groups",
    });
    mocks.send.mockResolvedValue({});
  });

  it("loads and renders 4 surface cards with structured 2-column and 3-column grids", async () => {
    const wrapper = mount(OidcView);
    await flushPromises();

    expect(mocks.get).toHaveBeenCalledWith("/internal/security/oidc");

    // Action bar with pill buttons
    const primaryBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    const secondaryBtn = wrapper.find(".micl-button-tonal-s");
    expect(primaryBtn.exists()).toBe(true);
    expect(secondaryBtn.exists()).toBe(true);
    expect(primaryBtn.text()).toContain("Save OIDC settings");

    // 4 Surface container cards
    const cards = wrapper.findAll(".kk-surface-card");
    expect(cards.length).toBe(4);

    // Card 1: Basic settings
    const card1 = cards[0];
    expect(card1.find(".kk-card-header").text()).toContain("Basic settings");
    expect(card1.find('input.micl-switch[role="switch"]').exists()).toBe(true);
    expect(card1.find(".kk-grid-3").exists()).toBe(true);

    // Card 2: Provider settings
    const card2 = cards[1];
    expect(card2.find(".kk-card-header").text()).toContain("Provider settings");
    expect(card2.find("#oidc-issuer").exists()).toBe(true);
    // 2 grids of 2 columns
    expect(card2.findAll(".kk-grid-2").length).toBe(2);
    expect(card2.find("#oidc-token-endpoint").exists()).toBe(true);
    expect(card2.find("#oidc-scopes").exists()).toBe(true);

    // Card 3: Client settings
    const card3 = cards[2];
    expect(card3.find(".kk-card-header").text()).toContain("Client settings");
    expect(card3.find("#oidc-client-id").exists()).toBe(true);
    expect(card3.find("#oidc-client-secret").exists()).toBe(true);
    expect(card3.find("#oidc-redirect-uri").exists()).toBe(true);

    // Card 4: Claims mapping
    const card4 = cards[3];
    expect(card4.find(".kk-card-header").text()).toContain("Claims mapping");
    expect(card4.find("#oidc-user-id-claim").exists()).toBe(true);
    expect(card4.find(".kk-grid-3").exists()).toBe(true);
    expect(card4.find("#oidc-first-name-claim").exists()).toBe(true);
    expect(card4.find("#oidc-last-name-claim").exists()).toBe(true);
    expect(card4.find("#oidc-groups-claim").exists()).toBe(true);
  });

  it("keeps advanced claims and cache settings editable and saves them", async () => {
    const wrapper = mount(OidcView);
    await flushPromises();

    await wrapper.get("#field-emailClaim").setValue("email");
    await wrapper.get("#field-rolesClaim").setValue("roles");
    await wrapper.get("#field-clockSkewSeconds").setValue("60");
    await wrapper.get("#field-jwksCacheSeconds").setValue("300");
    await wrapper.get(".micl-button-filled-m.kk-primary-action").trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith("/internal/security/oidc", "PUT", expect.objectContaining({
      emailClaim: "email", rolesClaim: "roles", clockSkewSeconds: 60, jwksCacheSeconds: 300,
    }));
  });

  it("validates required fields (issuer, clientId, redirectUri)", async () => {
    const wrapper = mount(OidcView);
    await flushPromises();

    await wrapper.find<HTMLInputElement>("#oidc-issuer").setValue("");

    const saveBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("Required fields are missing: Issuer", "error");
  });

  it("saves updated OIDC configuration", async () => {
    const wrapper = mount(OidcView);
    await flushPromises();

    await wrapper.find<HTMLInputElement>("#oidc-client-id").setValue("new-client");

    const saveBtn = wrapper.find(".micl-button-filled-m.kk-primary-action");
    await saveBtn.trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith(
      "/internal/security/oidc",
      "PUT",
      expect.objectContaining({
        clientId: "new-client",
        issuer: "https://auth.example.com",
      }),
    );
    expect(toastMock).toHaveBeenCalledWith("OIDC settings saved.", "ok");
  });
});
