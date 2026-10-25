import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORMAT_ICON_NAMES,
  formatIconName,
  formatLogoClass,
  typeIconName,
} from "./repositoryIcons";

const formatsDirectory = resolve(process.cwd(), "src/shared/format-icons/formats");

describe("format logos", () => {
  it("keeps the upstream format-to-logo mapping", () => {
    expect(FORMAT_ICON_NAMES).toMatchObject({
      maven2: "maven",
      npm: "npm",
      docker: "docker",
      alpine: "alpine",
      apt: "apt",
      raw: "raw",
    });
    expect(Object.keys(FORMAT_ICON_NAMES)).toHaveLength(23);
  });

  it("ships an SVG asset for every logo", () => {
    for (const icon of new Set(Object.values(FORMAT_ICON_NAMES))) {
      const file = resolve(formatsDirectory, `${icon}.svg`);
      expect(existsSync(file), `missing ${icon}.svg`).toBe(true);
    }
  });

  it("falls back to the raw logo for unknown formats", () => {
    expect(formatIconName("maven2")).toBe("maven");
    expect(formatIconName("Maven2")).toBe("maven");
    expect(formatIconName("custom")).toBe("raw");
    expect(formatIconName(null)).toBe("raw");
  });

  it("builds the classes the restored stylesheet expects", () => {
    expect(formatLogoClass("docker")).toBe("format-logo format-logo-docker");
    expect(formatLogoClass(undefined)).toBe("format-logo format-logo-raw");
  });

  it("keeps the upstream repository type icons", () => {
    expect(typeIconName("HOSTED")).toBe("inventory_2");
    expect(typeIconName("proxy")).toBe("cloud_download");
    expect(typeIconName("GROUP")).toBe("hub");
    expect(typeIconName(undefined)).toBe("inventory_2");
  });
});
