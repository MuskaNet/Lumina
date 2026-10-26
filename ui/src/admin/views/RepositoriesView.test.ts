import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent } from "vue";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getOrNull: vi.fn(),
  send: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../shared/api/client", () => ({
  api: mocks,
  ApiError: class ApiError extends Error {},
}));

import RepositoriesView from "./RepositoriesView.vue";

const M3DialogStub = defineComponent({
  name: "M3Dialog",
  props: [
    "title",
    "subtitle",
    "icon",
    "confirmLabel",
    "cancelLabel",
    "busy",
    "wide",
    "destructive",
    "error",
    "hideCancel",
  ],
  emits: ["confirm", "cancel"],
  methods: { open() {}, close() {} },
  template: `
    <dialog open>
      <slot />
      <button data-testid="dialog-confirm" type="button" @click="$emit('confirm')">confirm</button>
    </dialog>
  `,
});

const repositoriesFixture = [
  {
    name: "maven-hosted",
    format: "maven2",
    type: "HOSTED",
    recipe: "maven2-hosted",
    online: true,
    strictContentTypeValidation: true,
    hosted: { writePolicy: "ALLOW_ONCE", versionPolicy: "RELEASE", layoutPolicy: "STRICT" },
  },
  {
    name: "maven-proxy",
    format: "maven2",
    type: "PROXY",
    recipe: "maven2-proxy",
    online: true,
    proxy: { remoteUrl: "https://repo.maven.apache.org/maven2/" },
  },
  {
    name: "maven-group",
    format: "maven2",
    type: "GROUP",
    recipe: "maven2-group",
    online: true,
    group: { memberNames: ["maven-proxy"] },
  },
  {
    name: "conan-proxy",
    format: "conan",
    type: "PROXY",
    recipe: "conan-proxy",
    online: true,
    proxy: { remoteUrl: "https://center2.conan.io/" },
    conan: { manifestMaxEntries: null, manifestMaxBytes: null },
  },
  {
    name: "alpine-proxy",
    format: "alpine",
    type: "PROXY",
    recipe: "alpine-proxy",
    online: true,
    proxy: { remoteUrl: "https://dl-cdn.alpinelinux.org/alpine/" },
    alpine: {
      distributions: ["v3.23"],
      channels: ["main"],
      architectures: ["x86_64"],
      metadataMode: "PASSTHROUGH",
      verifyUpstreamSignatures: false,
      staleIfError: true,
      keyFilename: "acme.rsa.pub",
      signatureType: "RSA",
      description: "acme",
      upstreamPublicKeys: [],
    },
  },
  {
    name: "apt-proxy",
    format: "apt",
    type: "PROXY",
    recipe: "apt-proxy",
    online: true,
    proxy: { remoteUrl: "https://deb.debian.org/debian/" },
    apt: { distribution: "stable", component: "main", architectures: ["amd64"], metadataMode: "PASSTHROUGH" },
  },
];

const recipesFixture = [
  { name: "maven2-hosted", format: "maven2", type: "HOSTED" },
  { name: "maven2-proxy", format: "maven2", type: "PROXY" },
  { name: "maven2-group", format: "maven2", type: "GROUP" },
  { name: "conan-proxy", format: "conan", type: "PROXY" },
  { name: "alpine-proxy", format: "alpine", type: "PROXY" },
  { name: "apt-proxy", format: "apt", type: "PROXY" },
];

