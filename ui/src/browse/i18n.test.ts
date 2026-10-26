import { mount } from "@vue/test-utils";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { language, setLanguage, t } from "../shared/i18n";
import dictionary from "../shared/i18n/zh-CN.json";
import WelcomeView from "./views/WelcomeView.vue";
import BrowseDetailPane from "./BrowseDetailPane.vue";

const translations = dictionary as Record<string, string>;
const previousLanguage = language.value;
afterEach(() => setLanguage(previousLanguage));

function browseSources(directory = resolve(process.cwd(), "src/browse")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? browseSources(file)
      : /\.(vue|ts)$/.test(file) && !file.includes(".test.") ? [file] : [];
  });
}

describe("Browse Chinese translations", () => {
  it("covers literal UI strings, table labels and empty-state descriptions", () => {
    const keys = new Set<string>();
    for (const file of browseSources()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*(["'])(.*?)\1/g)) keys.add(match[2]!);
      for (const match of source.matchAll(/(?:title|description|action-label)="([A-Z][^"]+)"/g)) keys.add(match[1]!);
      for (const match of source.matchAll(/label:\s*"([^"]+)"/g)) keys.add(match[1]!);
    }
    for (const key of keys) expect(translations[key], key).toBeTruthy();
  });

  it("covers generated summary labels and package-client instructions", () => {
    const keys = new Set<string>();
    for (const file of ["usage.ts", "detail.ts"]) {
      const source = ts.createSourceFile(file, readFileSync(resolve(process.cwd(), "src/browse", file), "utf8"), ts.ScriptTarget.Latest, true);
      function walk(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(source);
          const indexes = name === "usageSnippet" ? [2] : ["row", "optionalRow", "optionalBytesRow"].includes(name) ? [0] : [];
          for (const index of indexes) {
            const value = node.arguments[index];
            if (value && ts.isStringLiteral(value) && !/^SHA-\d+$|^MD5$|^RREV$|^PREV$|^LFS SHA-256$|^Git OID$|^OID \(SHA-256\)$/.test(value.text)) keys.add(value.text);
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
    for (const key of keys) expect(translations[key], key).toBeTruthy();
  });

  it("renders the welcome copy and instructions in Chinese without changing repository identities", () => {
    setLanguage("zh-CN");
    const wrapper = mount(WelcomeView, { props: { repositories: [{ name: "raw-release", format: "raw", type: "HOSTED", online: true }] } });
    expect(wrapper.text()).toContain("浏览仓库");
    expect(wrapper.text()).toContain("复制下方仓库地址");
    expect(wrapper.text()).toContain("/repository/raw-release/");
    expect(wrapper.text()).not.toContain("Select a repository");
    wrapper.unmount();
  });

  it("translates usage selectors, descriptions and warnings without translating code or user values", async () => {
    setLanguage("zh-CN");
    const command = "apk fetch --repository https://example.org/repository/alpine/ demo";
    const wrapper = mount(BrowseDetailPane, { props: {
      repositoryName: "Namespace", repositoryFormat: "alpine",
      entry: { name: "demo", path: "demo", leaf: false }, detail: null, loading: false, canDelete: false,
      usage: { summaryRows: [
        { label: "Repository", value: "Namespace" },
        { label: "Transport warning", value: "Use HTTPS in production for Galaxy credentials" },
      ], snippets: [{ displayName: "Fetch", snippetText: command, description: "An administrator can export the scoped public key from the repository settings" }] },
    } });
    expect(wrapper.get("select").text()).toBe("获取");
    expect(wrapper.get(".kk-usage__hint").text()).toBe("管理员可从仓库设置导出专用公钥");
    expect(wrapper.text()).toContain("生产环境请使用 HTTPS，以保护 Galaxy 凭据");
    expect(wrapper.text()).toContain("Namespace");
    expect(wrapper.get(".kk-usage__snippet").text()).toBe(command);
    setLanguage("en");
    await wrapper.vm.$nextTick();
    expect(wrapper.get("select").text()).toBe("Fetch");
    expect(wrapper.get(".kk-usage__snippet").text()).toBe(command);
    wrapper.unmount();
  });

  it("translates copy notifications, token state and search labels", () => {
    setLanguage("zh-CN");
    for (const key of ["Copied", "No tokens yet.", "Component search results", "active", "Expires", "Last used"]) {
      expect(t(key), key).not.toBe(key);
    }
  });
});
