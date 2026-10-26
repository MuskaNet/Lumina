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

/** The dialog is always mounted; only its native `open` state tells whether it is showing. */
function loginDialogOpen(): boolean {
  const dialog = wrapper!.find(".kk-dialog--login");
  expect(dialog.exists()).toBe(true);
  return (dialog.element as HTMLDialogElement).open;
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

  it("exposes the repository catalog as a Browse destination", async () => {
    await renderApp();

    const rail = wrapper!.find('nav[aria-label="Repository browser"]');
    const browseLink = rail.find('a[href="#browse/browse"]');
    expect(browseLink.text()).toContain("Browse");

    setView({ view: "browse", repo: "" });
    await nextTick();
    await flushPromises();

    expect(browseLink.attributes("aria-current")).toBe("page");
    expect(wrapper!.text()).toContain("maven-hosted");
    expect(wrapper!.findAll("tbody tr")).toHaveLength(1);
  });

  it("opens the repository content tree from a catalog row", async () => {
    const urls = await renderApp();

    setView({ view: "browse", repo: "" });
    await nextTick();
    await flushPromises();

    // The catalog is rendered from the already-loaded repository list.
    expect(urls.some((url) => url.startsWith("/internal/browse/"))).toBe(false);

    await wrapper!.find("tbody tr").trigger("click");
    await flushPromises();

    expect(window.location.hash).toBe("#browse/browse:maven-hosted");
    expect(route.value.repo).toBe("maven-hosted");
    expect(urls.some((url) => url.startsWith("/internal/browse/maven-hosted"))).toBe(true);
  });

  it("places admin beside the account button and keeps token navigation in its menu", async () => {
    await renderApp();

    const rail = wrapper!.find('nav[aria-label="Repository browser"]');
    expect(rail.find('a[href="#browse/my-token"]').exists()).toBe(false);
    expect(rail.find('a[href^="/admin/"]').exists()).toBe(false);
    expect(rail.findAll("a").map((link) => link.text())).toEqual([
      "homeWelcome",
      "inventory_2Browse",
      "uploadUpload",
    ]);

    const toolbar = wrapper!.find('[role="toolbar"]');
    expect(toolbar.classes()).toContain("kk-bottom-toolbar--browse");
    expect(toolbar.find('[popovertarget="kk-browse-user-menu"]').exists()).toBe(true);

    const adminLink = toolbar.find('a[href="/admin/#admin/repository/repositories"]');
    expect(adminLink.attributes("aria-label")).toBe("Admin");
    expect(adminLink.element.nextElementSibling).toBe(
      toolbar.find('[popovertarget="kk-browse-user-menu"]').element,
    );

    const menu = wrapper!.find("#kk-browse-user-menu");
    expect(menu.find('a[href^="/admin/"]').exists()).toBe(false);
    const tokenItem = menu.findAll("li").find((item) => item.text().includes("My Token"));
    expect(tokenItem).toBeDefined();
    await tokenItem!.trigger("click");
    expect(window.location.hash).toBe("#browse/my-token");
  });

  it("retains sign-in access in the larger toolbar for anonymous visitors", async () => {
    await renderApp({ session: null });

    const toolbar = wrapper!.find(".kk-bottom-toolbar--browse");
    expect(toolbar.find(".kk-bottom-toolbar__account-btn").exists()).toBe(false);
    expect(toolbar.find(".kk-bottom-toolbar__admin-btn").exists()).toBe(false);
    await toolbar.find(".kk-bottom-toolbar__login-btn").trigger("click");
    await flushPromises();

    expect(loginDialogOpen()).toBe(true);
  });

  it("renders the browse view for the legacy repository route", async () => {
    const urls = await renderApp();

    setView({ view: "browse", repo: "maven-hosted" });
    await nextTick();
    await flushPromises();

    expect(wrapper!.text()).toContain("/repository/maven-hosted/");
    expect(urls.some((url) => url.startsWith("/internal/browse/maven-hosted"))).toBe(true);
  });

  it("opens the component search page from the top-left search button", async () => {
    const urls = await renderApp();

    await wrapper!.find('nav[aria-label="Repository browser"] .kk-rail-fab').trigger("click");
    await flushPromises();

    expect(window.location.hash).toBe("#browse/search");
    expect(route.value.view).toBe("search");
    expect(wrapper!.find("#search-keyword").exists()).toBe(true);
    expect(wrapper!.find("#search-format").exists()).toBe(true);
    expect(urls).toContain("/internal/search/components?limit=50");
    expect(window.document.activeElement?.id).not.toBe("browse-search");
  });

  it("submits the bottom search field to the search page with its keyword", async () => {
    const urls = await renderApp();

    await wrapper!.find("#browse-search").setValue("log4j");
    await wrapper!.find(".kk-bottom-toolbar__search").trigger("submit");
    await flushPromises();

    expect(window.location.hash).toBe("#browse/search?q=log4j");
    expect((wrapper!.find("#search-keyword").element as HTMLInputElement).value).toBe("log4j");
    expect(urls).toContain("/internal/search/components?limit=50&q=log4j");
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

  it("does not open the sign-in form when an anonymous visitor opens the browser", async () => {
    // Browsing may be allowed without a session, so the visit itself must not
    // force the form. Opening it is the user's decision (or an explicit challenge).
    const urls = await renderApp({ session: null });

    expect(loginDialogOpen()).toBe(false);
    expect(urls).not.toContain("/internal/security/login/options");
  });

  it("keeps the sign-in form closed for an authenticated session", async () => {
    const urls = await renderApp();

    expect(loginDialogOpen()).toBe(false);
    expect(urls).not.toContain("/internal/security/login/options");
  });

  it("opens the sign-in form for the explicit ?login=1 challenge", async () => {
    const urls = await renderApp({ search: "login=1", session: null });

    expect(loginDialogOpen()).toBe(true);
    expect(urls).toContain("/internal/security/login/options");
  });

  it("ignores ?login=1 once a session exists", async () => {
    // The login endpoint redirects back to the same URL, so a reload after
    // signing in must not reopen the form.
    const urls = await renderApp({ search: "login=1" });

    expect(loginDialogOpen()).toBe(false);
    expect(urls).not.toContain("/internal/security/login/options");
  });
});