function installApi() {
  mocks.get.mockReset();
  mocks.getOrNull.mockReset();
  mocks.send.mockReset();
  mocks.delete.mockReset();
  mocks.get.mockImplementation((path: string) => {
    if (path.startsWith("/internal/repositories?purpose=admin")) return Promise.resolve(repositoriesFixture);
    if (path.endsWith("/conan/status")) {
      return Promise.resolve({
        repositoryRevision: 3,
        recipes: 7,
        recipeRevisions: 9,
        packages: 12,
        packageRevisions: 14,
        committedFiles: 21,
        openUploadSessions: 1,
        cachedProxyFiles: 2,
      });
    }
    if (path.endsWith("/alpine/status")) {
      return Promise.resolve({
        activeKey: {
          revision: 2,
          keyFilename: "acme.rsa.pub",
          fingerprint: "FPR2",
          signatureType: "RSA256",
        },
        namespaces: [{ namespace: "v3.23/main/x86_64", desiredRevision: 3, publishedRevision: 3 }],
        proxyNamespaces: [],
      });
    }
    if (path.endsWith("/apt/status")) {
      return Promise.resolve({
        activeKey: { revision: 4, keyId: "ABC", fingerprint: "FPR", createdAt: "2026-10-25T00:00:00Z" },
        suites: [{ distribution: "stable", desiredRevision: 5, publishedRevision: 4 }],
        proxyDistributions: [],
      });
    }
    return Promise.resolve({});
  });
  mocks.getOrNull.mockImplementation((path: string) => {
    if (path === "/internal/repositories/recipes") return Promise.resolve(recipesFixture);
    if (path === "/internal/blob-stores") return Promise.resolve({ stores: [] });
    return Promise.resolve(null);
  });
  mocks.send.mockResolvedValue(null);
}

async function mountView(): Promise<VueWrapper> {
  const wrapper = mount(RepositoriesView, {
    global: { stubs: { M3Dialog: M3DialogStub } },
  });
  await flushPromises();
  return wrapper;
}

async function clickButton(wrapper: VueWrapper, label: string): Promise<void> {
  // Icon ligatures are rendered as text inside the button, so match by substring.
  const button = wrapper.findAll("button").find((node) => node.text().trim().includes(label));
  expect(button, `${label} button`).toBeTruthy();
  await button!.trigger("click");
  await flushPromises();
}

async function openEdit(wrapper: VueWrapper, name: string): Promise<void> {
  const row = wrapper.findAll("tr").find((node) => node.text().includes(name));
  expect(row, `${name} row`).toBeTruthy();
  const edit = row!.findAll("button").find((node) => node.text() === "Edit");
  expect(edit, `${name} edit button`).toBeTruthy();
  await edit!.trigger("click");
  await flushPromises();
}

async function chooseRecipe(wrapper: VueWrapper, value: string): Promise<void> {
  const trigger = wrapper.find(".kk-recipe-trigger");
  expect(trigger.exists(), "recipe trigger").toBe(true);
  await trigger.trigger("click");
  await flushPromises();
  const option = wrapper.find(`[data-recipe-value="${value}"]`);
  expect(option.exists(), `${value} recipe option`).toBe(true);
  await option.trigger("click");
  await flushPromises();
}

function sentPayload(index = -1): Record<string, unknown> {
  const call = mocks.send.mock.calls.at(index);
  expect(call, "api.send call").toBeTruthy();
  return call![2] as Record<string, unknown>;
}

describe("repository dialog: group member transfer", () => {
  beforeEach(installApi);

  it("moves same-format repositories through the MICL transfer panes in priority order", async () => {
    const wrapper = await mountView();
    await clickButton(wrapper, "Create repository");
    await wrapper.find("#repo-name").setValue("group-repo");
    await chooseRecipe(wrapper, "maven2-group");
    expect(wrapper.find(".kk-tabs").exists()).toBe(false);

    expect(wrapper.find(".kk-member-transfer").exists()).toBe(true);
    const panes = wrapper.findAll(".kk-member-pane");
    expect(panes).toHaveLength(2);

    // Only maven2 hosted/proxy candidates: the group itself and other formats are hidden.
    const available = panes[0].findAll(".micl-list-item-one");
    expect(available.map((item) => item.text())).toEqual([
      expect.stringContaining("maven-hosted"),
      expect.stringContaining("maven-proxy"),
    ]);

    const addAll = wrapper.findAll(".kk-member-actions button")[0];
    expect(addAll.attributes("title")).toBe("Add all");
    await addAll.trigger("click");
    await flushPromises();

    const selected = wrapper.findAll(".kk-member-pane")[1].findAll(".micl-list-item-one");
    expect(selected.map((item) => item.text())).toEqual([
      expect.stringContaining("maven-hosted"),
      expect.stringContaining("maven-proxy"),
    ]);

    // Priority order is the selected order; move the first member down.
    const moveDown = selected[0].findAll("button").find((node) => node.attributes("title") === "Move down");
    expect(moveDown).toBeTruthy();
    await moveDown!.trigger("click");
    await flushPromises();

    const confirm = wrapper.findAll("[data-testid='dialog-confirm']")[0];
    await confirm.trigger("click");
    await flushPromises();

    const createCall = mocks.send.mock.calls.find((call) => call[0] === "/internal/repositories");
    expect(createCall).toBeTruthy();
    expect(createCall![2]).toMatchObject({
      recipe: "maven2-group",
      group: { memberNames: ["maven-proxy", "maven-hosted"] },
    });
  });

  it("prefills the saved member order and supports removing members", async () => {
    const wrapper = await mountView();
    await openEdit(wrapper, "maven-group");

    const selectedPane = () => wrapper.findAll(".kk-member-pane")[1];
    expect(selectedPane().findAll(".micl-list-item-one")).toHaveLength(1);
    expect(selectedPane().text()).toContain("maven-proxy");

    const removeAll = wrapper.findAll(".kk-member-actions button")[3];
    expect(removeAll.attributes("title")).toBe("Remove all");
    await removeAll.trigger("click");
    await flushPromises();
    expect(selectedPane().findAll(".micl-list-item-one")).toHaveLength(0);
    expect(wrapper.findAll(".kk-member-pane")[0].text()).toContain("maven-proxy");
  });
});

