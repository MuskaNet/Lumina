import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_THEMES } from "../settings";

// Vitest runs with `ui/` as the working directory (see ui/package.json).
function readUiFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const THEMES_CSS = readUiFile("src/shared/theme/themes.generated.css");
const THEME_GENERATOR = readUiFile("scripts/build-themes.mjs");

/** Roles the MICL component styles consume; every scheme must define all of them. */
const M3_ROLES = [
  "primary",
  "on-primary",
  "primary-container",
  "on-primary-container",
  "secondary",
  "tertiary",
  "error",
  "surface",
  "on-surface",
  "surface-container",
  "surface-container-highest",
  "outline",
  "outline-variant",
];

describe("Material 3 themes", () => {
  it("ships the six Nexus-era themes", () => {
    expect([...BUNDLED_THEMES]).toEqual(["default", "indigo", "ocean", "sunset", "jfrog", "nexus"]);
  });

  it("generates a light and a dark scheme for every theme", () => {
    for (const theme of BUNDLED_THEMES) {
      const selector = `:root[data-theme="${theme}"]`;
      expect(THEMES_CSS, `${theme} light`).toContain(`${selector}.light, ${selector}`);
      expect(THEMES_CSS, `${theme} dark`).toContain(`${selector}.dark`);
    }
  });

  it("carries the full M3 role set in every scheme", () => {
    for (const role of M3_ROLES) {
      const occurrences = THEMES_CSS.split(`--md-sys-color-${role}:`).length - 1;
      expect(occurrences, role).toBeGreaterThanOrEqual(BUNDLED_THEMES.length * 2);
    }
  });

  it("keeps the generator aligned with the theme allow list", () => {
    for (const theme of BUNDLED_THEMES) {
      expect(THEME_GENERATOR, theme).toContain(`id: "${theme}"`);
    }
    expect(THEME_GENERATOR).toContain("SchemeTonalSpot");
    expect(THEME_GENERATOR).toContain('brand: "#0e7c6f"');
    expect(THEME_GENERATOR).toContain('brand: "#2f7650"');
  });

  it("falls back to the system scheme before JavaScript runs", () => {
    expect(THEMES_CSS).toContain("@media (prefers-color-scheme: dark)");
    expect(THEMES_CSS).toContain(":not(.light)");
  });
});
