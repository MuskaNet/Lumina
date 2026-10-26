import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse, type ElementNode, type TemplateChildNode } from "@vue/compiler-dom";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const css = readFileSync(resolve(root, "shared/styles/app.css"), "utf8");

function classes(node: ElementNode): string[] {
  const attr = node.props.find((prop) => prop.type === 6 && prop.name === "class");
  return attr?.type === 6 ? (attr.value?.content ?? "").split(/\s+/) : [];
}

function toolbars(nodes: TemplateChildNode[]): ElementNode[] {
  return nodes.flatMap((node) => node.type === 1
    ? [...(classes(node).includes("kk-toolbar") ? [node] : []), ...toolbars(node.children)]
    : []);
}

describe("shared toolbar layout", () => {
  for (const app of ["admin", "browse"]) {
    const dir = resolve(root, app, "views");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".vue"))) {
      it(`${app}/${file} keeps actions together before trailing filters`, () => {
        const source = readFileSync(resolve(dir, file), "utf8");
        const template = source.slice(source.indexOf("<template>") + 10, source.lastIndexOf("</template>"));
        for (const toolbar of toolbars(parse(template).children)) {
          const children = toolbar.children.filter((node): node is ElementNode => node.type === 1);
          const filterIndex = children.findIndex((node) => classes(node).includes("kk-toolbar__filters"));
          for (const [index, child] of children.entries()) {
            if (child.tag === "button") {
              expect(classes(child)).not.toContain("kk-toolbar__spacer");
              if (filterIndex !== -1) expect(index).toBeLessThan(filterIndex);
            }
            if (classes(child).includes("kk-filter")) {
              expect.fail("Filter controls must be inside the trailing filter group");
            }
          }
        }
      });
    }
  }

  it("right-aligns the filter group and allows it to wrap on narrow screens", () => {
    const rule = css.match(/\.kk-toolbar__filters\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("display: flex");
    expect(rule).toContain("flex-wrap: wrap");
    expect(rule).toContain("margin-inline-start: auto");
    expect(rule).toContain("min-inline-size: 0");
    expect(rule).toContain("inline-size: max-content");
    expect(rule).toContain("max-inline-size: 100%");
    const field = css.match(/\.kk-toolbar__filters > \.kk-filter\s*\{([^}]+)\}/)?.[1];
    expect(field).toContain("inline-size: 320px");
    expect(field).toContain("max-inline-size: 100%");
    expect(css).toMatch(/@media \(max-width: 768px\)\s*\{\s*\.kk-toolbar__filters\s*\{\s*flex: 1 1 100%;\s*margin-inline-start: 0/);
  });
});
