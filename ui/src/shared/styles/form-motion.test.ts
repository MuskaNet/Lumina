import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/shared/styles/app.css"), "utf8");

describe("MICL form motion contract", () => {
  it("keeps compact text-field density without overriding MICL motion", () => {
    const rule = css.match(/\.micl-textfield-outlined,\s*\.micl-textfield-filled\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("--md-comp-text-field-container-height: 52px");
    expect(rule).toContain("--md-comp-text-field-input-space: 14px");
  });

  it("does not override MICL text-field motion tokens", () => {
    expect(css).not.toMatch(/--md-comp-text-field-motion-(?:duration|duration-reverse|effects)\s*:/);
  });

  it("does not override MICL button motion tokens", () => {
    expect(css).not.toMatch(/--md-sys-motion-expressive-(?:default-effects|slow-effects|default-spatial|fast-spatial)-duration\s*:/);
    expect(css).not.toMatch(/--md-comp-button-motion-(?:duration|effects)\s*:/);
  });

  it("leaves MICL button shape and motion transitions intact", () => {
    for (const selector of [
      ".kk-primary-action",
      ".kk-primary-pill-btn",
      ".kk-destructive-outlined-btn",
      ".kk-usage__copy.kk-pill-btn",
    ]) {
      const rule = css.match(new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule).not.toMatch(/border-radius\s*:/);
      expect(rule).not.toMatch(/transition\s*:/);
    }
  });

  it("does not replace MICL's value-aware floating-label selectors", () => {
    expect(css).not.toMatch(/:not\(:placeholder-shown\)/);
    expect(css).not.toMatch(/\.micl-textfield-(?:outlined|filled)[^{]*> label[^}]*!important/s);
  });

  it("does not override MICL component motion or shape declarations", () => {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toMatch(/\.kk-rail-item \.micl-navigationrail__icon\s*\{[^}]*\b(?:transition|animation|transform|font-variation-settings)\s*:/s);
    expect(declarations).not.toMatch(/(?:^|[;{\s])--md-(?:comp|sys)-[a-z-]*motion[a-z-]*\s*:/i);
    expect(declarations).not.toMatch(/--md-sys-shape-corner-full\s*:/);
  });

  it("does not globally disable input or select transitions", () => {
    expect(css).not.toMatch(/(?:input|select|\.micl-[^,{]+)[^{]*\{[^}]*transition:\s*none\s*!important/s);
    expect(css).not.toMatch(/(?:input|select|\.micl-[^,{]+)[^{]*\{[^}]*animation:\s*none\s*!important/s);
  });
});
