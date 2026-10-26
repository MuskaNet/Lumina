import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import dictionary from "../shared/i18n/zh-CN.json";
import dictionarySource from "../shared/i18n/zh-CN.json?raw";
import { setLanguage, t } from "../shared/i18n";
import { ADMIN_NAV } from "./nav";
import {
  ALPINE_METADATA_MODES, ALPINE_SIGNATURE_TYPES, APT_METADATA_MODES,
  LAYOUT_POLICIES, VERSION_POLICIES, WRITE_POLICIES,
} from "./repositoryForm";
import M3SchemaForm from "../shared/components/M3SchemaForm.vue";
import AppShell from "../shared/components/AppShell.vue";
import M3DataTable from "../shared/components/M3DataTable.vue";
import M3TopProgressBar from "../shared/components/M3TopProgressBar.vue";
import { reset, set } from "../shared/progress";
import type { FieldDef } from "../shared/components/schema";

const translations = dictionary as Record<string, string>;
const sources = import.meta.glob<string>([
  "./**/*.vue", "../shared/components/*.vue", "./nav.ts", "./repositoryForm.ts", "./repositoryStatus.ts",
], { query: "?raw", import: "default", eager: true });

afterEach(() => setLanguage("en"));

describe("administration Chinese translation coverage", () => {
  it("keeps the dictionary valid and free of duplicate keys", () => {
    const keys = [...dictionarySource.matchAll(/^\s*("(?:\\.|[^"\\])*")\s*:/gm)]
      .map((match) => JSON.parse(match[1]) as string);
    expect(new Set(keys).size).toBe(keys.length);
    expect(JSON.parse(dictionarySource)).toEqual(dictionary);
  });

  it("covers literal translation calls and dynamic schema/table/tab/navigation labels throughout admin and shared components", () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      const keys = new Set<string>();
      // A quote-aware match also handles apostrophes inside double-quoted copy.
      for (const match of source.matchAll(/\bt\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)) {
        keys.add(decodeLiteral(match[1]));
      }
      for (const match of source.matchAll(/\b(?:label|group)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)) {
        keys.add(decodeLiteral(match[1]));
      }
      for (const key of keys) {
        if (key && /[a-z]/i.test(key) && !Object.hasOwn(translations, key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing.sort()).toEqual([]);
  });

  it("translates runtime labels rather than only direct t() literals", () => {
    setLanguage("zh-CN");
    for (const item of ADMIN_NAV) {
      expect(translations[item.label], item.label).toBeDefined();
    }
    for (const choice of [
      ...APT_METADATA_MODES, ...ALPINE_METADATA_MODES, ...ALPINE_SIGNATURE_TYPES,
      ...WRITE_POLICIES, ...VERSION_POLICIES, ...LAYOUT_POLICIES,
    ]) {
      expect(translations[choice.label], choice.label).toBeDefined();
    }
    for (const key of ["Saved password unchanged", "Saved bearer token unchanged", "Saved proxy password unchanged",
      "New password", "Active", "Disabled", "Checking", "Healthy", "Running health check...",
      "UNKNOWN", "NEGLIGIBLE", "LOW", "MEDIUM", "HIGH", "CRITICAL", "AUDIT", "ENFORCE", "ALLOW", "BLOCK"]) {
      expect(t(key), key).not.toBe(key);
    }
  });

  it("localizes shared navigation, account and loading accessibility text", () => {
    setLanguage("zh-CN");
    set(50);
    const shell = mount(AppShell, { props: { title: "Admin", nav: [] } });
    const table = mount(M3DataTable, { props: { columns: [], rows: [], rowKey: () => "", loading: true, linearProgress: true } });
    const progress = mount(M3TopProgressBar);
    try {
      expect(shell.get("nav.kk-rail").attributes("aria-label")).toBe("管理");
      expect(shell.get(".kk-bottom-toolbar__account-btn").attributes("aria-label")).toContain("账户菜单：");
      expect(table.get('[role="progressbar"]').attributes("aria-label")).toBe("加载中");
      expect(progress.get('[role="progressbar"]').attributes("aria-label")).toBe("加载中");
    } finally {
      shell.unmount();
      table.unmount();
      progress.unmount();
      reset();
    }
  });

  it("localizes schema groups, options and placeholders while retaining submitted identifiers and examples", async () => {
    setLanguage("zh-CN");
    const fields: FieldDef[] = [
      { key: "status", type: "select", label: "Status", group: "Advanced", options: [
        { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" },
      ] },
      { key: "limit", type: "number", label: "Manifest entry limit", placeholder: "Inherit server default" },
      { key: "note", type: "textarea", label: "Notes", placeholder: "Inherit server default" },
      { key: "roles", type: "list", label: "Roles", placeholder: "nx-admin, nx-anonymous" },
      { key: "path", type: "text", label: "Path", placeholder: "/repository/npm-proxy/" },
    ];
    const model = { status: "active", limit: null, note: "", roles: [], path: "" };
    const wrapper = mount(M3SchemaForm, { props: { fields, model } });
    try {
      expect(wrapper.get("h3").text()).toBe("高级");
      expect(wrapper.findAll("option").map((option) => option.text())).toEqual(["无", "有效", "禁用"]);
      expect(wrapper.get("#field-limit").attributes("placeholder")).toBe("继承服务端默认值");
      expect(wrapper.get("#field-note").attributes("placeholder")).toBe("继承服务端默认值");
      expect(wrapper.get("#field-roles").attributes("placeholder")).toBe("nx-admin, nx-anonymous");
      expect(wrapper.get("#field-path").attributes("placeholder")).toBe("/repository/npm-proxy/");
      await wrapper.get("select").setValue("disabled");
      expect(model.status).toBe("disabled");
      setLanguage("en");
      await wrapper.vm.$nextTick();
      expect(wrapper.get("h3").text()).toBe("Advanced");
      expect(wrapper.get("#field-limit").attributes("placeholder")).toBe("Inherit server default");
    } finally {
      wrapper.unmount();
    }
  });
});

function decodeLiteral(literal: string): string {
  if (literal.startsWith('"')) return JSON.parse(literal) as string;
  return literal.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
}
