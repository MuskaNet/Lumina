import { describe, expect, it, vi } from "vitest";
import type { BrowseAssetDetail, BrowseEntry, BrowseRepository, UsageContext, UsageDetail } from "./browseModel";
import { usageDetailForEntry } from "./usage";

const HOST = "repo.example.com";
const ORIGIN = `https://${HOST}`;

function makeRepository(format: string, overrides: Partial<BrowseRepository> = {}): BrowseRepository {
  return {
    name: "repo-hosted",
    format,
    type: "hosted",
    url: "/repository/repo-hosted/",
    ...overrides,
  };
}

function leafName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function makeEntry(path: string, leaf: boolean, name = leafName(path)): BrowseEntry {
  return { name, path, leaf };
}

/**
 * Deterministic usage context: explicit scheme/host and a mocked children
 * loader keyed by browse path, so no test touches the network or the DOM.
 */
function makeContext(
  repository: BrowseRepository,
  children: Record<string, BrowseEntry[]> = {},
  options: { host?: string; protocol?: string } = {},
): UsageContext {
  const host = options.host ?? HOST;
  const protocol = options.protocol ?? "https:";
  const origin = `${protocol}//${host}`;
  const basePath = repository.url ?? `/repository/${encodeURIComponent(repository.name)}/`;
  return {
    repository,
    baseUrl: new URL(basePath, origin).href,
    origin,
    host,
    protocol,
    fetchChildren: vi.fn(async (childPath: string) => children[childPath] ?? []),
  };
}

async function loadUsage(
  ctx: UsageContext,
  entry: BrowseEntry,
  detail: BrowseAssetDetail | null = null,
): Promise<UsageDetail> {
  const usage = await usageDetailForEntry(ctx, entry, detail);
  if (!usage) throw new Error("expected usage snippets");
  return usage;
}

function trimmedBaseUrl(ctx: UsageContext): string {
  return ctx.baseUrl.replace(/\/+$/, "");
}

describe("maven2 usage", () => {
  it("builds the pom snippet from the group/artifact/version path", async () => {
    const ctx = makeContext(makeRepository("maven2"));
    const usage = await loadUsage(ctx, makeEntry("com/example/demo/1.0.0", false));
    expect(usage.snippets[0]).toEqual({
      displayName: "Apache Maven",
      snippetText: `<dependency>
    <groupId>com.example</groupId>
    <artifactId>demo</artifactId>
    <version>1.0.0</version>
</dependency>`,
      description: "Insert this snippet into your pom.xml",
    });
    expect(usage.summaryRows).toContainEqual({ label: "Group", value: "com.example" });
  });

  it("builds the Gradle Groovy and Kotlin DSL snippets", async () => {
    const ctx = makeContext(makeRepository("maven2"));
    const usage = await loadUsage(ctx, makeEntry("com/example/demo/1.0.0", false));
    expect(usage.snippets[1].snippetText).toBe("implementation 'com.example:demo:1.0.0'");
    expect(usage.snippets[2].snippetText).toBe('implementation("com.example:demo:1.0.0")');
  });
});

describe("docker usage", () => {
  it("uses the connector public URL as the registry base", async () => {
    const ctx = makeContext(makeRepository("docker", {
      name: "docker-hosted",
      docker: { connectorEnabled: true, connectorPublicUrl: "https://hub.example.com/v2/" },
    }));
    const usage = await loadUsage(ctx, makeEntry("v2/team/app/manifests/1.0", true));
    expect(usage.summaryRows).toContainEqual({ label: "Image", value: "team/app" });
    expect(usage.summaryRows).toContainEqual({ label: "Registry URL", value: "hub.example.com" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      "docker pull hub.example.com/team/app:1.0",
      "docker tag team/app:1.0 hub.example.com/team/app:1.0",
      "docker push hub.example.com/team/app:1.0",
    ]);
  });

  it("falls back to <host>/<repository> when the connector is disabled", async () => {
    const ctx = makeContext(makeRepository("docker", {
      name: "docker-hosted",
      docker: { connectorEnabled: false },
    }));
    const usage = await loadUsage(ctx, makeEntry("v2/team/app/manifests/latest", true));
    expect(usage.summaryRows).toContainEqual({ label: "Registry URL", value: "repo.example.com/docker-hosted" });
    expect(usage.snippets[0].snippetText).toBe("docker pull repo.example.com/docker-hosted/team/app:latest");
  });

  it("uses the connector port on the current hostname", async () => {
    const ctx = makeContext(makeRepository("docker", {
      name: "docker-hosted",
      docker: { connectorEnabled: true, connectorPort: 5000 },
    }), {}, { host: "repo.example.com:8443" });
    const usage = await loadUsage(ctx, makeEntry("v2/team/app/manifests/1.0", true));
    expect(usage.summaryRows).toContainEqual({ label: "Registry URL", value: "repo.example.com:5000" });
    expect(usage.snippets[0].snippetText).toBe("docker pull repo.example.com:5000/team/app:1.0");
  });

  it("adds a digest pull when the asset detail exposes one", async () => {
    const ctx = makeContext(makeRepository("docker", {
      name: "docker-hosted",
      docker: { connectorEnabled: false },
    }));
    const detail: BrowseAssetDetail = {
      docker: { digest: "sha256:abc123", image_name: "team/app", reference: "2.0" },
    };
    const usage = await loadUsage(ctx, makeEntry("v2/team/app/manifests/2.0", true), detail);
    expect(usage.summaryRows).toContainEqual({ label: "Reference", value: "2.0" });
    expect(usage.snippets.at(-1)?.snippetText).toBe(
      "docker pull repo.example.com/docker-hosted/team/app@sha256:abc123",
    );
  });
});

