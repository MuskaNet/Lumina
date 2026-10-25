import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import { route, type BrowseRoute } from "./route";

const REPOSITORIES = [{ name: "maven-hosted", format: "maven2", type: "hosted", online: true }];

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

/** Mocks the Spring endpoints; returns the requested URLs so tests can assert the API surface. */
function stubApi(session: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      urls.push(url);

      if (url.startsWith("/internal/repositories/uploadable")) return jsonResponse(REPOSITORIES);
      if (url.startsWith("/internal/repositories")) return jsonResponse(REPOSITORIES);
      if (url.startsWith("/internal/security/context")) {
        return jsonResponse({
          bootstrap: { required: false, minPasswordLength: 8, anonymousAccessEnabled: true },
          session,
          permissions: [],
        });
      }
      if (url.startsWith("/internal/security/login/options")) return jsonResponse({ oidcEnabled: false });
      if (url.startsWith("/internal/security/login")) return jsonResponse({});
      if (url.startsWith("/internal/browse/")) return jsonResponse({ entries: [] });
      if (url.startsWith("/internal/search/components")) return jsonResponse([]);
      if (url.startsWith("/internal/security/api-keys/current")) return jsonResponse([]);
      if (url.startsWith("/service/rest/v1/formats/upload-specs")) return jsonResponse([]);
      return jsonResponse({});
    }),
  );
  return urls;
}

let wrapper: VueWrapper | null = null;

async function renderApp(options: { search?: string; session?: unknown } = {}): Promise<string[]> {
  const query = options.search ? `?${options.search}` : "";
  window.history.replaceState({}, "", `/browse/${query}#browse/welcome`);
  const urls = stubApi(options.session === undefined ? { userId: "admin", source: "local" } : options.session);
  wrapper = mount(App);
  await flushPromises();
  return urls;
}

function setView(patch: Partial<BrowseRoute>): void {
  route.value = { view: "welcome", repo: "", path: "", query: new URLSearchParams(), ...patch };
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe("browse application", () => {
  it("renders the welcome view from the server repository catalog", async () => {
    const urls = await renderApp();

    expect(wrapper!.text()).toContain("Browse repositories");
    expect(urls).toContain("/internal/repositories");
  });

  it("renders the browse view for the legacy repository route", async () => {
    const urls = await renderApp();

    setView({ view: "browse", repo: "maven-hosted" });
    await nextTick();
    await flushPromises();

    expect(wrapper!.text()).toContain("/repository/maven-hosted/");
    expect(urls.some((url) => url.startsWith("/internal/browse/maven-hosted"))).toBe(true);
  });

  it("renders the search view and queries the component search endpoint", async () => {
    const urls = await renderApp();

    setView({ view: "search", query: new URLSearchParams("q=log4j") });
    await nextTick();
    await flushPromises();

    expect(wrapper!.text()).toContain("Search components");
    expect(urls).toContain("/internal/search/components?limit=50&q=log4j");
  });

  it("renders the upload view with the server upload specification", async () => {
    const urls = await renderApp();

    setView({ view: "upload" });
    await nextTick();
    await flushPromises();

    expect(wrapper!.text()).toContain("Upload a component");
    expect(urls).toContain("/internal/repositories/uploadable");
    expect(urls).toContain("/service/rest/v1/formats/upload-specs");
  });

  it("renders the token view for the current user", async () => {
    const urls = await renderApp();

    setView({ view: "my-token" });
    await nextTick();
    await flushPromises();

    expect(wrapper!.text()).toContain("Create token");
    expect(urls).toContain("/internal/security/api-keys/current");
  });

  it("opens the login dialog for ?login=1", async () => {
    const urls = await renderApp({ search: "login=1" });

    expect(urls).toContain("/internal/security/login/options");
    expect(wrapper!.find(".kk-dialog--login").exists()).toBe(true);
  });

  it("keeps the login dialog closed for an authenticated session", async () => {
    const urls = await renderApp();

    expect(urls).not.toContain("/internal/security/login/options");
  });
});
