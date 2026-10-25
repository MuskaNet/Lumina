import { afterEach, describe, expect, it } from "vitest";
import dictionary from "./zh-CN.json";
import { resolveLanguage, setLanguage, t, translateCount } from "./index";

const translations = dictionary as Record<string, string>;

afterEach(() => {
  setLanguage("en");
});

describe("UI dictionary", () => {
  it("retains the migrated translations", () => {
    // The legacy ui-i18n.js carried 641 entries; losing them silently would only
    // surface when a Chinese user opens the console.
    expect(translateCount()).toBeGreaterThanOrEqual(600);
  });

  it("keeps representative domain strings", () => {
    const representative = [
      "Loading usage…",
      "Stored blob size",
      "Pending cleanup",
      "Copy URL",
      "Matching repositories",
    ];
    for (const key of representative) {
      expect(translations[key], key).toBeTruthy();
    }
  });

  it("falls back to the source string for unknown keys", () => {
    setLanguage("zh-CN");
    expect(t("Not a translated string.")).toBe("Not a translated string.");
  });

  it("translates known source strings", () => {
    setLanguage("zh-CN");
    const key = Object.keys(translations)[0];
    expect(t(key)).toBe(translations[key]);
    expect(t(key)).not.toBe(key);
  });

  it("resolves an explicit language preference", () => {
    expect(resolveLanguage("zh-CN")).toBe("zh-CN");
    expect(resolveLanguage("en")).toBe("en");
  });
});