describe("pypi usage", () => {
  it("resolves the newest child version through fetchChildren", async () => {
    const ctx = makeContext(makeRepository("pypi"), {
      requests: [makeEntry("requests/2.31.0", false), makeEntry("requests/2.32.0", false)],
    });
    const usage = await loadUsage(ctx, makeEntry("requests", false));
    expect(ctx.fetchChildren).toHaveBeenCalledWith("requests");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "2.32.0" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      "pip install requests==2.32.0",
      "easy_install requests==2.32.0",
      "pipenv install requests==2.32.0",
      "requests == 2.32.0",
    ]);
  });
});

describe("npm usage", () => {
  it("resolves the newest tarball version through fetchChildren", async () => {
    const ctx = makeContext(makeRepository("npm"), {
      lodash: [makeEntry("lodash/-/lodash-4.17.21.tgz", true)],
    });
    const usage = await loadUsage(ctx, makeEntry("lodash", false));
    expect(ctx.fetchChildren).toHaveBeenCalledWith("lodash");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "4.17.21" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      "npm install lodash@4.17.21",
      "yarn add lodash@4.17.21",
      '"lodash": "4.17.21"',
    ]);
  });
});

describe("go usage", () => {
  it("resolves the newest @v version through fetchChildren", async () => {
    const ctx = makeContext(makeRepository("go"), {
      "github.com/acme/demo/@v": [
        makeEntry("github.com/acme/demo/@v/v1.2.3.info", true),
        makeEntry("github.com/acme/demo/@v/v1.2.3.mod", true),
      ],
    });
    const usage = await loadUsage(ctx, makeEntry("github.com/acme/demo", false));
    expect(ctx.fetchChildren).toHaveBeenCalledWith("github.com/acme/demo/@v");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "v1.2.3" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      `GOPROXY=${ctx.baseUrl} go get github.com/acme/demo@v1.2.3`,
      `go env -w GOPROXY=${ctx.baseUrl},direct`,
      "require github.com/acme/demo v1.2.3",
    ]);
  });
});

describe("pub usage", () => {
  it("resolves the newest version from the versions directory", async () => {
    const ctx = makeContext(makeRepository("pub"), {
      "packages/acme_widget/versions": [
        makeEntry("packages/acme_widget/versions/1.0.0", false),
        makeEntry("packages/acme_widget/versions/1.1.0", false),
      ],
    });
    const usage = await loadUsage(ctx, makeEntry("packages/acme_widget", false));
    expect(ctx.fetchChildren).toHaveBeenCalledWith("packages/acme_widget/versions");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "1.1.0" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      `dependencies:\n  acme_widget:\n    hosted:\n      url: ${ctx.baseUrl}\n      name: acme_widget\n    version: 1.1.0`,
      `dart pub add acme_widget:1.1.0 --hosted-url ${ctx.baseUrl}`,
      `PUB_HOSTED_URL=${ctx.baseUrl} dart pub get`,
      `publish_to: ${ctx.baseUrl}`,
    ]);
  });
});

