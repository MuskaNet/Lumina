import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AppShell from "./AppShell.vue";

// Vitest runs with `ui/` as the working directory (see ui/package.json).
function readUiFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function uiFileExists(relativePath: string): boolean {
  return existsSync(resolve(process.cwd(), relativePath));
}

describe("Material Symbols icon system", () => {
  it("declares the self-hosted subset and its ligature features", () => {
    const css = readUiFile("src/shared/fonts/material-symbols.css");

    expect(css).toContain('font-family: "Material Symbols Outlined"');
    expect(css).toContain('url("./material-symbols.woff2")');
    // Material Symbols maps icon names to glyphs through `rlig`; the subset
    // generator must retain it next to the documented `liga` feature.
    expect(css).toContain('font-feature-settings: "liga" 1, "rlig" 1');
    expect(uiFileExists("src/shared/fonts/material-symbols.woff2"), "subset font file").toBe(true);
  });

  it("keeps rlig in the subset generator", () => {
    const script = readUiFile("scripts/build-icons.mjs");

    expect(script).toContain('keepFeatures: ["rlig"]');
    expect(script).toContain("material-symbols-outlined.woff2");
  });

  it("renders Material Symbols ligatures instead of the Lucide sprite", () => {
    const wrapper = mount(AppShell, {
      props: {
        title: "Lumina",
        nav: [
          {
            id: "repositories",
            label: "Repositories",
            icon: "inventory_2",
            href: "#admin/repository/repositories",
          },
        ],
      },
    });

    expect(wrapper.findAll(".material-symbols-outlined").length).toBeGreaterThan(0);
    expect(wrapper.html()).not.toContain("lucide");
  });
});