describe("repository dialog: shared section layout", () => {
  beforeEach(installApi);

  it("saves general, type and format edits together without switching tabs", async () => {
    const wrapper = await mountView();
    await openEdit(wrapper, "alpine-proxy");
    await wrapper.get("#repo-remote-url").setValue("https://mirror.example.com/alpine/");
    await wrapper.get("#repo-alpine-channels").setValue("main, community");
    await wrapper.find("[data-testid='dialog-confirm']").trigger("click");
    await flushPromises();

    expect(mocks.send).toHaveBeenCalledWith("/internal/repositories/alpine-proxy", "PUT", expect.objectContaining({
      proxy: expect.objectContaining({ remoteUrl: "https://mirror.example.com/alpine/" }),
      alpine: expect.objectContaining({ channels: ["main", "community"] }),
    }));
    wrapper.unmount();
  });

  it("does not request signing status for unrelated recipes", async () => {
    const wrapper = await mountView();
    await openEdit(wrapper, "maven-hosted");
    expect(wrapper.find("[data-repository-section='signing']").exists()).toBe(false);
    expect(mocks.get.mock.calls.some(([path]) => String(path).endsWith("/status"))).toBe(false);
    wrapper.unmount();
  });

  it.each([
    ["maven2-hosted", "maven-hosted"],
    ["maven2-proxy", "maven-proxy"],
    ["maven2-group", "maven-group"],
    ["alpine-proxy", "alpine-proxy"],
    ["apt-proxy", "apt-proxy"],
  ])("uses the same parameter groups for %s create and edit", async (recipe, repository) => {
    const wrapper = await mountView();
    await clickButton(wrapper, "Create repository");
    await chooseRecipe(wrapper, recipe);
    const headings = () => wrapper.findAll("[data-repository-section]:not([data-repository-section='signing']) h2, [data-repository-section]:not([data-repository-section='signing']) h3").map((node) => node.text());
    const creationGroups = headings();
    expect(creationGroups).toContain("General");
    expect(wrapper.find("[role='tablist']").exists()).toBe(false);
    expect(wrapper.find("[data-repository-section='signing']").exists()).toBe(false);

    await openEdit(wrapper, repository);
    expect(headings()).toEqual(creationGroups);
    expect(wrapper.find("[role='tablist']").exists()).toBe(false);
    expect(wrapper.get("#repo-name").attributes("readonly")).toBeDefined();
    expect(wrapper.get(".kk-recipe-trigger").attributes("disabled")).toBeDefined();
    expect(wrapper.find("#repo-blobstore").exists()).toBe(false);
    expect(wrapper.find("[data-repository-section='behavior']").exists()).toBe(true);
    if (recipe.startsWith("alpine") || recipe.startsWith("apt")) {
      expect(wrapper.find("[data-repository-section='format']").exists()).toBe(true);
      expect(wrapper.find("[data-repository-section='signing']").exists()).toBe(true);
      expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining("/status"));
    }
    wrapper.unmount();
  });
});

