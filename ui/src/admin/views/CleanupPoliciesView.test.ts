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

import CleanupPoliciesView from "./CleanupPoliciesView.vue";

const M3DialogStub = defineComponent({
  name: "M3Dialog",
  props: ["title", "subtitle", "busy", "error", "wide", "confirmLabel", "hideCancel", "icon", "destructive"],
  emits: ["confirm", "cancel"],
  methods: { open() {}, close() {} },
  template: `
    <dialog open>
      <slot />
      <button data-testid="dialog-confirm" type="button" @click="$emit('confirm')">confirm</button>
    </dialog>
  `,
});

const capabilities = [
  { format: "maven2", tryRunSupported: true, retainCountSupported: true, lastDownloadedSupported: true, executeSupported: true },
  { format: "npm", tryRunSupported: true, retainCountSupported: false, lastDownloadedSupported: true, executeSupported: true },
];

const repositories = [
  { id: 1, name: "maven-hosted", format: "maven2", type: "HOSTED", online: true },
  { id: 2, name: "maven-group", format: "maven2", type: "GROUP", online: true },
  { id: 3, name: "maven-proxy", format: "maven2", type: "PROXY", online: true },
  { id: 4, name: "npm-hosted", format: "npm", type: "HOSTED", online: true },
];

function installApi() {
  mocks.get.mockReset();
  mocks.getOrNull.mockReset();
  mocks.send.mockReset();
  mocks.delete.mockReset();
  mocks.get.mockImplementation((path: string) => {
    if (path.startsWith("/internal/cleanup/policies?")) return Promise.resolve({ items: [], nextAfter: null });
    return Promise.resolve({});
  });
  mocks.getOrNull.mockImplementation((path: string) => {
    if (path === "/internal/cleanup/runs?before=0&limit=20") return Promise.resolve({ items: [] });
    if (path === "/internal/repositories?purpose=admin") return Promise.resolve(repositories);
    if (path === "/internal/cleanup/capabilities") return Promise.resolve(capabilities);
    return Promise.resolve(null);
  });
  mocks.send.mockResolvedValue(null);
}

async function mountView(): Promise<VueWrapper> {
  const wrapper = mount(CleanupPoliciesView, {
    global: { stubs: { M3Dialog: M3DialogStub } },
  });
  await flushPromises();
  return wrapper;
}

async function openCreate(wrapper: VueWrapper): Promise<void> {
  const button = wrapper.findAll("button").find((node) => node.text().includes("Create policy"));
  expect(button, "create policy button").toBeTruthy();
  await button!.trigger("click");
  await flushPromises();
}

async function openPicker(wrapper: VueWrapper): Promise<void> {
  await wrapper.find(".kk-cleanup-repo-trigger").trigger("click");
  await flushPromises();
}

describe("CleanupPoliciesView policy dialog", () => {
  beforeEach(installApi);

  it("only offers hosted/proxy repositories of the selected format", async () => {
    const wrapper = await mountView();
    await openCreate(wrapper);

    expect(wrapper.find("#cleanup-format").element).toHaveProperty("value", "maven2");
    await openPicker(wrapper);

    const rows = wrapper.findAll(".kk-cleanup-repo-option");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.text()).join(" ")).toContain("maven-hosted");
    expect(wrapper.find(".kk-cleanup-repo-options").text()).not.toContain("maven-group");
    expect(wrapper.find(".kk-cleanup-repo-footer").text()).toBe("0 selected · 2 available");
  });

  it("saves the selected repositories and cleanup rule", async () => {
    const wrapper = await mountView();
    await openCreate(wrapper);

    await wrapper.find("#cleanup-name").setValue("clean-maven");
    await openPicker(wrapper);
    await wrapper.findAll(".kk-cleanup-repo-actions button")[0]!.trigger("click");
    await flushPromises();

    // The server requires an age/retain rule; the dialog rejects a pattern-only policy.
    await wrapper.find("[data-testid='dialog-confirm']").trigger("click");
    await flushPromises();
    expect(mocks.send.mock.calls.filter((entry) => entry[0] === "/internal/cleanup/policies")).toHaveLength(0);

    await wrapper.find("#cleanup-retain").setValue(5);
    await wrapper.find("[data-testid='dialog-confirm']").trigger("click");
    await flushPromises();

    const call = mocks.send.mock.calls.find((entry) => entry[0] === "/internal/cleanup/policies");
    expect(call).toBeTruthy();
    const payload = call![2] as Record<string, unknown>;
    expect([...(payload.repositoryIds as number[])].sort((a, b) => a - b)).toEqual([1, 3]);
    expect(payload).toMatchObject({
      name: "clean-maven",
      format: "maven2",
      criteria: { retainCount: 5 },
      schedule: null,
      revision: null,
    });
  });

  it("switches the candidate repositories when the format changes", async () => {
    const wrapper = await mountView();
    await openCreate(wrapper);
    await openPicker(wrapper);
    await wrapper.findAll(".kk-cleanup-repo-actions button")[0]!.trigger("click");
    await flushPromises();

    await wrapper.find("#cleanup-format").setValue("npm");
    await flushPromises();

    expect(wrapper.findAll(".kk-cleanup-repo-option")).toHaveLength(1);
    expect(wrapper.find(".kk-cleanup-repo-options").text()).toContain("npm-hosted");
    expect(wrapper.find(".kk-cleanup-repo-footer").text()).toBe("0 selected · 1 available");
  });
});
