/**
 * Client usage snippets for the browse detail pane.
 *
 * Ported from the legacy browse console's `usageDetailForEntry` and its
 * per-format builders. The builders are pure: the repository, the advertised
 * absolute URLs and the browse-children loader arrive through `UsageContext`,
 * so the module stays testable without a DOM or network access.
 *
 * Formats that had no snippets in the legacy console (raw, NuGet, RubyGems,
 * Yum, ...) return `null`.
 */
import type {
  AttributeValues,
  BrowseAssetDetail,
  BrowseEntry,
  SummaryRow,
  UsageContext,
  UsageDetail,
  UsageSnippet,
} from "./browseModel";
import { formatBytesDetail } from "./formatters";

const TRAILING_SLASHES = /\/+$/;

/** The legacy console compared the normalized (lower-case) repository format. */
function normalizedFormat(ctx: UsageContext): string {
  return String(ctx.repository.format ?? "").toLowerCase();
}

/** `currentRepository()?.type === "hosted"` — the browse payload lower-cases `type`. */
function isHosted(ctx: UsageContext): boolean {
  return String(ctx.repository.type ?? "").toLowerCase() === "hosted";
}

/** Absolute `/repository/<name>/` base URL without its trailing slash. */
function trimmedBaseUrl(ctx: UsageContext): string {
  return ctx.baseUrl.replace(TRAILING_SLASHES, "");
}

/** Reads a scalar attribute as text; missing or structured values become "". */
function attributeString(values: AttributeValues | null | undefined, key: string): string {
  const value = values?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Like `attributeString` but keeps `null` so `??` defaults stay faithful to the legacy code. */
function attributeNullableString(
  values: AttributeValues | null | undefined,
  key: string,
): string | null {
  const value = values?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Reads an attribute that the legacy console rendered with `formatBytesDetail`. */
function attributeNumber(values: AttributeValues | null | undefined, key: string): number | null {
  const value = values?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function row(label: string, value: string): SummaryRow {
  return { label, value };
}

function usageSnippet(displayName: string, snippetText: string, description = ""): UsageSnippet {
  return { displayName, snippetText, description };
}

function pathSegments(path: string | null | undefined): string[] {
  return (path ?? "").split("/").filter(Boolean);
}

/** Numeric-aware "latest" ordering used by every directory version lookup. */
function latestVersion(versions: ReadonlyArray<string | null | undefined>): string {
  return versions
    .filter((version): version is string => Boolean(version))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
    .at(-1) ?? "";
}

// --- shared coordinate helpers -------------------------------------------

interface GavCoordinates {
  groupId: string;
  artifactId: string;
  version: string;
}

function parseGav(path: string): GavCoordinates | null {
  const segments = pathSegments(path);
  if (segments.length < 2) return null;
  return {
    groupId: segments.slice(0, -2).join("."),
    artifactId: segments.at(-2) ?? "",
    version: segments.at(-1) ?? "",
  };
}

// --- maven2 ---------------------------------------------------------------

function mavenUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const gav = parseGav(entry.path);
  if (!gav) return null;
  const { groupId, artifactId, version } = gav;
  const mavenSnippet = `<dependency>
    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>${version}</version>
</dependency>`;
  const gradleSnippet = `implementation '${groupId}:${artifactId}:${version}'`;
  const gradleKtsSnippet = `implementation("${groupId}:${artifactId}:${version}")`;
  const sbtSnippet = `libraryDependencies += "${groupId}" % "${artifactId}" % "${version}"`;
  const ivySnippet = `<dependency org="${groupId}" name="${artifactId}" rev="${version}" />`;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "maven2"),
      row("Group", groupId),
      row("Name", artifactId),
      row("Version", version),
      row("Most popular version", ""),
      row("Age", ""),
      row("Popularity", ""),
    ],
    snippets: [
      usageSnippet("Apache Maven", mavenSnippet, "Insert this snippet into your pom.xml"),
      usageSnippet("Gradle Groovy DSL", gradleSnippet, "Add to dependencies { } in build.gradle"),
      usageSnippet("Gradle Kotlin DSL", gradleKtsSnippet, "Add to dependencies { } in build.gradle.kts"),
      usageSnippet("Apache Ivy", ivySnippet, "Insert into ivy.xml <dependencies>"),
      usageSnippet("sbt", sbtSnippet, "Add to build.sbt"),
    ],
  };
}

// --- pypi -----------------------------------------------------------------

async function pypiUsageDetail(ctx: UsageContext, entry: BrowseEntry): Promise<UsageDetail | null> {
  const parts = pathSegments(entry.path);
  if (!parts.length || parts[0] === "simple") return null;
  const name = parts[0];
  const children = !entry.leaf && parts.length === 1 ? await ctx.fetchChildren(entry.path) : [];
  const version = parts[1] || latestVersion(children.filter((child) => !child.leaf).map((child) => child.name));
  const pin = version ? `${name}==${version}` : name;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "pypi"),
      row("Name", name),
      row("Version", version || "latest"),
      row("Most popular version", ""),
      row("Age", ""),
      row("Popularity", ""),
    ],
    snippets: [
      usageSnippet("pip", `pip install ${pin}`),
      usageSnippet("easy_install", `easy_install ${pin}`),
      usageSnippet("pipenv", `pipenv install ${pin}`),
      usageSnippet("requirements.txt", version ? `${name} == ${version}` : name),
    ],
  };
}

// --- npm ------------------------------------------------------------------

function npmPackageName(path: string): string {
  const clean = (path || "").split("/-/")[0];
  const parts = pathSegments(clean);
  if (!parts.length) return "";
  if (parts[0].startsWith("@")) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "";
  }
  return parts[0];
}

function npmVersionFromTarball(path: string, packageName: string): string {
  const filename = pathSegments(path).at(-1) || "";
  if (!filename.endsWith(".tgz")) return "";
  const base = filename.slice(0, -4);
  const packageBase = pathSegments(packageName).at(-1) || packageName;
  const prefix = `${packageBase}-`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : "";
}

