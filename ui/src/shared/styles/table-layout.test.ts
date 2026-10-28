import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
// The table's own rules live in its SFC; shared layout rules stay in app.css.
const css = [read("shared/components/M3DataTable.vue"), read("shared/styles/app.css")].join("\n");

describe("shared table text layout", () => {
  it("prevents wrapping in headers, cells and slotted descendants", () => {
    const rule = css.match(/\.kk-table th,\s*\.kk-table td,\s*\.kk-table :is\(th, td\) \*\s*\{([^}]+)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain("white-space: nowrap");
    expect(rule).toContain("overflow-wrap: normal");
    expect(rule).toContain("word-break: normal");
  });

  it("uses a single scroll owner for the Browse catalog", () => {
    const card = css.match(/\.kk-table-card-container\s*\{([^}]+)\}/)?.[1];
    const frame = css.match(/\.kk-table-card-container \.kk-table-frame\s*\{([^}]+)\}/)?.[1];
    const table = css.match(/\.kk-table-card-container \.kk-table\s*\{([^}]+)\}/)?.[1];
    expect(card).toContain("overflow: hidden");
    expect(card).toContain("padding: 16px");
    expect(card).toContain("border-radius: 24px");
    expect(frame).toContain("background: var(--md-sys-color-surface-container-low)");
    expect(card).not.toMatch(/overflow-x:\s*auto/);
    expect(frame).toContain("min-inline-size: 0");
    expect(table).toContain("min-inline-size: 680px");
  });

  it("aligns sortable headings with plain table heading text", () => {
    const button = css.match(/\.kk-sort-button\s*\{([^}]+)\}/)?.[1];
    const icon = css.match(/\.kk-sort-icon\s*\{([^}]+)\}/)?.[1];
    expect(button).toContain("display: flex");
    expect(button).toContain("inline-size: max-content");
    expect(button).toContain("align-items: center");
    expect(icon).toContain("line-height: 1");
  });

  it("reuses an existing admin card without doubling its padding", () => {
    const surface = [...css.matchAll(/\.kk-table-surface\s*\{([^}]+)\}/g)].map((match) => match[1]).join("\n");
    const nested = css.match(/\.kk-table-surface > \.kk-table-card-container\s*\{([^}]+)\}/)?.[1];
    expect(surface).toContain("background: var(--md-sys-color-surface-container)");
    expect(surface).toContain("padding: 16px");
    expect(nested).toContain("padding: 0");
  });

  it("keeps oversized tables scrollable within their frame", () => {
    const frame = css.match(/(?:^|\n)\.kk-table-frame\s*\{([^}]+)\}/)?.[1];
    expect(frame).toContain("overflow: auto");
  });
});
