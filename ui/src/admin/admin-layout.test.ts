import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const views = [
  "Repositories", "BlobStores", "CleanupPolicies", "ContentSelectors", "DockerRegistry",
  "Users", "Roles", "Privileges", "Realms", "ApiKeys", "AuditLog",
  "Scanning", "UiSettings", "NexusMigration", "RepositoryDataMigration", "NotFound",
  "Ldap", "Oidc", "Anonymous",
];
const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
const css = read("shared/styles/app.css").split("/* Shared filled-surface layouts; MICL retains control rendering. */")[1] ?? "";

function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`, "g"))].map((match) => match[1]).join("\n");
}

describe("admin filled-surface layout", () => {
  it.each(views)("keeps %s in the responsive admin layout", (view) => {
    // Page-owned CSS now lives in the view's <style> block, so only the
    // template must stay free of hard-coded width caps.
    const source = read(`admin/views/${view}View.vue`).replace(/<style[\s\S]*?<\/style>/g, "");
    expect(source).toContain('class="kk-settings-page"');
    expect(source).toMatch(/kk-surface-card|kk-table-surface/);
    expect(source).not.toMatch(/max-(?:width|inline-size)\s*:/);
  });

  it("loads the shared layout from both entrypoints", () => {
    expect(read("admin/main.ts")).toContain('import "../shared/styles/app.css"');
    expect(read("browse/main.ts")).toContain('import "../shared/styles/app.css"');
  });

  it("uses full-width theme surfaces without internal width caps or outlined borders", () => {
    expect(css).not.toMatch(/(?:^|[;{])\s*max-(?:width|inline-size)\s*:/);
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(declarations(".kk-settings-page")).toContain("inline-size: 100%");
    expect(declarations(".kk-table-surface")).toContain("border-radius: 24px");
    for (const match of css.matchAll(/(?:^|[;{])\s*border\s*:\s*([^;]+);/g)) {
      expect(["0", "none"]).toContain(match[1].trim());
    }
    expect(css).toContain("var(--md-sys-color-surface-container-low)");
  });

  it("stacks form grids at the required mobile breakpoint without styling MICL controls", () => {
    expect(css).toContain("@media (max-width: 768px)");
    const mobile = css.slice(css.indexOf("@media (max-width: 768px)"));
    expect(mobile).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(mobile).toContain("border-radius: 18px");
    expect(css).not.toMatch(/\.micl-|\b(?:input|select|textarea)\s*[:>{.\[]/);
  });
});