async function npmUsageDetail(ctx: UsageContext, entry: BrowseEntry): Promise<UsageDetail | null> {
  const name = npmPackageName(entry.path);
  if (!name) return null;
  let version = npmVersionFromTarball(entry.path, name);
  if (!version && !entry.leaf) {
    const children = await ctx.fetchChildren(name);
    version = latestVersion(children
      .filter((child) => child.leaf)
      .map((child) => npmVersionFromTarball(child.path, name)));
  }
  const installTarget = version ? `${name}@${version}` : name;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "npm"),
      row("Name", name),
      row("Version", version || "latest"),
      row("Most popular version", ""),
      row("Age", ""),
      row("Popularity", ""),
    ],
    snippets: [
      usageSnippet("npm", `npm install ${installTarget}`, "Install runtime dependency"),
      usageSnippet("Yarn", `yarn add ${installTarget}`, "Install runtime dependency"),
      usageSnippet("package.json", `"${name}": "${version || "latest"}"`,
        "Install runtime dependency to the package.json dependencies section"),
    ],
  };
}

// --- cargo ----------------------------------------------------------------

interface CargoCoordinates {
  name: string;
  version: string;
}

function cargoVersionFromCrateFile(filename: string, crateName: string): string {
  if (!filename || !filename.endsWith(".crate")) return "";
  const base = filename.slice(0, -".crate".length);
  const prefix = `${crateName}-`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : "";
}

function cargoIndexPathForCrate(crateName: string): string {
  const name = String(crateName || "").toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(name)) return "";
  if (name.length === 1) return `1/${name}`;
  if (name.length === 2) return `2/${name}`;
  if (name.length === 3) return `3/${name[0]}/${name}`;
  return `${name.slice(0, 2)}/${name.slice(2, 4)}/${name}`;
}

function cargoCoordinates(entry: BrowseEntry): CargoCoordinates {
  const parts = pathSegments(entry.path);
  if (!parts.length || parts[0] === "config.json") {
    return { name: "", version: "" };
  }
  if (parts[0] === "crates" && parts.length >= 2) {
    const name = parts[1] || "";
    let version = parts[2] || "";
    const file = parts.at(-1) || "";
    if (!version && file.endsWith(".crate")) {
      version = cargoVersionFromCrateFile(file, name);
    }
    return { name, version };
  }
  if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "crates") {
    return { name: parts[3] || "", version: parts[4] || "" };
  }
  const leaf = parts.at(-1) || "";
  return parts.join("/") === cargoIndexPathForCrate(leaf)
    ? { name: leaf, version: "" }
    : { name: "", version: "" };
}

function cargoSourceName(repoName: string): string {
  return (repoName || "kkrepo")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "kkrepo";
}

