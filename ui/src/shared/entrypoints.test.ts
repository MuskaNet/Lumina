import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with `ui/` as the working directory (see ui/package.json), so the
// repository root is one level up. These documents are the `vite build` output
// committed next to the Spring Boot module that serves them.
const repoRoot = resolve(process.cwd(), "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function repoFileExists(relativePath: string): boolean {
  return existsSync(resolve(repoRoot, relativePath));
}

interface EntryPoint {
  name: string;
  base: string;
  publicPath: string;
  legacyAssets: string[];
}

const ENTRY_POINTS: EntryPoint[] = [
  {
    name: "admin",
    base: "admin-ui/src/main/resources/META-INF/resources/admin",
    publicPath: "/admin/",
    legacyAssets: ["admin.js", "admin.css", "content-selectors.js"],
  },
  {
    name: "browse",
    base: "browse-ui/src/main/resources/META-INF/resources/browse",
    publicPath: "/browse/",
    legacyAssets: ["browse.js", "browse.css", "lucide-icons.css", "themes/default.css"],
  },
];

describe.each(ENTRY_POINTS)("$name entry point", ({ base, publicPath, legacyAssets }) => {
  const index = readRepoFile(`${base}/index.html`);

  it("loads the bundled Vue application", () => {
    expect(index).toContain(`src="${publicPath}assets/app.js"`);
    expect(index).toContain(`href="${publicPath}assets/app.css"`);
    expect(index).toContain('<div id="app"></div>');
  });

  it("keeps the metadata the server and CSP rely on", () => {
    // Without this meta tag browsers do not know the console supports both
    // colour schemes, so UA widgets and the initial canvas ignore the OS theme.
    expect(index).toContain('<meta name="color-scheme" content="light dark">');
    // maven-resources-plugin filters this document at packaging time.
    expect(index).toContain('<meta name="kkrepo-version" content="');
  });

  it("stays compatible with the self-only content security policy", () => {
    // script-src 'self' forbids inline scripts and eval-based template compilation.
    expect(index).not.toContain("<script>");
    expect(index).not.toContain("javascript:");
    expect(index.toLowerCase()).not.toContain("unsafe-eval");
  });

  it("ships the bundled assets", () => {
    expect(repoFileExists(`${base}/assets/app.js`), "app.js").toBe(true);
    expect(repoFileExists(`${base}/assets/app.css`), "app.css").toBe(true);
    expect(
      repoFileExists(`${base}/assets/material-symbols.woff2`),
      "self-hosted Material Symbols font",
    ).toBe(true);
  });

  it("no longer ships the legacy bundles", () => {
    for (const asset of legacyAssets) {
      expect(repoFileExists(`${base}/assets/${asset}`), asset).toBe(false);
    }
  });
});
