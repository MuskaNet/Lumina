import { readonly, ref } from "vue";

export const STORAGE_KEY = "kkrepo.uiSettings";
export const DEFAULT_THEME = "default";

/** Themes shipped with the admin console; mirrors UiSettingsController. */
export const BUNDLED_THEMES = ["default", "indigo", "ocean", "sunset", "jfrog", "nexus"] as const;

export type BundledTheme = (typeof BUNDLED_THEMES)[number];
export type UiLanguage = "browser" | "zh-CN" | "en";

export interface UiSettings {
  defaultLanguage: UiLanguage;
  defaultTheme: string;
  supportedDefaultLanguages?: string[];
  supportedDefaultThemes?: string[];
}

const FALLBACK: UiSettings = {
  defaultLanguage: "browser",
  defaultTheme: DEFAULT_THEME,
};

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSettings(): UiSettings {
  const store = storage();
  if (!store) return { ...FALLBACK };
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || "{}") as Partial<UiSettings>;
    return {
      defaultLanguage: isLanguage(parsed.defaultLanguage) ? parsed.defaultLanguage : FALLBACK.defaultLanguage,
      defaultTheme: typeof parsed.defaultTheme === "string" && parsed.defaultTheme
        ? parsed.defaultTheme
        : FALLBACK.defaultTheme,
      supportedDefaultLanguages: parsed.supportedDefaultLanguages,
      supportedDefaultThemes: parsed.supportedDefaultThemes,
    };
  } catch {
    return { ...FALLBACK };
  }
}

export function writeSettings(patch: Partial<UiSettings>): UiSettings {
  const next = { ...readSettings(), ...patch };
  const store = storage();
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A blocked storage quota must not break the console.
    }
  }
  settings.value = next;
  return next;
}

function isLanguage(value: unknown): value is UiLanguage {
  return value === "browser" || value === "zh-CN" || value === "en";
}

export const settings = ref<UiSettings>(readSettings());
export const currentSettings = readonly(settings);