function tomlString(value: string): string {
  return `"${String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function cargoSourceTable(sourceName: string): string {
  return /^[A-Za-z0-9_-]+$/.test(sourceName) ? sourceName : tomlString(sourceName);
}

async function latestCargoVersion(ctx: UsageContext, cratePath: string): Promise<string> {
  try {
    const children = await ctx.fetchChildren(cratePath);
    return latestVersion(children
      .filter((child) => !child.leaf)
      .map((child) => child.name));
  } catch {
    return "";
  }
}

async function cargoUsageDetail(ctx: UsageContext, entry: BrowseEntry): Promise<UsageDetail | null> {
  const coordinates = cargoCoordinates(entry);
  if (!coordinates.name) return null;
  const name = coordinates.name;
  const cratePath = `crates/${name}`;
  const version = coordinates.version || (!entry.leaf && entry.path === cratePath
    ? await latestCargoVersion(ctx, cratePath)
    : "");
  const sourceName = cargoSourceName(ctx.repository.name);
  const sourceTable = cargoSourceTable(sourceName);
  const repoUrl = ctx.baseUrl;
  const registryUrl = `sparse+${repoUrl}`;
  const addTarget = version ? `${name}@${version}` : name;
  const dependency = version ? `${name} = "${version}"` : `${name} = "*"`;
  const alternateDependency = version
    ? `${name} = { version = "${version}", registry = "${sourceName}" }`
    : `${name} = { version = "*", registry = "${sourceName}" }`;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "cargo"),
      row("Name", name),
      row("Version", version || "latest"),
      row("Registry URL", repoUrl),
    ],
    snippets: [
      usageSnippet(".cargo/config.toml", `[source.crates-io]
replace-with = "${sourceName}"

[source.${sourceTable}]
registry = "${registryUrl}"`, "Route crates.io dependencies through this repository"),
      usageSnippet("cargo add", `cargo add ${addTarget}`),
      usageSnippet("Cargo.toml", dependency),
      usageSnippet("Named registry config", `[registries.${sourceTable}]
index = "${registryUrl}"`, "Add to .cargo/config.toml when using this repository as an explicit registry"),
      usageSnippet("Cargo.toml registry", alternateDependency),
    ],
  };
}

// --- helm -----------------------------------------------------------------

function helmChartFromAsset(name: string): { name: string; version: string } | null {
  if (!/\.t(?:ar\.)?gz$/i.test(name || "")) return null;
  const base = name.replace(/\.t(?:ar\.)?gz$/i, "");
  const match = base.match(/^(.+)-((?:v)?\d.*)$/);
  if (!match) return null;
  return { name: match[1], version: match[2] };
}

function releaseName(chartName: string): string {
  return (chartName || "release").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "release";
}

function helmUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const chart = helmChartFromAsset(entry.name);
  if (!chart) return null;
  const repoUrl = ctx.baseUrl;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "helm"),
      row("Name", chart.name),
      row("Version", chart.version),
      row("Repository URL", repoUrl),
    ],
    snippets: [
      usageSnippet("helm repo add", `helm repo add ${ctx.repository.name} ${repoUrl}`),
      usageSnippet("helm install", `helm install ${releaseName(chart.name)} ${chart.name} --repo ${repoUrl} --version ${chart.version}`),
      usageSnippet("Chart.yaml", `dependencies:
  - name: ${chart.name}
    version: ${chart.version}
    repository: ${repoUrl}`),
    ],
  };
}

// --- go -------------------------------------------------------------------

function goModulePath(path: string | null | undefined): string {
  const value = path ?? "";
  const marker = "/@v/";
  if (value.includes(marker)) return value.slice(0, value.indexOf(marker));
  if (value.endsWith("/@latest")) return value.slice(0, -"/@latest".length);
  const parts = pathSegments(value);
  if (parts.length < 2 || parts.includes("@v")) return "";
  return parts.join("/");
}

function goVersionFromPath(path: string | null | undefined): string {
  const filename = pathSegments(path).at(-1) || "";
  const match = filename.match(/^(v[^/]+)\.(?:info|mod|zip)$/);
  return match ? match[1] : "";
}

async function latestGoVersion(ctx: UsageContext, modulePath: string): Promise<string> {
  try {
    const children = await ctx.fetchChildren(`${modulePath}/@v`);
    return latestVersion(children.map((child) => goVersionFromPath(child.path)));
  } catch {
    return "";
  }
}

async function goUsageDetail(ctx: UsageContext, entry: BrowseEntry): Promise<UsageDetail | null> {
  const modulePath = goModulePath(entry.path);
  if (!modulePath) return null;
  const version = goVersionFromPath(entry.path) || await latestGoVersion(ctx, modulePath);
  const repoUrl = ctx.baseUrl;
  const target = `${modulePath}@${version || "latest"}`;
  const snippets = [
    usageSnippet("go get", `GOPROXY=${repoUrl} go get ${target}`),
    usageSnippet("go env", `go env -w GOPROXY=${repoUrl},direct`),
  ];
  if (version) {
    snippets.push(usageSnippet("go.mod", `require ${modulePath} ${version}`));
  }
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "go"),
      row("Name", modulePath),
      row("Version", version || "latest"),
      row("Repository URL", repoUrl),
    ],
    snippets,
  };
}

// --- pub ------------------------------------------------------------------

function pubVersionFromArchiveFile(filename: string, packageName: string): string {
  if (!filename || !filename.endsWith(".tar.gz")) return "";
  const base = filename.slice(0, -".tar.gz".length);
  const prefix = `${packageName}-`;
  if (base.startsWith(prefix)) return base.slice(prefix.length);
  return base === packageName ? "" : base;
}

function pubCoordinates(entry: BrowseEntry): { name: string; version: string } {
  const parts = pathSegments(entry.path);
  if (!parts.length) return { name: "", version: "" };
  if (parts[0] === "packages") {
    const name = parts[1] || "";
    if (parts[2] !== "versions") return { name, version: "" };
    const file = parts[3] || "";
    return { name, version: file.endsWith(".tar.gz") ? file.slice(0, -".tar.gz".length) : "" };
  }
  if (parts[0] === "api" && parts[1] === "archives") {
    const file = parts[2] || "";
    const base = file.endsWith(".tar.gz") ? file.slice(0, -".tar.gz".length) : "";
    const separator = base.indexOf("-");
    return separator > 0 ? { name: base.slice(0, separator), version: base.slice(separator + 1) } : { name: "", version: "" };
  }
  const name = parts[0] || "";
  if (!name || name === "api") return { name: "", version: "" };
  const version = parts[1] || "";
  const file = parts[2] || "";
  if (file === "version.json") return { name, version };
  if (file.endsWith(".tar.gz")) return { name, version: pubVersionFromArchiveFile(file, name) || version };
  return { name, version: parts.length >= 2 ? version : "" };
}

async function latestPubVersion(ctx: UsageContext, entry: BrowseEntry, packageName: string): Promise<string> {
  const parts = pathSegments(entry.path);
  const candidates: string[] = [];
  if (parts[0] === "packages" && packageName) {
    candidates.push(`packages/${packageName}/versions`);
  }
  if (parts.length === 1 && packageName) {
    candidates.push(packageName);
  }
  if (parts.length === 2 && parts[0] === packageName) {
    return parts[1] || "";
  }
  for (const path of candidates) {
    try {
      const children = await ctx.fetchChildren(path);
      const versions = children.map((child) => {
        if (child.leaf) return pubCoordinates(child).version;
        return child.name;
      });
      const latest = latestVersion(versions);
      if (latest) return latest;
    } catch {
      // Leave version blank when browse children are unavailable.
    }
  }
  return "";
}

async function pubUsageDetail(ctx: UsageContext, entry: BrowseEntry): Promise<UsageDetail | null> {
  const coordinates = pubCoordinates(entry);
  if (!coordinates.name) return null;
  const name = coordinates.name;
  const version = coordinates.version || (!entry.leaf ? await latestPubVersion(ctx, entry, name) : "");
  const repoUrl = ctx.baseUrl;
  const dependencyVersion = version || "any";
  const addTarget = version ? `${name}:${version}` : name;
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "pub"),
      row("Name", name),
      row("Version", version || "latest"),
      row("Repository URL", repoUrl),
    ],
    snippets: [
      usageSnippet("pubspec.yaml", `dependencies:
  ${name}:
    hosted:
      url: ${repoUrl}
      name: ${name}
    version: ${dependencyVersion}`, "Declare a dependency from this hosted Pub repository"),
      usageSnippet("dart pub add", `dart pub add ${addTarget} --hosted-url ${repoUrl}`),
      usageSnippet("PUB_HOSTED_URL", `PUB_HOSTED_URL=${repoUrl} dart pub get`),
      usageSnippet("publish_to", `publish_to: ${repoUrl}`),
    ],
  };
}

// --- composer -------------------------------------------------------------

function composerCoordinates(entry: BrowseEntry, detail?: BrowseAssetDetail | null): { name: string; version: string } {
  const composer = detail?.composer;
  const nameFromDetail = attributeString(composer, "package_name");
  let version = attributeString(composer, "version");
  let name = nameFromDetail;
  const parts = pathSegments(entry.path);
  if (!name) {
    if (parts[0] === "p2" && parts.length >= 3) {
      const file = parts.at(-1) || "";
      const packageLeaf = file.replace(/~dev\.json$|\.json$/, "");
      name = `${parts.slice(1, -1).join("/")}/${packageLeaf}`;
    } else if (parts.length >= 2 && !["p2", "providers", "packages", "_composer"].includes(parts[0])) {
      name = `${parts[0]}/${parts[1]}`;
      if (!version && parts.length >= 3) version = parts[2];
    }
  }
  return { name, version };
}

function composerRepositoryKey(repoName: string): string {
  return String(repoName || "kkrepo").replace(/[^A-Za-z0-9_.-]+/g, "-") || "kkrepo";
}

function composerUsageDetail(ctx: UsageContext, entry: BrowseEntry, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const coordinates = composerCoordinates(entry, detail);
  if (!coordinates.name) return null;
  const repoUrl = ctx.baseUrl;
  const requirement = coordinates.version
    ? `${coordinates.name}:${coordinates.version}`
    : coordinates.name;
  const constraint = coordinates.version || "*";
  const repositoryKey = composerRepositoryKey(ctx.repository.name);
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "composer"),
      row("Name", coordinates.name),
      row("Version", coordinates.version || "latest"),
      row("Repository URL", repoUrl),
    ],
    snippets: [
      usageSnippet("composer require", `composer require ${requirement}`, "Install this package"),
      usageSnippet("composer config", `composer config repositories.${repositoryKey} composer ${repoUrl}`,
        "Add this repository to the current project"),
      usageSnippet("composer.json", `"repositories": [
  {"type": "composer", "url": "${repoUrl}"}
],
"require": {
  "${coordinates.name}": "${constraint}"
}`, "Add the repository and dependency to composer.json"),
    ],
  };
}

// --- docker ---------------------------------------------------------------

interface DockerCoordinates {
  image: string;
  reference: string;
  digest: string;
}

function imageNameFromDockerPath(path: string): string {
  const parts = pathSegments(path);
  const manifests = parts.lastIndexOf("manifests");
  if (manifests > 0) {
    const start = parts[0] === "v2" ? 1 : parts[0] === "docker" && parts[1] === "manifests" ? 2 : 0;
    return parts.slice(start, manifests).join("/");
  }
  const blobs = parts.lastIndexOf("blobs");
  if (blobs > 0) {
    const start = parts[0] === "v2" ? 1 : 0;
    return parts.slice(start, blobs).join("/");
  }
  return "";
}

function dockerTagFromDockerPath(path: string): string {
  const parts = pathSegments(path);
  const manifests = parts.lastIndexOf("manifests");
  if (manifests >= 0 && parts[manifests + 1]) {
    const reference = parts[manifests + 1];
    return reference.includes(":") ? "" : reference;
  }
  return "";
}

/**
 * Registry host part of the image reference, following the legacy
 * `dockerImageReferenceBase`: connector public URL first, then the connector
 * port, then the shared connector-less `<host>/<repository>` path.
 *
 * The legacy connector-port branch used `window.location.hostname`; the usage
 * context only carries the full `host` (with port), so a trailing `:port` is
 * stripped to keep the generated reference valid.
 */
function dockerImageReferenceBase(ctx: UsageContext): string {
  const docker = ctx.repository.docker ?? {};
  if (docker.connectorEnabled && docker.connectorPublicUrl) {
    const value = docker.connectorPublicUrl.trim();
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value
        : value.startsWith("//") ? `${ctx.protocol}${value}` : `https://${value}`);
      if (url.host && !url.username && !url.password) {
        return `${url.host}${url.pathname.replace(TRAILING_SLASHES, "").replace(/\/v2$/, "")}`;
      }
    } catch {
      // Old saved configurations may contain an invalid public URL; retain usable routing below.
    }
  }
  if (docker.connectorEnabled && docker.connectorPort) {
    return `${ctx.host.replace(/:\d+$/, "")}:${docker.connectorPort}`;
  }
  return `${ctx.host}/${ctx.repository.name}`;
}

