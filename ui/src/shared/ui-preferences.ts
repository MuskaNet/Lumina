import { applyLanguagePreference } from "./i18n";
import { loadServerUiSettings, settings, type UiSettings } from "./settings";
import { applyTheme } from "./theme";

/**
 * Applies the cached UI defaults before the first render. The cache is written
 * whenever the settings page saves and whenever the server defaults are read.
 */
export function applyCachedUiPreferences(): UiSettings {
  const current = settings.value;
  applyTheme(current.defaultTheme);
  applyLanguagePreference(current.defaultLanguage);
  return current;
}

/**
 * Refreshes the console defaults from the server. `GET /internal/ui-settings` is
 * readable before sign-in, so a browser that has never saved settings still gets
 * the configured language and theme. On failure the cached settings stay in effect.
 */
export async function syncUiPreferencesFromServer(): Promise<UiSettings | null> {
  const settings = await loadServerUiSettings({ timeoutMs: 2500 });
  if (!settings) return null;
  applyTheme(settings.defaultTheme);
  applyLanguagePreference(settings.defaultLanguage);
  return settings;
}
