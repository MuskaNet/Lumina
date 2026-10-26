import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUNDLED_THEMES,
  cacheServerUiSettings,
  loadServerUiSettings,
  readSettings,
  STORAGE_KEY,
  writeSettings,
} from "./settings";

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
  writeSettings({ defaultLanguage: "browser", defaultTheme: "default" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cacheServerUiSettings", () => {
  it("stores the server defaults and the advertised value lists", () => {
    const settings = cacheServerUiSettings({
      defaultLanguage: "en",
      defaultTheme: "jfrog",
      supportedDefaultLanguages: ["browser", "zh-CN", "en"],
      supportedDefaultThemes: [...BUNDLED_THEMES],
    });

    expect(settings).toMatchObject({ defaultLanguage: "en", defaultTheme: "jfrog" });
    expect(readSettings()).toMatchObject({ defaultLanguage: "en", defaultTheme: "jfrog" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({
      defaultLanguage: "en",
      defaultTheme: "jfrog",
      supportedDefaultThemes: [...BUNDLED_THEMES],
    });
  });

  it("ignores values the console cannot apply", () => {
    writeSettings({ defaultLanguage: "zh-CN", defaultTheme: "indigo" });

    const settings = cacheServerUiSettings({
      defaultLanguage: "fr",
      defaultTheme: "../admin",
      supportedDefaultLanguages: ["en"],
      supportedDefaultThemes: ["default", "jfrog"],
    });

    expect(settings.defaultLanguage).toBe("zh-CN");
    expect(settings.defaultTheme).toBe("indigo");
    expect(settings.supportedDefaultThemes).toEqual(["default", "jfrog"]);
  });

  it("normalizes theme ids to the CSS form", () => {
    expect(cacheServerUiSettings({ defaultTheme: "  JFROG " }).defaultTheme).toBe("jfrog");
  });
});

describe("loadServerUiSettings", () => {
  it("reads the console defaults from the settings endpoint", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return jsonResponse({
          defaultLanguage: "en",
          defaultTheme: "ocean",
          supportedDefaultThemes: [...BUNDLED_THEMES],
        });
      }),
    );

    const settings = await loadServerUiSettings();

    expect(urls).toEqual(["/internal/ui-settings"]);
    expect(settings).toMatchObject({ defaultLanguage: "en", defaultTheme: "ocean" });
    expect(readSettings()).toMatchObject({ defaultLanguage: "en", defaultTheme: "ocean" });
  });

  it("keeps the cached settings when the request fails", async () => {
    writeSettings({ defaultLanguage: "zh-CN", defaultTheme: "sunset" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(loadServerUiSettings()).resolves.toBeNull();
    expect(readSettings()).toMatchObject({ defaultLanguage: "zh-CN", defaultTheme: "sunset" });
  });
});