function dockerCoordinates(entry: BrowseEntry, detail?: BrowseAssetDetail | null): DockerCoordinates {
  const docker = detail?.docker;
  const image = attributeString(docker, "image_name") || imageNameFromDockerPath(entry.path);
  const reference = attributeString(docker, "reference") || dockerTagFromDockerPath(entry.path) || "latest";
  return {
    image,
    reference,
    digest: attributeString(docker, "digest") || attributeString(docker, "raw_bytes_digest"),
  };
}

function dockerUsageDetail(ctx: UsageContext, entry: BrowseEntry, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const { image, reference, digest } = dockerCoordinates(entry, detail);
  if (!image) return null;
  const base = dockerImageReferenceBase(ctx);
  const byTag = `${base}/${image}:${reference || "latest"}`;
  const snippets = [
    usageSnippet("docker pull", `docker pull ${byTag}`),
    usageSnippet("docker tag", `docker tag ${image}:${reference || "latest"} ${byTag}`),
    usageSnippet("docker push", `docker push ${byTag}`),
  ];
  if (digest) {
    snippets.push(usageSnippet("docker pull digest", `docker pull ${base}/${image}@${digest}`));
  }
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "docker"),
      row("Image", image),
      row("Reference", reference || digest || "-"),
      row("Digest", digest || "-"),
      row("Registry URL", base),
    ],
    snippets,
  };
}

// --- terraform ------------------------------------------------------------

function terraformUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const parts = pathSegments(entry.path);
  if (parts[0] !== "v1") return null;
  const repoUrl = trimmedBaseUrl(ctx);
  const host = ctx.host;
  const section = parts[1] || "";
  const isModule = section === "modules";
  const isProvider = section === "providers";
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "terraform"),
    row("Path", entry.path),
    row("Scope", isModule ? "Terraform modules" : isProvider ? "Terraform providers" : "Terraform registry"),
  ];
  const snippets: UsageSnippet[] = [];

  if (isModule) {
    const [namespace, name, system, version] = parts.slice(2, 6);
    if (namespace) summaryRows.push(row("Namespace", namespace));
    if (name) summaryRows.push(row("Name", name));
    if (system) summaryRows.push(row("System", system));
    if (version) summaryRows.push(row("Version", version));
    snippets.push(usageSnippet(
      "Terraform CLI config",
      `host "${host}" {\n  services = {\n    "modules.v1" = "${repoUrl}/v1/modules/"\n  }\n}`,
    ));
    if (namespace && name && system) {
      snippets.push(usageSnippet(
        "module",
        `module "${name}" {\n  source  = "${host}/${namespace}/${name}/${system}"\n  version = "${version || "latest"}"\n}`,
      ));
    }
  } else if (isProvider) {
    const [namespace, type, version] = parts.slice(2, 5);
    if (namespace) summaryRows.push(row("Namespace", namespace));
    if (type) summaryRows.push(row("Type", type));
    if (version) summaryRows.push(row("Version", version));
    snippets.push(usageSnippet(
      "Terraform CLI config",
      `host "${host}" {\n  services = {\n    "providers.v1" = "${repoUrl}/v1/providers/"\n  }\n}`,
    ));
    if (namespace && type) {
      snippets.push(usageSnippet(
        "required_providers",
        `terraform {\n  required_providers {\n    ${type} = {\n      source  = "${host}/${namespace}/${type}"\n      version = "${version || "latest"}"\n    }\n  }\n}`,
      ));
    }
  } else if (section) {
    summaryRows.push(row("Scope", `Terraform path: ${section}`));
  } else {
    snippets.push(usageSnippet(
      "Terraform CLI config",
      `host "${host}" {\n  services = {\n    "modules.v1" = "${repoUrl}/v1/modules/"\n    "providers.v1" = "${repoUrl}/v1/providers/"\n  }\n}`,
    ));
  }

  return { summaryRows, snippets };
}

// --- swift ----------------------------------------------------------------

function swiftUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const parts = pathSegments(entry.path);
  const scope = parts[0] || "";
  const name = parts[1] || "";
  const rawVersion = parts[2] || "";
  const archiveAsset = entry.leaf === true && parts.length === 3;
  const version = archiveAsset && rawVersion.endsWith(".zip")
    ? rawVersion.slice(0, -4)
    : rawVersion;
  const identity = scope && name ? `${scope}.${name}` : "";
  const repoUrl = ctx.baseUrl;
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "swift"),
    row("Scope", scope || "-"),
    row("Name", name || "-"),
    row("Version", version || "latest"),
    row("Registry URL", repoUrl),
  ];
  const snippets: UsageSnippet[] = [
    usageSnippet("Configure registry", `swift package-registry set "${repoUrl}"`),
    usageSnippet("Login", `swift package-registry login "${repoUrl}" --username <username>`),
    usageSnippet(
      "registries.json",
      JSON.stringify({
        registries: {
          "[default]": {
            url: repoUrl,
            supportsAvailability: false,
          },
        },
        version: 1,
      }, null, 2),
      "Nexus-compatible Swift registry configuration",
    ),
  ];
  if (identity) {
    snippets.push(usageSnippet(
      "Package.swift",
      `.package(id: "${identity}", from: "${version || "1.0.0"}")`,
      "Declare a registry identity dependency",
    ));
  }
  if (isHosted(ctx) && identity && version) {
    snippets.push(usageSnippet(
      "Publish",
      `swift package-registry publish ${identity} ${version}`,
      "Publishes the source archive through the configured registry",
    ));
  }
  if (ctx.protocol !== "https:") {
    summaryRows.push(row("Transport warning", "Use HTTPS in production for credentials and archive integrity"));
  }
  return { summaryRows, snippets };
}

// --- ansible galaxy -------------------------------------------------------

function ansibleGalaxyUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const parts = pathSegments(entry.path);
  const namespace = parts[0] || "";
  const name = parts[1] || "";
  const rawVersion = parts[2] || "";
  const version = rawVersion.endsWith(".tar.gz") ? rawVersion.slice(0, -7) : rawVersion;
  const collection = namespace && name ? `${namespace}.${name}` : "namespace.collection";
  const repoUrl = ctx.baseUrl;
  const serverName = String(ctx.repository.name || "kkrepo").replace(/[^A-Za-z0-9_]/g, "_");
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "ansiblegalaxy"),
    row("Collection", namespace && name ? collection : "-"),
    row("Version", version || "latest"),
    row("Galaxy server URL", repoUrl),
  ];
  const snippets: UsageSnippet[] = [
    usageSnippet(
      "ansible.cfg",
      `[galaxy]\nserver_list = ${serverName}\n\n[galaxy_server.${serverName}]\nurl = ${repoUrl}\ntoken = GenericToken.<token>`,
      "Use a GenericToken/API key in preference to a reusable password",
    ),
    usageSnippet(
      "requirements.yml",
      `collections:\n  - name: ${collection}\n    version: "${version || ">=1.0.0"}"\n    source: ${repoUrl}`,
    ),
    usageSnippet(
      "Install",
      `ansible-galaxy collection install ${collection}${version ? `:${version}` : ""} --server ${repoUrl}`,
    ),
  ];
  if (isHosted(ctx)) {
    snippets.push(usageSnippet(
      "Publish",
      `ansible-galaxy collection publish ${namespace || "namespace"}-${name || "collection"}-${version || "1.0.0"}.tar.gz --server ${repoUrl}`,
      "The archive filename and MANIFEST.json identity must match",
    ));
  }
  if (ctx.protocol !== "https:") {
    summaryRows.push(row("Transport warning", "Use HTTPS in production for Galaxy credentials"));
  }
  return { summaryRows, snippets };
}

