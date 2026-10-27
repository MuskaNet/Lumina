import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/shared/styles/app.css"), "utf8");

describe("MICL form motion contract", () => {
  it("preserves text-field focus and label motion when using compact density", () => {
    const rule = css.match(/\.micl-textfield-outlined,\s*\.micl-textfield-filled\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("--md-comp-text-field-motion-duration: 300ms");
    expect(rule).toContain("--md-comp-text-field-motion-duration-reverse: 200ms");
    expect(rule).toContain("--md-comp-text-field-motion-effects:");
  });

  it("does not globally disable input or select transitions", () => {
    expect(css).not.toMatch(/(?:input|select|\.micl-[^,{]+)[^{]*\{[^}]*transition:\s*none\s*!important/s);
    expect(css).not.toMatch(/(?:input|select|\.micl-[^,{]+)[^{]*\{[^}]*animation:\s*none\s*!important/s);
  });
});
