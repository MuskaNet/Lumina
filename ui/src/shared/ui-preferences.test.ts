import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUNDLED_THEMES, readSettings, writeSettings } from "./settings";
import { applyCachedUiPreferences, syncUiPreferencesFromServer } from "./ui-preferences";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("lang");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncUiPreferencesFromServer", () => {
  it("applies the defaults shared by every browser", async () => {
    writeSettings({ defaultLanguage: "zh-CN", defaultTheme: "default" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          defaultLanguage: "en",
          defaultTheme: "jfrog",
          supportedDefaultLanguages: ["browser", "zh-CN", "en"],
          supportedDefaultThemes: [...BUNDLED_THEMES],
        }),
      ),
    );

    const settings = await syncUiPreferencesFromServer();

    expect(settings).toMatchObject({ defaultLanguage: "en", defaultTheme: "jfrog" });
    expect(document.documentElement.dataset.theme).toBe("jfrog");
    expect(document.documentElement.lang).toBe("en");
    expect(readSettings()).toMatchObject({ defaultLanguage: "en", defaultTheme: "jfrog" });
  });

  it("keeps the cached defaults when the server is unreachable", async () => {
    writeSettings({ defaultLanguage: "zh-CN", defaultTheme: "indigo" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(syncUiPreferencesFromServer()).resolves.toBeNull();

    applyCachedUiPreferences();
    expect(document.documentElement.dataset.theme).toBe("indigo");
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