describe("cargo usage", () => {
  it("resolves the newest crate version through fetchChildren", async () => {
    const ctx = makeContext(makeRepository("cargo"), {
      "crates/serde": [makeEntry("crates/serde/1.0.0", false), makeEntry("crates/serde/1.0.10", false)],
    });
    const usage = await loadUsage(ctx, makeEntry("crates/serde", false));
    expect(ctx.fetchChildren).toHaveBeenCalledWith("crates/serde");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "1.0.10" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      `[source.crates-io]\nreplace-with = "repo-hosted"\n\n[source.repo-hosted]\nregistry = "sparse+${ctx.baseUrl}"`,
      "cargo add serde@1.0.10",
      'serde = "1.0.10"',
      `[registries.repo-hosted]\nindex = "sparse+${ctx.baseUrl}"`,
      'serde = { version = "1.0.10", registry = "repo-hosted" }',
    ]);
  });
});

describe("helm usage", () => {
  it("builds helm repo add, install and Chart.yaml snippets", async () => {
    const ctx = makeContext(makeRepository("helm"));
    const usage = await loadUsage(ctx, makeEntry("demo-1.2.3.tgz", true));
    expect(usage.summaryRows).toContainEqual({ label: "Name", value: "demo" });
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "1.2.3" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      `helm repo add repo-hosted ${ctx.baseUrl}`,
      `helm install demo demo --repo ${ctx.baseUrl} --version 1.2.3`,
      `dependencies:\n  - name: demo\n    version: 1.2.3\n    repository: ${ctx.baseUrl}`,
    ]);
  });
});

describe("composer usage", () => {
  it("builds require/config/json snippets from the package path", async () => {
    const ctx = makeContext(makeRepository("composer"));
    const usage = await loadUsage(ctx, makeEntry("acme/demo/1.2.3", false));
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      "composer require acme/demo:1.2.3",
      `composer config repositories.repo-hosted composer ${ctx.baseUrl}`,
      `"repositories": [\n  {"type": "composer", "url": "${ctx.baseUrl}"}\n],\n"require": {\n  "acme/demo": "1.2.3"\n}`,
    ]);
  });

  it("prefers the composer attribute detail for name and version", async () => {
    const ctx = makeContext(makeRepository("composer"));
    const detail: BrowseAssetDetail = { composer: { package_name: "acme/demo", version: "2.0.0" } };
    const usage = await loadUsage(ctx, makeEntry("p2/acme/demo~dev.json", true), detail);
    expect(usage.snippets[0].snippetText).toBe("composer require acme/demo:2.0.0");
    expect(usage.summaryRows).toContainEqual({ label: "Version", value: "2.0.0" });
  });
});

describe("terraform usage", () => {
  it("builds module registry snippets", async () => {
    const ctx = makeContext(makeRepository("terraform"));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(ctx, makeEntry("v1/modules/acme/network/aws/1.0.0", false));
    expect(usage.summaryRows).toEqual([
      { label: "Repository", value: "repo-hosted" },
      { label: "Format", value: "terraform" },
      { label: "Path", value: "v1/modules/acme/network/aws/1.0.0" },
      { label: "Scope", value: "Terraform modules" },
      { label: "Namespace", value: "acme" },
      { label: "Name", value: "network" },
      { label: "System", value: "aws" },
      { label: "Version", value: "1.0.0" },
    ]);
    expect(usage.snippets[0].snippetText).toBe(
      `host "${HOST}" {\n  services = {\n    "modules.v1" = "${base}/v1/modules/"\n  }\n}`,
    );
    expect(usage.snippets[1].snippetText).toBe(
      `module "network" {\n  source  = "${HOST}/acme/network/aws"\n  version = "1.0.0"\n}`,
    );
  });

  it("builds provider registry snippets", async () => {
    const ctx = makeContext(makeRepository("terraform"));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(ctx, makeEntry("v1/providers/hashicorp/aws/5.0.0", false));
    expect(usage.summaryRows).toContainEqual({ label: "Type", value: "aws" });
    expect(usage.snippets[0].snippetText).toBe(
      `host "${HOST}" {\n  services = {\n    "providers.v1" = "${base}/v1/providers/"\n  }\n}`,
    );
    expect(usage.snippets[1].snippetText).toBe(
      `terraform {\n  required_providers {\n    aws = {\n      source  = "${HOST}/hashicorp/aws"\n      version = "5.0.0"\n    }\n  }\n}`,
    );
  });

  it("advertises both registry services at the registry root", async () => {
    const ctx = makeContext(makeRepository("terraform"));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(ctx, makeEntry("v1", false));
    expect(usage.snippets[0].snippetText).toBe(
      `host "${HOST}" {\n  services = {\n    "modules.v1" = "${base}/v1/modules/"\n    "providers.v1" = "${base}/v1/providers/"\n  }\n}`,
    );
  });
});

