import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCachedUiPreferences } from "../../shared/ui-preferences";
import { BUNDLED_THEMES, readSettings } from "../../shared/settings";
import UiSettingsView from "./UiSettingsView.vue";

const SUPPORTED_LANGUAGES = ["browser", "zh-CN", "en"];
const SUPPORTED_THEMES = [...BUNDLED_THEMES];

interface RequestLog {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

let requests: RequestLog[] = [];

/** Stubs `GET`/`PUT /internal/ui-settings`; returns the initial server defaults. */
function stubSettingsApi(initial: { defaultLanguage: string; defaultTheme: string }): void {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      requests.push({ url, method, body });

      if (method === "PUT") {
        return jsonResponse({
          defaultLanguage: body?.defaultLanguage,
          defaultTheme: body?.defaultTheme,
          supportedDefaultLanguages: SUPPORTED_LANGUAGES,
          supportedDefaultThemes: SUPPORTED_THEMES,
          updatedAt: "2026-10-26T07:57:27Z",
        });
      }
      return jsonResponse({
        ...initial,
        supportedDefaultLanguages: SUPPORTED_LANGUAGES,
        supportedDefaultThemes: SUPPORTED_THEMES,
        updatedAt: null,
      });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("lang");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI settings view", () => {
  it("loads the defaults saved on the server", async () => {
    stubSettingsApi({ defaultLanguage: "en", defaultTheme: "ocean" });

    const wrapper = mount(UiSettingsView);
    await flushPromises();

    expect((wrapper.find("#ui-language").element as HTMLSelectElement).value).toBe("en");
    expect((wrapper.find("#ui-theme").element as HTMLSelectElement).value).toBe("ocean");
    expect(readSettings()).toMatchObject({ defaultLanguage: "en", defaultTheme: "ocean" });
  });

  it("persists saved defaults so the next reload applies them immediately", async () => {
    stubSettingsApi({ defaultLanguage: "zh-CN", defaultTheme: "default" });

    const wrapper = mount(UiSettingsView);
    await flushPromises();
    expect((wrapper.find("#ui-language").element as HTMLSelectElement).value).toBe("zh-CN");

    await wrapper.find("#ui-language").setValue("en");
    await wrapper.find("#ui-theme").setValue("jfrog");
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();

    // The defaults were sent to the server and applied immediately.
    expect(requests.find((request) => request.method === "PUT")?.body).toMatchObject({
      defaultLanguage: "en",
      defaultTheme: "jfrog",
    });
    expect(document.documentElement.dataset.theme).toBe("jfrog");
    expect(document.documentElement.lang).toBe("en");

    // The saved values are cached, so a reload does not depend on the request.
    expect(readSettings()).toMatchObject({ defaultLanguage: "en", defaultTheme: "jfrog" });

    // Simulate the next page load: only the cache is available at first paint.
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("lang");
    applyCachedUiPreferences();

    expect(document.documentElement.dataset.theme).toBe("jfrog");
    expect(document.documentElement.lang).toBe("en");
  });
});