// --- conda ----------------------------------------------------------------

function condaUsageDetail(ctx: UsageContext, entry: BrowseEntry, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const metadata = detail?.conda;
  const parts = pathSegments(entry.path);
  const logicalPackage = parts.length >= 5;
  const subdirIndex = logicalPackage ? parts.length - 5 : -1;
  const channel = attributeNullableString(metadata, "channel")
    ?? (subdirIndex > 0 ? parts.slice(0, subdirIndex).join("/") : "");
  const subdir = attributeString(metadata, "subdir") || (subdirIndex >= 0 ? parts[subdirIndex] : "");
  const name = attributeString(metadata, "name") || (logicalPackage ? parts[parts.length - 4] : "");
  const version = attributeString(metadata, "version") || (logicalPackage ? parts[parts.length - 3] : "");
  const build = attributeString(metadata, "build") || (logicalPackage ? parts[parts.length - 2] : "");
  const filename = attributeString(metadata, "filename") || (entry.leaf ? parts[parts.length - 1] : "");
  const repositoryUrl = trimmedBaseUrl(ctx);
  const channelUrl = channel ? `${repositoryUrl}/${channel}` : repositoryUrl;
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "conda"),
    row("Channel", channel || "root"),
    row("Subdir", subdir || "-"),
    row("Package", name || "-"),
    row("Version", version || "-"),
    row("Build", build || "-"),
    row("Channel URL", channelUrl),
  ];
  const snippets: UsageSnippet[] = [
    usageSnippet(
      ".condarc",
      `channels:\n  - ${channelUrl}\nchannel_priority: strict`,
      "Use an API key or scoped token through .netrc when authentication is required",
    ),
    usageSnippet(
      "Search",
      `conda search --override-channels -c ${channelUrl} ${name || "<package>"}`,
    ),
    usageSnippet(
      "Install",
      `conda install --override-channels -c ${channelUrl} ${name || "<package>"}${version ? `=${version}` : ""}`,
    ),
  ];
  if (isHosted(ctx) && filename && subdir) {
    const packageUrl = `${channelUrl}/${subdir}/${filename}`;
    snippets.push(usageSnippet(
      "Publish",
      `curl --fail --user '<username>:<token>' --upload-file '${filename}' '${packageUrl}'`,
      "The archive identity and URL subdir are validated before publication",
    ));
  }
  const sha256 = attributeString(metadata, "sha256");
  if (sha256) summaryRows.push(row("SHA-256", sha256));
  const size = attributeNumber(metadata, "size");
  if (size != null) summaryRows.push(row("Size", formatBytesDetail(size)));
  return { summaryRows, snippets };
}

// --- conan ----------------------------------------------------------------

function conanUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail | null {
  const parts = pathSegments(entry.path);
  const user = parts[0] || "_";
  const name = parts[1] || "";
  const version = parts[2] || "";
  const revisionSegment = parts[3] || "";
  const revisionSeparator = revisionSegment.lastIndexOf("#");
  const channel = revisionSeparator >= 0
    ? revisionSegment.slice(0, revisionSeparator)
    : revisionSegment;
  const rrev = revisionSeparator >= 0
    ? revisionSegment.slice(revisionSeparator + 1)
    : "";
  const packagesIndex = parts.indexOf("packages", 4);
  const packageId = packagesIndex >= 0 ? parts[packagesIndex + 1] || "" : "";
  const packageRevisionsIndex = packagesIndex >= 0
    ? parts.indexOf("revisions", packagesIndex + 2)
    : -1;
  const prev = packageRevisionsIndex >= 0 ? parts[packageRevisionsIndex + 1] || "" : "";
  const recipe = name && version
    ? `${name}/${version}${user !== "_" ? `@${user}${channel !== "_" ? `/${channel}` : ""}` : ""}`
    : "<name>/<version>";
  const recipeRevision = `${recipe}${rrev ? `#${rrev}` : ""}`;
  const packageReference = packageId
    ? `${recipeRevision}:${packageId}${prev ? `#${prev}` : ""}`
    : recipeRevision;
  const repositoryUrl = trimmedBaseUrl(ctx);
  const remoteName = String(ctx.repository.name || "kkrepo").replace(/[^A-Za-z0-9_-]/g, "-");
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "conan"),
    row("Recipe", recipe),
    row("RREV", rrev || "-"),
    row("Package ID", packageId || "-"),
    row("PREV", prev || "-"),
    row("Remote URL", repositoryUrl),
  ];
  const snippets: UsageSnippet[] = [
    usageSnippet(
      "Configure remote",
      `conan remote add ${remoteName} '${repositoryUrl}' --force`,
    ),
    usageSnippet(
      "Login",
      `conan remote login ${remoteName} '<username>' -p '<password-or-token>'`,
      "Use a scoped CI/API credential and do not place credentials in the repository URL",
    ),
    usageSnippet("List", `conan list '${packageReference}${packageId ? "" : ":*"}' -r=${remoteName}`),
    usageSnippet("Download", `conan download '${packageReference}${packageId ? "" : ":*"}' -r=${remoteName}`),
    usageSnippet("Install", `conan install --requires='${recipe}' -r=${remoteName}`),
  ];
  if (isHosted(ctx) && name && version) {
    snippets.push(usageSnippet(
      "Publish",
      `conan upload '${recipe}:*' -r=${remoteName} --confirm`,
      "The server commits each recipe or package revision only when its manifest arrives",
    ));
  }
  return { summaryRows, snippets };
}

// --- apt ------------------------------------------------------------------