describe("swift usage", () => {
  it("builds registry configuration, package dependency and publish snippets", async () => {
    const ctx = makeContext(makeRepository("swift"));
    const usage = await loadUsage(ctx, makeEntry("acme/demo/1.0.0.zip", true));
    expect(usage.snippets[0].snippetText).toBe(`swift package-registry set "${ctx.baseUrl}"`);
    expect(usage.snippets[2].displayName).toBe("registries.json");
    expect(JSON.parse(usage.snippets[2].snippetText)).toEqual({
      registries: { "[default]": { url: ctx.baseUrl, supportsAvailability: false } },
      version: 1,
    });
    expect(usage.snippets).toContainEqual({
      displayName: "Package.swift",
      snippetText: '.package(id: "acme.demo", from: "1.0.0")',
      description: "Declare a registry identity dependency",
    });
    expect(usage.snippets.at(-1)).toEqual({
      displayName: "Publish",
      snippetText: "swift package-registry publish acme.demo 1.0.0",
      description: "Publishes the source archive through the configured registry",
    });
    expect(usage.summaryRows).toContainEqual({ label: "Registry URL", value: ctx.baseUrl });
  });
});

describe("ansiblegalaxy usage", () => {
  it("builds ansible.cfg, requirements.yml, install and publish snippets", async () => {
    const ctx = makeContext(makeRepository("ansiblegalaxy"));
    const usage = await loadUsage(ctx, makeEntry("acme/tools/1.2.3.tar.gz", true));
    expect(usage.snippets[0].snippetText).toBe(
      `[galaxy]\nserver_list = repo_hosted\n\n[galaxy_server.repo_hosted]\nurl = ${ctx.baseUrl}\ntoken = GenericToken.<token>`,
    );
    expect(usage.snippets[1].snippetText).toBe(
      `collections:\n  - name: acme.tools\n    version: "1.2.3"\n    source: ${ctx.baseUrl}`,
    );
    expect(usage.snippets[2].snippetText).toBe(
      `ansible-galaxy collection install acme.tools:1.2.3 --server ${ctx.baseUrl}`,
    );
    expect(usage.snippets[3].snippetText).toBe(
      `ansible-galaxy collection publish acme-tools-1.2.3.tar.gz --server ${ctx.baseUrl}`,
    );
  });
});

describe("conda usage", () => {
  it("builds condarc/search/install/publish snippets and metadata rows", async () => {
    const ctx = makeContext(makeRepository("conda"));
    const base = trimmedBaseUrl(ctx);
    const detail: BrowseAssetDetail = {
      conda: {
        channel: "main",
        subdir: "linux-64",
        name: "numpy",
        version: "1.26.0",
        build: "py312_0",
        filename: "numpy-1.26.0-py312_0.conda",
        sha256: "abc123",
        size: 1234,
      },
    };
    const usage = await loadUsage(
      ctx,
      makeEntry("main/linux-64/numpy/1.26.0/numpy-1.26.0-py312_0.conda", true),
      detail,
    );
    expect(usage.summaryRows).toContainEqual({ label: "Channel", value: "main" });
    expect(usage.summaryRows).toContainEqual({ label: "Subdir", value: "linux-64" });
    expect(usage.summaryRows).toContainEqual({ label: "SHA-256", value: "abc123" });
    expect(usage.summaryRows).toContainEqual({ label: "Size", value: "1.2 KiB (1234 bytes)" });
    expect(usage.snippets[0].snippetText).toBe(`channels:\n  - ${base}/main\nchannel_priority: strict`);
    expect(usage.snippets[2].snippetText).toBe(
      `conda install --override-channels -c ${base}/main numpy=1.26.0`,
    );
    expect(usage.snippets[3].snippetText).toBe(
      `curl --fail --user '<username>:<token>' --upload-file 'numpy-1.26.0-py312_0.conda' '${base}/main/linux-64/numpy-1.26.0-py312_0.conda'`,
    );
  });
});

