import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WelcomeView from "../browse/views/WelcomeView.vue";
import { FORMAT_ICON_NAMES } from "./repositoryIcons";

// The server enum is the source of truth for the format catalog; reading it here
// keeps the icon mapping honest when a protocol is added. Vitest runs with `ui/`
// as the working directory (see ui/package.json).
const SERVER_FORMAT_SOURCE = readFileSync(
  resolve(
    process.cwd(),
    "..",
    "core",
    "src",
    "main",
    "java",
    "com",
    "github",
    "klboke",
    "kkrepo",
    "core",
    "RepositoryFormat.java",
  ),
  "utf8",
);

function serverFormatIds(): string[] {
  const body = SERVER_FORMAT_SOURCE.slice(
    SERVER_FORMAT_SOURCE.indexOf("public enum RepositoryFormat {"),
    SERVER_FORMAT_SOURCE.indexOf("@JsonCreator"),
  );
  return [...body.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)].map((match) => match[1].toLowerCase());
}

describe("repository format icons", () => {
  it("maps every server repository format to a logo", () => {
    const formats = serverFormatIds();

    expect(formats).toHaveLength(23);
    // Both directions matter: an unmapped format would fall back to the raw
    // glyph, while a stale mapping would hide a removed format.
    expect(new Set(formats)).toEqual(new Set(Object.keys(FORMAT_ICON_NAMES)));
  });
});

describe("welcome view", () => {
  const repositories = [
    { name: "maven-hosted", format: "maven2", type: "hosted", online: true },
    { name: "npm-proxy", format: "npm", type: "proxy", online: false },
    { name: "maven-proxy", format: "maven2", type: "proxy", online: true },
  ];

  it("groups repositories by the format coming from the server", () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    const groups = wrapper.findAll(".kk-format-group h3").map((node) => node.text());
    expect(groups).toEqual(["maven2", "npm"]);
  });

  it("shows the copyable /repository/<repo>/ URL for every repository", () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    const urls = wrapper.findAll(".kk-location code").map((node) => node.text());
    expect(urls).toEqual([
      "/repository/maven-hosted/",
      "/repository/maven-proxy/",
      "/repository/npm-proxy/",
    ]);
  });

  it("opens a repository when its card is selected", async () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    await wrapper.findAll(".kk-repo-card")[0].trigger("click");

    expect(wrapper.emitted("open")).toEqual([["maven-hosted"]]);
  });
});