function aptUsageDetail(ctx: UsageContext, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const metadata = detail?.apt;
  const settings = ctx.repository.apt ?? {};
  const distribution = attributeString(metadata, "distribution") || settings.distribution || "stable";
  const component = attributeString(metadata, "component") || settings.component || "main";
  const architecture = attributeString(metadata, "architecture") || "-";
  const packageName = attributeString(metadata, "package") || attributeString(metadata, "name") || "<package>";
  const version = attributeString(metadata, "version");
  const repositoryUrl = trimmedBaseUrl(ctx);
  const keyring = `/etc/apt/keyrings/${ctx.repository.name}.gpg`;
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "apt"),
    row("Distribution", distribution || "multi-distribution proxy"),
    row("Component", component),
    row("Package", packageName),
    row("Version", version || "-"),
    row("Architecture", architecture),
  ];
  const sourcePackage = attributeString(metadata, "sourcePackage");
  if (sourcePackage) summaryRows.push(row("Source package", sourcePackage));
  const section = attributeString(metadata, "section");
  if (section) summaryRows.push(row("Section", section));
  const priority = attributeString(metadata, "priority");
  if (priority) summaryRows.push(row("Priority", priority));
  const sha256 = attributeString(metadata, "sha256");
  if (sha256) summaryRows.push(row("SHA-256", sha256));
  const snippets: UsageSnippet[] = [
    usageSnippet(
      "Scoped keyring",
      `curl --fail '${repositoryUrl}/gpg.key' | gpg --dearmor | sudo tee '${keyring}' >/dev/null`,
      "For private repositories, place credentials in /etc/apt/auth.conf.d instead of the URL",
    ),
    usageSnippet(
      "sources.list.d",
      `deb [signed-by=${keyring}] ${repositoryUrl} ${distribution || "<distribution>"} ${component}`,
    ),
    usageSnippet("Update", "sudo apt-get update"),
    usageSnippet(
      "Install",
      `sudo apt-get install '${packageName}${version ? `=${version}` : ""}'`,
    ),
  ];
  if (isHosted(ctx)) {
    snippets.push(usageSnippet(
      "Publish",
      `curl --fail --user '<username>:<token>' -F 'apt.asset=@package.deb' '${ctx.origin}/service/rest/v1/components?repository=${encodeURIComponent(ctx.repository.name)}'`,
      "Package identity and canonical pool path are read from the .deb control archive",
    ));
  }
  return { summaryRows, snippets };
}

// --- alpine ---------------------------------------------------------------

function alpineUsageDetail(ctx: UsageContext, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const metadata = detail?.alpine;
  const settings = ctx.repository.alpine ?? {};
  const distribution = attributeString(metadata, "distribution") || settings.distributions?.[0] || "v3.23";
  const channel = attributeString(metadata, "channel") || settings.channels?.[0] || "main";
  const repositoryArchitecture = attributeString(metadata, "repository_architecture")
    || settings.architectures?.[0] || "x86_64";
  const packageName = attributeString(metadata, "package") || "<package>";
  const version = attributeString(metadata, "version");
  const repositoryUrl = `${trimmedBaseUrl(ctx)}/${distribution}/${channel}`;
  const keyFilename = settings.keyFilename || `${ctx.repository.name}.rsa.pub`;
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "alpine"),
    row("Distribution", distribution),
    row("Channel", channel),
    row("Repository architecture", repositoryArchitecture),
    row("Package", packageName),
    row("Version", version || "-"),
    row("Package architecture", attributeString(metadata, "package_architecture") || "-"),
  ];
  const identity = attributeString(metadata, "identity");
  if (identity) summaryRows.push(row("APK identity", identity));
  const sha256 = attributeString(metadata, "sha256");
  if (sha256) summaryRows.push(row("SHA-256", sha256));
  const snippets: UsageSnippet[] = [
    usageSnippet(
      "Trust key",
      `sudo cp '/path/to/${keyFilename}' '/etc/apk/keys/${keyFilename}'`,
      "An administrator can export the scoped public key from the repository settings",
    ),
    usageSnippet(
      "repositories",
      `echo '${repositoryUrl}' | sudo tee -a /etc/apk/repositories`,
      "For private repositories, use an apk-compatible Basic/token credential source; do not commit credentials in URLs",
    ),
    usageSnippet("Update", "sudo apk update"),
    usageSnippet(
      "Install",
      `sudo apk add '${packageName}${version ? `=${version}` : ""}'`,
    ),
    usageSnippet(
      "Fetch",
      `apk fetch --repository '${repositoryUrl}' '${packageName}${version ? `=${version}` : ""}'`,
    ),
  ];
  if (isHosted(ctx)) {
    snippets.push(usageSnippet(
      "Publish",
      `curl --fail --user '<username>:<token>' -F 'alpine.distribution=${distribution}' -F 'alpine.channel=${channel}' -F 'alpine.repositoryArchitecture=${repositoryArchitecture}' -F 'alpine.asset=@package.apk' '${ctx.origin}/service/rest/v1/components?repository=${encodeURIComponent(ctx.repository.name)}'`,
      "The server validates APK v2 members, .PKGINFO, filename, architecture, datahash, and package identity",
    ));
  }
  return { summaryRows, snippets };
}

// --- r --------------------------------------------------------------------

function rUsageDetail(ctx: UsageContext, entry: BrowseEntry, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const metadata = detail?.r;
  const repositoryUrl = trimmedBaseUrl(ctx);
  const packageName = attributeString(metadata, "package") || entry.name || "<package>";
  const version = attributeString(metadata, "version");
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "r"),
    row("Namespace", "src/contrib"),
    row("Package", packageName),
    row("Version", version || "-"),
  ];
  const license = attributeString(metadata, "license");
  if (license) summaryRows.push(row("License", license));
  const md5 = attributeString(metadata, "md5");
  if (md5) summaryRows.push(row("MD5", md5));
  const sha256 = attributeString(metadata, "sha256");
  if (sha256) summaryRows.push(row("SHA-256", sha256));
  const snippets: UsageSnippet[] = [
    usageSnippet(
      ".Rprofile",
      `options(repos = c(KKRepo = '${repositoryUrl}'))`,
      "Use a credential helper or netrc for private repositories; do not commit tokens in URLs",
    ),
    usageSnippet(
      "Available packages",
      `available.packages(repos = '${repositoryUrl}', type = 'source')`,
    ),
    usageSnippet(
      "Install",
      `install.packages('${packageName}', repos = '${repositoryUrl}', type = 'source')`,
    ),
  ];
  if (isHosted(ctx)) {
    snippets.push(usageSnippet(
      "Publish",
      `curl --fail --user '<username>:<token>' -F 'r.asset=@${packageName}_${version || "1.0.0"}.tar.gz' '${ctx.origin}/service/rest/v1/components?repository=${encodeURIComponent(ctx.repository.name)}'`,
      "The server validates DESCRIPTION and archive limits without executing package code",
    ));
  }
  return { summaryRows, snippets };
}

