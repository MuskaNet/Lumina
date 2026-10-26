import {
  readSettings,
  writeSettings,
  BUNDLED_THEMES,
  DEFAULT_THEME,
  normalizeThemeId,
} from "../settings";

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export type ColorScheme = "light" | "dark";

export function normalizeTheme(value: unknown, supported: readonly string[] = defaultThemes()): string {
  const candidate = normalizeThemeId(value);
  if (!candidate) return DEFAULT_THEME;
  return supported.includes(candidate) ? candidate : DEFAULT_THEME;
}

export function defaultThemes(): string[] {
  const advertised = readSettings().supportedDefaultThemes;
  const themes = Array.isArray(advertised)
    ? advertised
        .map((theme) => normalizeThemeId(theme))
        .filter((theme): theme is string => theme !== null)
    : [...BUNDLED_THEMES];
  if (!themes.includes(DEFAULT_THEME)) themes.unshift(DEFAULT_THEME);
  return [...new Set(themes)];
}

export function applyTheme(theme: string): string {
  const normalized = normalizeTheme(theme, defaultThemes());
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", normalized);
  }
  return normalized;
}

export function applyColorScheme(scheme: ColorScheme): void {
  if (typeof document === "undefined") return;
  for (const element of [document.documentElement, document.body]) {
    if (!element) continue;
    element.classList.toggle("dark", scheme === "dark");
    element.classList.toggle("light", scheme === "light");
  }
}

function schemeMediaQuery(): MediaQueryList | null {
  const runtime = globalThis as { matchMedia?: (query: string) => MediaQueryList };
  if (typeof runtime.matchMedia !== "function") return null;
  try {
    return runtime.matchMedia(DARK_SCHEME_QUERY);
  } catch {
    return null;
  }
}

/** The OS/browser colour scheme, or null when the runtime cannot report one. */
export function systemColorScheme(): ColorScheme | null {
  const query = schemeMediaQuery();
  return query ? (query.matches ? "dark" : "light") : null;
}

let schemeQuery: MediaQueryList | null = null;

/**
 * Applies the colour scheme the operating system asks for and re-applies it when
 * the user switches appearance. The listener is registered once per document;
 * runtimes without `matchMedia` fall back to the light scheme.
 */
export function followSystemColorScheme(): ColorScheme {
  const query = schemeMediaQuery();
  if (!query) {
    applyColorScheme("light");
    return "light";
  }
  const scheme: ColorScheme = query.matches ? "dark" : "light";
  applyColorScheme(scheme);
  if (query !== schemeQuery) {
    schemeQuery = query;
    const onChange = (event: MediaQueryListEvent) => {
      applyColorScheme(event.matches ? "dark" : "light");
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
    } else if (typeof query.addListener === "function") {
      query.addListener(onChange);
    }
  }
  return scheme;
}

export function setTheme(theme: string): string {
  const normalized = applyTheme(theme);
  writeSettings({ defaultTheme: normalized });
  return normalized;
}

/** Applies the persisted theme and the system colour scheme before the first render. */
export function initTheme(): void {
  const settings = readSettings();
  applyTheme(settings.defaultTheme);
  followSystemColorScheme();
}

export type { ColorScheme as M3ColorScheme };
