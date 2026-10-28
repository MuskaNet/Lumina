import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.restoreAllMocks());

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

  it("shows the absolute client URL for every repository", () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    const urls = wrapper.findAll(".kk-location code").map((node) => node.text());
    expect(urls).toEqual([
      "http://localhost:3000/repository/maven-hosted/",
      "http://localhost:3000/repository/maven-proxy/",
      "http://localhost:3000/repository/npm-proxy/",
    ]);
  });

  it("places each copy link below the unchanged repository summary within its card", () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    for (const card of wrapper.findAll(".kk-repo-card")) {
      const summary = card.find(".kk-repo-card__open");
      const copy = card.find(".kk-repo-card__url");
      expect(summary.find(".material-symbols-outlined").text()).toBe("inventory_2");
      expect(summary.find("strong").exists()).toBe(true);
      expect(summary.find(".kk-secondary").exists()).toBe(true);
      expect(summary.find(".kk-badge").exists()).toBe(true);
      expect(summary.element.parentElement?.nextElementSibling).toBe(copy.element.parentElement);
      expect(card.element.lastElementChild).toBe(copy.element.parentElement);
      expect(copy.find("button").exists()).toBe(false);
    }

    for (const group of wrapper.findAll(".kk-format-group")) {
      expect(group.find("h3").element.nextElementSibling).toBe(group.find(".kk-hint").element);
      expect(group.find(".kk-hint").element.nextElementSibling).toBe(group.find(".kk-repo-grid").element);
    }
    expect(wrapper.find(".kk-welcome-header.kk-empty-state").exists()).toBe(false);
  });

  it("copies only its own repository URL without opening the repository", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const wrapper = mount(WelcomeView, { props: { repositories } });

    await wrapper.find(".kk-repo-card__url").trigger("click");

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/repository/maven-hosted/`);
    expect(wrapper.emitted("open")).toBeUndefined();
  });

  it("opens a repository when its card is selected", async () => {
    const wrapper = mount(WelcomeView, { props: { repositories } });

    await wrapper.findAll(".kk-repo-card__open")[0].trigger("click");

    expect(wrapper.emitted("open")).toEqual([["maven-hosted"]]);
  });
});
