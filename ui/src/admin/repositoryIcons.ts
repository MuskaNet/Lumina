/**
 * Per-format brand logos restored from the upstream console.
 *
 * The logos live in `shared/format-icons/formats/*.svg` and are rendered as
 * masks by `shared/format-icons/format-icons.css`, so the console shows the
 * same Maven/npm/Docker/... marks as the legacy admin and browse UI.
 */
export const FORMAT_ICON_NAMES: Readonly<Record<string, string>> = {
  maven2: "maven",
  npm: "npm",
  pypi: "pypi",
  cargo: "cargo",
  pub: "pub",
  composer: "composer",
  go: "go",
  helm: "helm",
  docker: "docker",
  nuget: "nuget",
  rubygems: "rubygems",
  yum: "yum",
  terraform: "terraform",
  swift: "swift",
  ansiblegalaxy: "ansiblegalaxy",
  conda: "conda",
  conan: "conan",
  apt: "apt",
  alpine: "alpine",
  r: "r",
  huggingface: "huggingface",
  gitlfs: "gitlfs",
  raw: "raw",
};

export function formatIconName(format: unknown): string {
  const normalized = String(format ?? "").trim().toLowerCase();
  return FORMAT_ICON_NAMES[normalized] ?? "raw";
}

/** Classes expected by `shared/format-icons/format-icons.css`. */
export function formatLogoClass(format: unknown): string {
  return `format-logo format-logo-${formatIconName(format)}`;
}

/**
 * Leading table icon kept from the upstream console: package for hosted,
 * cloud-download for proxy, boxes for group repositories.
 */
export const TYPE_ICON_NAMES: Readonly<Record<string, string>> = {
  HOSTED: "inventory_2",
  PROXY: "cloud_download",
  GROUP: "hub",
};

export function typeIconName(type: unknown): string {
  return TYPE_ICON_NAMES[String(type ?? "").trim().toUpperCase()] ?? "inventory_2";
}