describe("repository dialog: status panels and signing", () => {
  beforeEach(installApi);

  it("loads and refreshes the Conan repository status on edit", async () => {
    const wrapper = await mountView();
    await openEdit(wrapper, "conan-proxy");

    expect(wrapper.text()).toContain("7 recipes");
    expect(wrapper.text()).toContain("2 cached proxy files");

    const before = mocks.get.mock.calls.filter((call) => call[0].endsWith("/conan/status")).length;
    await clickButton(wrapper, "Refresh status");
    const after = mocks.get.mock.calls.filter((call) => call[0].endsWith("/conan/status")).length;
    expect(after).toBe(before + 1);
  });

  it("shows signing operations for proxy APT and Alpine repositories", async () => {
    const wrapper = await mountView();

    await openEdit(wrapper, "apt-proxy");
    expect(wrapper.text()).toContain("key FPR (revision 4)");
    await clickButton(wrapper, "Rebuild metadata");
    expect(sentPayload()).toMatchObject({ distribution: "stable" });

    await wrapper.find("[data-testid='dialog-confirm']").trigger("click");
    await flushPromises();

    await openEdit(wrapper, "alpine-proxy");
    expect(wrapper.text()).toContain("acme.rsa.pub");
    expect(wrapper.find("a[href$='/alpine/public-key']").exists()).toBe(true);

    await clickButton(wrapper, "Rebuild metadata");
    const rebuild = mocks.send.mock.calls.at(-1)!;
    expect(rebuild[0]).toContain("/alpine/rebuild");
    expect(rebuild[2]).toEqual({ namespace: "v3.23/main/x86_64" });
  });
});

describe("repository table icons", () => {
  beforeEach(installApi);

  it("renders the restored upstream format logo and the type icon", async () => {
    const wrapper = await mountView();
    const row = wrapper.findAll("tr").find((node) => node.text().includes("maven-hosted"));
    expect(row).toBeTruthy();

    // Upstream brand logo inside the format column, not a generic Material Symbols glyph.
    expect(row!.find(".format-cell .format-logo-maven").exists()).toBe(true);
    expect(row!.find(".format-cell .format-cell-label").text()).toBe("maven2");
    // Leading column keeps the upstream repository type icon (hosted => package).
    expect(row!.find(".kk-format-icon").text()).toBe("inventory_2");
  });

  it("uses the per-format brand logo for each row", async () => {
    const wrapper = await mountView();
    const cases: [string, string][] = [
      ["alpine-proxy", "alpine"],
      ["conan-proxy", "conan"],
      ["apt-proxy", "apt"],
    ];
    for (const [name, logo] of cases) {
      const row = wrapper.findAll("tr").find((node) => node.text().includes(name));
      expect(row, `${name} row`).toBeTruthy();
      expect(row!.find(`.format-cell .format-logo-${logo}`).exists(), `${logo} logo`).toBe(true);
    }
  });
});

describe("repository usage", () => {
  beforeEach(installApi);

  it("reads ID-keyed counters and excludes groups from totals", async () => {
    const repos = repositoriesFixture.slice(0, 3).map((repo, index) => ({ ...repo, id: index + 1 }));
    mocks.get.mockImplementation(() => Promise.resolve(repos));
    mocks.getOrNull.mockImplementation((path: string) => {
      if (path.endsWith("statistics/usage")) return Promise.resolve({ usage: {
        "1": { assetCount: "2", totalBytes: "1024", unknownSizeCount: "0" },
        "2": { assetCount: "3", totalBytes: "2048", unknownSizeCount: "1" },
        "3": { assetCount: "99", totalBytes: "999999", unknownSizeCount: "0" },
      } });
      return Promise.resolve(null);
    });
    const wrapper = await mountView();
    const summary = wrapper.findAll(".kk-summary__value").map((node) => node.text());
    expect(summary).toContain("5");
    expect(summary).toContain("≥ 3 KiB");
    const row = wrapper.findAll("tbody tr").find((node) => node.text().includes("maven-proxy"));
    expect(row!.text()).toContain("≥ 2 KiB");
    expect(row!.findAll("td").map((node) => node.text())).toContain("3");
    wrapper.unmount();
  });
});
