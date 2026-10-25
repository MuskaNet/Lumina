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

async function selectTab(wrapper: VueWrapper, label: string): Promise<void> {
  const tab = wrapper.findAll(".kk-tab").find((node) => node.text() === label);
  expect(tab, `${label} tab`).toBeTruthy();
  await tab!.trigger("click");
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
    await selectTab(wrapper, "Type");

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
    await selectTab(wrapper, "Type");

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

describe("repository dialog: status panels and signing", () => {
  beforeEach(installApi);

  it("loads and refreshes the Conan repository status on edit", async () => {
    const wrapper = await mountView();
    await openEdit(wrapper, "conan-proxy");
    await selectTab(wrapper, "Format");

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
    await selectTab(wrapper, "Signing");
    expect(wrapper.text()).toContain("key FPR (revision 4)");
    await clickButton(wrapper, "Rebuild metadata");
    expect(sentPayload()).toMatchObject({ distribution: "stable" });

    await wrapper.find("[data-testid='dialog-confirm']").trigger("click");
    await flushPromises();

    await openEdit(wrapper, "alpine-proxy");
    await selectTab(wrapper, "Signing");
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
