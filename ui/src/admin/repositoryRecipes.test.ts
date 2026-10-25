import { describe, expect, it } from "vitest";
import {
  buildRecipeOptions,
  filterRecipes,
  findRecipeOption,
  recipeDisplayName,
  recipeTypeLabel,
} from "./repositoryRecipes";

const recipes = [
  { name: "maven2-hosted", format: "maven2", type: "HOSTED" },
  { name: "maven2-proxy", format: "maven2", type: "PROXY" },
  { name: "maven2-group", format: "maven2", type: "GROUP" },
  { name: "npm-hosted", format: "npm", type: "HOSTED" },
  { name: "docker-proxy", format: "docker", type: "PROXY" },
  { name: "alpine-group", format: "alpine", type: "GROUP" },
];

describe("recipe options", () => {
  it("uses the upstream human format names and type labels", () => {
    const options = buildRecipeOptions(recipes);
    expect(options.map((option) => option.displayName)).toEqual([
      "Maven",
      "Maven",
      "Maven",
      "npm",
      "Docker / OCI",
      "Alpine / APK",
    ]);
    expect(findRecipeOption(options, "maven2-group")).toMatchObject({
      displayName: "Maven",
      typeLabel: "Group",
      type: "GROUP",
    });
    expect(findRecipeOption(options, "alpine-group")?.label).toBe("Alpine / APK · Group");
  });

  it("falls back for unknown formats and empty types", () => {
    expect(recipeDisplayName("custom")).toBe("custom");
    expect(recipeDisplayName(null)).toBe("Unknown");
    expect(recipeTypeLabel("proxy")).toBe("Proxy");
    expect(recipeTypeLabel(undefined)).toBe("Unknown");
  });

  it("filters by format name, type badge or recipe id", () => {
    const options = buildRecipeOptions(recipes);
    expect(filterRecipes(options, "maven").map((option) => option.typeLabel)).toEqual([
      "Hosted",
      "Proxy",
      "Group",
    ]);
    expect(filterRecipes(options, "proxy").map((option) => option.value)).toEqual([
      "maven2-proxy",
      "docker-proxy",
    ]);
    expect(filterRecipes(options, "docker-").map((option) => option.value)).toEqual(["docker-proxy"]);
    expect(filterRecipes(options, "")).toHaveLength(recipes.length);
  });

  it("keeps every recipe selectable", () => {
    const options = buildRecipeOptions(recipes);
    expect(options.map((option) => option.value)).toEqual(
      expect.arrayContaining(recipes.map((recipe) => recipe.name)),
    );
  });
});
