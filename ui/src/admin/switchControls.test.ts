import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design guard for the admin console: MICL's Switch owns every single on/off
 * setting. A checkbox is correct only where the user picks an arbitrary number
 * of values from a set, because it is announced as "select all that apply".
 *
 * This is a source-level guard rather than a component test: the invariant
 * spans every admin view and dialog, and mounting all of them would require
 * mocking every internal endpoint while still missing dialogs that are closed
 * by default.
 */
const MULTI_SELECT_CHECKBOX_FILES = [
  "src/admin/components/CleanupRepositoryPicker.vue",
  "src/admin/views/ContentSelectorsView.vue",
];

const SWITCH_INPUT = /<input\b[^>]*class="micl-switch"[^>]*>/g;

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

const sourceRoot = join(process.cwd(), "src");
const uiRoot = process.cwd();
const adminAndShared = [
  ...vueFiles(join(sourceRoot, "admin")),
  ...vueFiles(join(sourceRoot, "shared", "components")),
];

function sourcePath(file: string): string {
  return file.slice(uiRoot.length + 1).replaceAll("\\", "/");
}

describe("admin single-setting controls", () => {
  it("reserves checkbox inputs for multi-select sets", () => {
    const checkboxFiles = adminAndShared
      .filter((file) => readFileSync(file, "utf8").includes("micl-checkbox"))
      .map(sourcePath)
      .sort();

    expect(checkboxFiles).toEqual([...MULTI_SELECT_CHECKBOX_FILES].sort());
  });

  it("gives every MICL switch the role assistive technology announces", () => {
    const offenders: string[] = [];
    for (const file of adminAndShared) {
      const source = readFileSync(file, "utf8");
      for (const input of source.match(SWITCH_INPUT) ?? []) {
        if (!/\brole="switch"/.test(input)) offenders.push(`${sourcePath(file)}: ${input}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("renders the converted settings with switches", () => {
    // Spot-check one view, one repository dialog section and the shared schema
    // form so a regression is reported against a readable file name.
    for (const file of [
      "src/admin/views/AnonymousView.vue",
      "src/admin/views/ScanningView.vue",
      "src/admin/views/RepositoriesView.vue",
      "src/shared/components/M3SchemaForm.vue",
    ]) {
      expect(readFileSync(join(uiRoot, file), "utf8"), file).toContain('class="micl-switch"');
    }
  });
});
