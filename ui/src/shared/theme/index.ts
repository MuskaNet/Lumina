import { readSettings, writeSettings, BUNDLED_THEMES, DEFAULT_THEME } from "../settings";

const THEME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type ColorScheme = "light" | "dark";

export function normalizeTheme(value: unknown, supported: readonly string[] = defaultThemes()): string {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!THEME_PATTERN.test(candidate)) return DEFAULT_THEME;
  return supported.includes(candidate) ? candidate : DEFAULT_THEME;
}

export function defaultThemes(): string[] {
  const advertised = readSettings().supportedDefaultThemes;
  const themes = Array.isArray(advertised)
    ? advertised.filter((theme) => typeof theme === "string" && THEME_PATTERN.test(theme))
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

export function setTheme(theme: string): string {
  const normalized = applyTheme(theme);
  writeSettings({ defaultTheme: normalized });
  return normalized;
}

/** Applies the persisted theme and scheme before the first render. */
export function initTheme(): void {
  const settings = readSettings();
  applyTheme(settings.defaultTheme);
  applyColorScheme("light");
}

export type { ColorScheme as M3ColorScheme };
