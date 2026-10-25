/**
 * Reads the product version from the `<meta name="kkrepo-version">` tag, which
 * Maven filters from `@project.version@` while packaging the UI module.
 *
 * Returns an empty string in dev, where the placeholder is not filtered.
 */
export function appVersion(): string {
  if (typeof document === "undefined") return "";
  const content = document.querySelector('meta[name="kkrepo-version"]')?.getAttribute("content") ?? "";
  if (!content || content.includes("@")) return "";
  return content;
}

export const PRODUCT_URL = "https://github.com/klboke/kkRepo";