describe("conan usage", () => {
  it("builds remote/login/list/download/install/publish snippets", async () => {
    const ctx = makeContext(makeRepository("conan"));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(
      ctx,
      makeEntry("acme/hello/1.0.0/beta#rrev/packages/pkgid/revisions/prev", true),
    );
    expect(usage.summaryRows).toContainEqual({ label: "Recipe", value: "hello/1.0.0@acme/beta" });
    expect(usage.summaryRows).toContainEqual({ label: "RREV", value: "rrev" });
    expect(usage.summaryRows).toContainEqual({ label: "Package ID", value: "pkgid" });
    expect(usage.summaryRows).toContainEqual({ label: "PREV", value: "prev" });
    expect(usage.snippets[0].snippetText).toBe(`conan remote add repo-hosted '${base}' --force`);
    expect(usage.snippets[2].snippetText).toBe(
      "conan list 'hello/1.0.0@acme/beta#rrev:pkgid#prev' -r=repo-hosted",
    );
    expect(usage.snippets[4].snippetText).toBe(
      "conan install --requires='hello/1.0.0@acme/beta' -r=repo-hosted",
    );
    expect(usage.snippets[5].snippetText).toBe(
      "conan upload 'hello/1.0.0@acme/beta:*' -r=repo-hosted --confirm",
    );
  });
});

describe("apt usage", () => {
  it("builds keyring/sources/install/publish snippets from the apt settings and detail", async () => {
    const ctx = makeContext(makeRepository("apt", {
      name: "apt-hosted",
      apt: { distribution: "stable", component: "main" },
    }));
    const base = trimmedBaseUrl(ctx);
    const detail: BrowseAssetDetail = {
      apt: {
        package: "demo",
        version: "1.0",
        architecture: "amd64",
        sha256: "def456",
        sourcePackage: "demo-src",
        section: "utils",
        priority: "optional",
      },
    };
    const usage = await loadUsage(ctx, makeEntry("pool/main/d/demo/demo_1.0_amd64.deb", true), detail);
    expect(usage.summaryRows).toContainEqual({ label: "Distribution", value: "stable" });
    expect(usage.summaryRows).toContainEqual({ label: "Architecture", value: "amd64" });
    expect(usage.summaryRows).toContainEqual({ label: "Source package", value: "demo-src" });
    expect(usage.snippets[0].snippetText).toBe(
      `curl --fail '${base}/gpg.key' | gpg --dearmor | sudo tee '/etc/apt/keyrings/apt-hosted.gpg' >/dev/null`,
    );
    expect(usage.snippets[1].snippetText).toBe(
      `deb [signed-by=/etc/apt/keyrings/apt-hosted.gpg] ${base} stable main`,
    );
    expect(usage.snippets[3].snippetText).toBe("sudo apt-get install 'demo=1.0'");
    expect(usage.snippets[4].snippetText).toBe(
      `curl --fail --user '<username>:<token>' -F 'apt.asset=@package.deb' '${ORIGIN}/service/rest/v1/components?repository=apt-hosted'`,
    );
  });
});

describe("alpine usage", () => {
  it("builds key/repositories/install/fetch/publish snippets", async () => {
    const ctx = makeContext(makeRepository("alpine", {
      name: "alpine-hosted",
      alpine: {
        distributions: ["v3.23"],
        channels: ["main"],
        architectures: ["x86_64"],
        keyFilename: "kkrepo.rsa.pub",
      },
    }));
    const base = trimmedBaseUrl(ctx);
    const detail: BrowseAssetDetail = {
      alpine: {
        package: "busybox",
        version: "1.36.1-r0",
        repository_architecture: "x86_64",
        package_architecture: "x86_64",
        identity: "C:Q1example",
        sha256: "ff00",
      },
    };
    const usage = await loadUsage(
      ctx,
      makeEntry("v3.23/main/x86_64/busybox-1.36.1-r0.apk", true),
      detail,
    );
    expect(usage.summaryRows).toContainEqual({ label: "Repository architecture", value: "x86_64" });
    expect(usage.summaryRows).toContainEqual({ label: "APK identity", value: "C:Q1example" });
    expect(usage.snippets[0].snippetText).toBe(
      "sudo cp '/path/to/kkrepo.rsa.pub' '/etc/apk/keys/kkrepo.rsa.pub'",
    );
    expect(usage.snippets[1].snippetText).toBe(
      `echo '${base}/v3.23/main' | sudo tee -a /etc/apk/repositories`,
    );
    expect(usage.snippets[3].snippetText).toBe("sudo apk add 'busybox=1.36.1-r0'");
    expect(usage.snippets[4].snippetText).toBe(
      `apk fetch --repository '${base}/v3.23/main' 'busybox=1.36.1-r0'`,
    );
    expect(usage.snippets[5].snippetText).toBe(
      `curl --fail --user '<username>:<token>' -F 'alpine.distribution=v3.23' -F 'alpine.channel=main' -F 'alpine.repositoryArchitecture=x86_64' -F 'alpine.asset=@package.apk' '${ORIGIN}/service/rest/v1/components?repository=alpine-hosted'`,
    );
  });
});

