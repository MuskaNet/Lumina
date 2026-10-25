import { ref } from "vue";
import dictionary from "./zh-CN.json";
import { readSettings, type UiLanguage } from "../settings";

export type Language = "zh-CN" | "en";

const translations = dictionary as Record<string, string>;

export function resolveLanguage(preference: UiLanguage = "browser"): Language {
  if (preference === "zh-CN" || preference === "en") return preference;
  const browser = typeof navigator === "undefined" ? "en" : navigator.language || "en";
  return browser.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export const language = ref<Language>(resolveLanguage(readSettings().defaultLanguage));

export function setLanguage(next: Language): void {
  language.value = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
}

export function applyLanguagePreference(preference: UiLanguage): void {
  setLanguage(resolveLanguage(preference));
}

/**
 * Translates a source English string. Unknown strings fall back to the source
 * text, matching the legacy shared dictionary behaviour.
 */
export function t(text: string): string {
  if (language.value === "en") return text;
  return translations[text] ?? text;
}

export function translateCount(): number {
  return Object.keys(translations).length;
}