// --- hugging face ---------------------------------------------------------

function huggingFaceUsageDetail(ctx: UsageContext, entry: BrowseEntry, detail?: BrowseAssetDetail | null): UsageDetail | null {
  const metadata = detail?.huggingface;
  const parts = pathSegments(entry.path);
  const commitIndex = parts.findIndex((part) => /^[0-9a-f]{40,64}$/i.test(part));
  const repoId = attributeString(metadata, "repoId")
    || (commitIndex > 0 ? parts.slice(0, commitIndex).join("/") : "<namespace>/<model>");
  const commit = attributeString(metadata, "commit")
    || (commitIndex >= 0 ? parts[commitIndex] : "<commit>");
  const filePath = attributeString(metadata, "filePath")
    || (commitIndex >= 0 ? parts.slice(commitIndex + 1).join("/") : entry.name || "<file>");
  const endpoint = trimmedBaseUrl(ctx);
  const summaryRows: SummaryRow[] = [
    row("Repository", ctx.repository.name),
    row("Format", "huggingface"),
    row("Model", repoId),
    row("Commit", commit),
    row("File", filePath),
    row("File kind", attributeString(metadata, "fileKind") || "-"),
    row("Cache state", attributeString(metadata, "cacheState") || "READY"),
  ];
  const lfsSha256 = attributeString(metadata, "lfsSha256");
  if (lfsSha256) summaryRows.push(row("LFS SHA-256", lfsSha256));
  const gitOid = attributeString(metadata, "gitOid");
  if (gitOid) summaryRows.push(row("Git OID", gitOid));
  const snippets: UsageSnippet[] = [
    usageSnippet(
      "Environment",
      `export HF_ENDPOINT='${endpoint}'`,
      "All Hub API and file traffic stays behind the repository permission boundary",
    ),
    usageSnippet(
      "Python file download",
      `python -c "from huggingface_hub import hf_hub_download; print(hf_hub_download('${repoId}', '${filePath}', revision='${commit}'))"`,
    ),
    usageSnippet(
      "Snapshot download",
      `hf download '${repoId}' --revision '${commit}'`,
    ),
  ];
  return { summaryRows, snippets };
}

// --- git lfs --------------------------------------------------------------

function gitLfsUsageDetail(ctx: UsageContext, entry: BrowseEntry): UsageDetail {
  return {
    summaryRows: [
      row("Repository", ctx.repository.name),
      row("Format", "Git LFS"),
      row("OID (SHA-256)", entry.path),
    ],
    snippets: [
      usageSnippet("Configure", `git config -f .lfsconfig lfs.url '${trimmedBaseUrl(ctx)}/info/lfs'`, "Keep the Git remote on your Git server; use a credential helper for Lumina access"),
      usageSnippet("Verify", "git lfs fetch --all\ngit lfs fsck", "Deleting an LFS object can break checkout of historical commits. Automatic cleanup is disabled."),
    ],
  };
}

/**
 * Builds the Usage panel content for one browse entry.
 *
 * Directory (component) selections get the legacy `summaryRows` for the
 * repository summary, and every supported format gets its client `snippets`.
 * Formats the legacy console never documented return `null`, which lets the
 * detail pane fall back to the generic Summary panel.
 *
 * @param ctx repository identity, absolute URLs and the browse-children loader
 * @param entry selected browse row (asset or directory)
 * @param detail optional asset attributes; enables detail-aware snippets
 */
export async function usageDetailForEntry(
  ctx: UsageContext,
  entry: BrowseEntry,
  detail: BrowseAssetDetail | null = null,
): Promise<UsageDetail | null> {
  const format = normalizedFormat(ctx);
  if (format === "maven2") return mavenUsageDetail(ctx, entry);
  if (format === "pypi") return pypiUsageDetail(ctx, entry);
  if (format === "npm") return npmUsageDetail(ctx, entry);
  if (format === "cargo") return cargoUsageDetail(ctx, entry);
  if (format === "helm") return helmUsageDetail(ctx, entry);
  if (format === "go") return goUsageDetail(ctx, entry);
  if (format === "pub") return pubUsageDetail(ctx, entry);
  if (format === "composer") return composerUsageDetail(ctx, entry, detail);
  if (format === "terraform") return terraformUsageDetail(ctx, entry);
  if (format === "swift") return swiftUsageDetail(ctx, entry);
  if (format === "ansiblegalaxy") return ansibleGalaxyUsageDetail(ctx, entry);
  if (format === "conda") return condaUsageDetail(ctx, entry, detail);
  if (format === "conan") return conanUsageDetail(ctx, entry);
  if (format === "apt") return aptUsageDetail(ctx, detail);
  if (format === "alpine") return alpineUsageDetail(ctx, detail);
  if (format === "r") return rUsageDetail(ctx, entry, detail);
  if (format === "gitlfs") return gitLfsUsageDetail(ctx, entry);
  if (format === "huggingface") return huggingFaceUsageDetail(ctx, entry, detail);
  if (format === "docker") return dockerUsageDetail(ctx, entry, detail);
  return null;
}
