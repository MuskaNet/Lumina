import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
const styleBlock = (file: string) =>
  [...read(file).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");

// Page styles live next to the page that owns them; shared layout rules stay in
// app.css. These assertions describe the resulting cascade, so read both.
const css = [
  read("shared/styles/app.css"),
  styleBlock("shared/components/M3DataTable.vue"),
  styleBlock("browse/BrowseTree.vue"),
  styleBlock("browse/BrowseDetailPane.vue"),
  styleBlock("browse/components/UploadFields.vue"),
  styleBlock("browse/views/BrowseView.vue"),
  styleBlock("browse/views/RepositoryListView.vue"),
  styleBlock("browse/views/UploadView.vue"),
  styleBlock("browse/views/WelcomeView.vue"),
].join("\n");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim().split(",").map((s) => s.trim()),
  body: match[2]!,
}));
const declarations = (selector: string) => rules.filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.body).join("\n");
const cards = [
  ".kk-welcome-header", ".kk-repo-card", ".kk-browse-filter-bar",
  ".kk-table-card-container", ".kk-upload-step-card", ".kk-upload-asset-card",
  ".kk-browse-bar", ".kk-browse-split", ".kk-detail-panel",
];

describe("Browse filled-surface layout", () => {
  it.each(cards)("keeps %s full-width and free of card outlines", (selector) => {
    const body = declarations(selector);
    expect(body).toContain("inline-size: 100%");
    expect(body).toContain("box-sizing: border-box");
    expect(body).not.toMatch(/(?:^|[;\s])(?:border(?:-(?!radius)[\w-]+)?|outline(?:-[\w-]+)?)\s*:/);
    expect(body).not.toMatch(/max-(?:width|inline-size)\s*:|box-shadow\s*:/);
    expect(body).toMatch(/var\(--md-sys-color-surface-container(?:-low)?\)/);
    expect(declarations(`${selector}:hover`)).not.toMatch(/border(?:-(?!radius)[\w-]+)?\s*:/);
  });

  it("removes the decorative Hero edge instead of disguising its border", () => {
    expect(declarations(".kk-welcome-header::before")).toBe("");
  });

  it("leaves width limits on the outer Content only", () => {
    expect(declarations(".kk-page")).toContain("max-inline-size: 1450px");
    for (const rule of rules) {
      if (rule.selectors.some((s) => /^\.(?:kk-upload|kk-table-card-container|kk-browse-filter-bar)/.test(s))) {
        expect(rule.body).not.toMatch(/max-(?:width|inline-size)\s*:/);
      }
    }
  });

  it("removes tree dividers and makes long filenames scroll rather than wrap", () => {
    expect(declarations(".kk-browse-tree-pane")).not.toMatch(/border(?:-(?!radius)[\w-]+)?\s*:/);
    expect(declarations(".kk-browse-tree-pane")).toContain("overflow-x: auto");
    expect(declarations(".kk-tree__rows")).toContain("inline-size: max-content");
    expect(declarations(".kk-tree-label")).toContain("white-space: nowrap");
    expect(declarations(".kk-tree-label")).toContain("overflow-wrap: normal");
    expect(declarations(".kk-tree-label")).toContain("word-break: normal");
  });

  it("keeps the resizer out of the 68/32 layout allocation", () => {
    expect(declarations(".kk-browse-tree-pane")).toContain("flex: 0 0 var(--kk-browse-tree-width, 68%)");
    expect(declarations(".kk-browse-detail-wrap")).toContain("flex: 1 1 0");
    expect(declarations(".kk-browse-resizer")).toContain("position: absolute");
    expect(css).toContain("@media (max-width: 860px)");
    expect(declarations(".kk-browse-split")).toContain("flex-direction: column");
    expect(declarations(".kk-browse-resizer")).toContain("display: none !important");
  });

  it("does not add tree padding on top of a 100-percent minimum width", () => {
    const tree = declarations(".kk-tree");
    expect(tree).toContain("box-sizing: border-box");
    expect(tree).toContain("inline-size: 100%");
    expect(tree).toContain("min-inline-size: 0");
    expect(tree).not.toContain("min-inline-size: 100%");
  });

  it("allocates desktop detail height from the shell instead of a fixed viewport offset", () => {
    expect(css).toContain("@media (min-width: 861px)");
    expect(declarations(".kk-browser-shell--detail .kk-browser-content")).toContain("min-block-size: 0");
    expect(declarations(".kk-browser-shell--detail .kk-page")).toContain("flex: 1 1 0");
    expect(declarations(".kk-browser-shell--detail .kk-browse-split")).toContain("flex: 1 1 0");
    expect(declarations(".kk-browse-split")).not.toMatch(/clamp\(|100dvh/);
  });

  it("keeps the URL copy row aligned despite generic link styles", () => {
    const row = declarations(".kk-location.kk-repo-card__url");
    expect(row).toContain("display: flex");
    expect(row).toContain("inline-size: 100%");
    expect(row).toContain("box-sizing: border-box");
    expect(row).toContain("align-items: center");
    expect(row).toContain("justify-content: space-between");
  });

  it("delegates usage and download actions to MICL buttons", () => {
    expect(declarations(".kk-usage__pick")).toBe("");
    expect(declarations(".kk-usage__selector")).toContain("flex: 1 1 0");
    expect(css).not.toContain(".kk-primary-pill-btn.kk-detail-download__btn");
    expect(css).toContain(".kk-detail-download__btn");
  });

  it("keeps step headings side-by-side and retains keyboard focus on actions", () => {
    expect(declarations(".kk-upload-step-card__head")).toContain("display: flex");
    expect(declarations(".kk-upload-step-card__head")).toContain("align-items: center");
    expect(declarations(".kk-repo-card__open:focus-visible")).toContain("outline: 2px solid var(--md-sys-color-primary)");
  });
});
