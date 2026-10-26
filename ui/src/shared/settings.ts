import { readonly, ref } from "vue";
import { api } from "./api/client";

export const STORAGE_KEY = "kkrepo.uiSettings";
export const DEFAULT_THEME = "default";
/** Server-side console defaults shared by every browser. */
export const UI_SETTINGS_ENDPOINT = "/internal/ui-settings";
/** Theme ids accepted by `UiSettingsController` and the theme generator. */
export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

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

/** Response of `GET /internal/ui-settings`. */
export interface ServerUiSettings {
  defaultLanguage?: string | null;
  supportedDefaultLanguages?: string[] | null;
  defaultTheme?: string | null;
  supportedDefaultThemes?: string[] | null;
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
      defaultTheme: normalizeThemeId(parsed.defaultTheme) ?? FALLBACK.defaultTheme,
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

/** Normalizes a theme id to the lowercase kebab form the CSS uses, or null. */
export function normalizeThemeId(value: unknown): string | null {
  const candidate = String(value ?? "").trim().toLowerCase();
  return THEME_ID_PATTERN.test(candidate) ? candidate : null;
}

function isLanguage(value: unknown): value is UiLanguage {
  return value === "browser" || value === "zh-CN" || value === "en";
}

function stringList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const list = values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return list.length ? list : undefined;
}

/**
 * Merges the server-side defaults into the local cache and returns the effective
 * settings. Invalid or unknown values are ignored so a bad response cannot break
 * the next start-up; the cached value stays in effect instead.
 */
export function cacheServerUiSettings(payload: ServerUiSettings | null | undefined): UiSettings {
  const patch: Partial<UiSettings> = {};
  const languages = stringList(payload?.supportedDefaultLanguages);
  const themes = stringList(payload?.supportedDefaultThemes);
  if (languages) patch.supportedDefaultLanguages = languages;
  if (themes) patch.supportedDefaultThemes = themes;
  if (isLanguage(payload?.defaultLanguage)) patch.defaultLanguage = payload.defaultLanguage;
  const theme = normalizeThemeId(payload?.defaultTheme);
  if (theme) patch.defaultTheme = theme;
  return writeSettings(patch);
}

/**
 * Reads the console defaults stored on the server. The endpoint is readable
 * before sign-in so the first paint can honour the configured language/theme.
 * Returns null when the request fails; the cached settings then stay in effect.
 */
export async function loadServerUiSettings(options: { timeoutMs?: number } = {}): Promise<UiSettings | null> {
  const controller =
    options.timeoutMs && typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
  try {
    return cacheServerUiSettings(await api.get<ServerUiSettings>(UI_SETTINGS_ENDPOINT, controller?.signal));
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export const settings = ref<UiSettings>(readSettings());
export const currentSettings = readonly(settings);
