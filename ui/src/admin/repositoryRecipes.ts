/**
 * Recipe option model for the repository dialog.
 *
 * The upstream console shows a searchable combobox with the brand logo, the
 * human format name ("Maven", "Docker / OCI", ...) and the repository type badge
 * instead of the raw `format · TYPE` strings of a native select.
 */
import type { RepositoryRecipeOption } from "./repositoryForm";

export interface RecipeSource {
  recipe?: string;
  name?: string;
  format?: string;
  type?: string;
}

export interface RecipeOption extends RepositoryRecipeOption {
  displayName: string;
  typeLabel: string;
}

/** Human format names, mirroring the upstream console. */
export const FORMAT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  maven2: "Maven",
  npm: "npm",
  pypi: "PyPI",
  cargo: "Cargo / Rust",
  pub: "Dart / Pub",
  composer: "Composer / PHP",
  go: "Go",
  helm: "Helm",
  docker: "Docker / OCI",
  nuget: "NuGet",
  rubygems: "RubyGems",
  yum: "Yum / RPM",
  terraform: "Terraform",
  swift: "Swift",
  ansiblegalaxy: "Ansible Galaxy",
  conda: "Conda",
  conan: "Conan 2",
  apt: "APT / Debian",
  alpine: "Alpine / APK",
  r: "R / CRAN",
  huggingface: "Hugging Face Models",
  gitlfs: "Git LFS",
  raw: "Raw",
};

export function recipeDisplayName(format: unknown): string {
  const normalized = String(format ?? "").trim().toLowerCase();
  return FORMAT_DISPLAY_NAMES[normalized] ?? (normalized || "Unknown");
}

/** "HOSTED" -> "Hosted"; the badge is uppercased by CSS like the upstream UI. */
export function recipeTypeLabel(type: unknown): string {
  const normalized = String(type ?? "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function recipeValue(recipe: RecipeSource): string {
  return String(recipe.recipe ?? recipe.name ?? `${recipe.format}-${recipe.type}`.toLowerCase());
}

export function buildRecipeOptions(recipes: readonly RecipeSource[]): RecipeOption[] {
  // Keep the server's recipe order (the upstream combobox lists Maven first).
  return recipes.map((recipe) => {
    const format = String(recipe.format ?? "").toLowerCase();
    const type = String(recipe.type ?? "").toUpperCase();
    const displayName = recipeDisplayName(format);
    const typeLabel = recipeTypeLabel(type);
    return {
      value: recipeValue(recipe),
      label: `${displayName} · ${typeLabel}`,
      format,
      type,
      displayName,
      typeLabel,
    };
  });
}

/** Case-insensitive search across display name, type badge and recipe id. */
export function filterRecipes(options: readonly RecipeOption[], query: string): RecipeOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter((option) =>
    `${option.displayName} ${option.typeLabel} ${option.format} ${option.value}`
      .toLowerCase()
      .includes(needle),
  );
}

export function findRecipeOption(
  options: readonly RecipeOption[],
  value: string,
): RecipeOption | undefined {
  return options.find((option) => option.value === value);
}