describe("r usage", () => {
  it("builds Rprofile/install/publish snippets from the CRAN detail", async () => {
    const ctx = makeContext(makeRepository("r", { name: "r-hosted" }));
    const base = trimmedBaseUrl(ctx);
    const detail: BrowseAssetDetail = {
      r: { package: "ggplot2", version: "3.5.0", license: "MIT", md5: "md5hash", sha256: "sha256hash" },
    };
    const usage = await loadUsage(ctx, makeEntry("src/contrib/ggplot2_3.5.0.tar.gz", true), detail);
    expect(usage.summaryRows).toContainEqual({ label: "Namespace", value: "src/contrib" });
    expect(usage.summaryRows).toContainEqual({ label: "License", value: "MIT" });
    expect(usage.snippets.map((snippet) => snippet.snippetText)).toEqual([
      `options(repos = c(KKRepo = '${base}'))`,
      `available.packages(repos = '${base}', type = 'source')`,
      `install.packages('ggplot2', repos = '${base}', type = 'source')`,
      `curl --fail --user '<username>:<token>' -F 'r.asset=@ggplot2_3.5.0.tar.gz' '${ORIGIN}/service/rest/v1/components?repository=r-hosted'`,
    ]);
  });
});

describe("huggingface usage", () => {
  it("derives the model, commit and file from the browse path", async () => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    const ctx = makeContext(makeRepository("huggingface", { name: "hf-hosted", type: "proxy" }));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(ctx, makeEntry(`acme/model/${commit}/config.json`, true));
    expect(usage.summaryRows).toContainEqual({ label: "Model", value: "acme/model" });
    expect(usage.summaryRows).toContainEqual({ label: "Commit", value: commit });
    expect(usage.summaryRows).toContainEqual({ label: "File", value: "config.json" });
    expect(usage.snippets[0].snippetText).toBe(`export HF_ENDPOINT='${base}'`);
    expect(usage.snippets[1].snippetText).toBe(
      `python -c "from huggingface_hub import hf_hub_download; print(hf_hub_download('acme/model', 'config.json', revision='${commit}'))"`,
    );
    expect(usage.snippets[2].snippetText).toBe(`hf download 'acme/model' --revision '${commit}'`);
  });
});

describe("gitlfs usage", () => {
  it("builds the .lfsconfig and verification snippets", async () => {
    const oid = "a".repeat(64);
    const ctx = makeContext(makeRepository("gitlfs", { name: "lfs-hosted", type: "proxy" }));
    const base = trimmedBaseUrl(ctx);
    const usage = await loadUsage(ctx, makeEntry(oid, true));
    expect(usage.summaryRows).toEqual([
      { label: "Repository", value: "lfs-hosted" },
      { label: "Format", value: "Git LFS" },
      { label: "OID (SHA-256)", value: oid },
    ]);
    expect(usage.snippets[0].snippetText).toBe(
      `git config -f .lfsconfig lfs.url '${base}/info/lfs'`,
    );
    expect(usage.snippets[1].snippetText).toBe("git lfs fetch --all\ngit lfs fsck");
  });
});

describe("unsupported formats", () => {
  it("returns null for formats without legacy snippets", async () => {
    for (const format of ["raw", "nuget", "rubygems", "yum"]) {
      const ctx = makeContext(makeRepository(format));
      await expect(usageDetailForEntry(ctx, makeEntry("some/path.txt", true))).resolves.toBeNull();
      expect(ctx.fetchChildren).not.toHaveBeenCalled();
    }
  });

  it("returns null when the path has no usable coordinates", async () => {
    const maven = makeContext(makeRepository("maven2"));
    await expect(usageDetailForEntry(maven, makeEntry("", false, ""))).resolves.toBeNull();

    const terraform = makeContext(makeRepository("terraform"));
    await expect(usageDetailForEntry(terraform, makeEntry("", false, ""))).resolves.toBeNull();

    const pypi = makeContext(makeRepository("pypi"));
    await expect(usageDetailForEntry(pypi, makeEntry("", false, ""))).resolves.toBeNull();
  });
});
