/**
 * Scoped artifact scanning authorization for the Primary console.
 *
 * Upstream PR #466 lets an account hold `nexus:security-scanning:read` without
 * any write grant. The server reports the per-row decision (`canManage`,
 * `canRescan`, `canConfigure`, `canDelete`) and the console must combine it
 * with the account's own grants: a reader never sees a mutation control and
 * never issues a mutation request, while `summary.deploymentEnabled` only
 * decides whether scanning is available at all.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  send: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../shared/api/client", () => ({
  api: mocks,
  ApiError: class ApiError extends Error {},
}));

import { permissions, session } from "../../shared/session";
import ScanningView from "./ScanningView.vue";

type Row = Record<string, unknown>;

/** A scoped reader: read access only. */
const READER = ["nexus:security-scanning:read"];
/** Read plus the concrete update action. */
const UPDATER = ["nexus:security-scanning:read,update"];

/** Row fixtures where the server marked every mutation as allowed. */
const ROWS: Record<string, Row[]> = {
  tasks: [
    { id: 1, repository: "npm-proxy", assetId: 7, stage: "CATALOG", status: "FAILED", canManage: true, canRescan: true },
  ],
  findings: [
    { id: 2, advisoryId: "CVE-2026-0001", packageName: "demo", severity: "HIGH", canCreateWaiver: true },
  ],
  repositories: [
    { id: 3, name: "npm-proxy", format: "npm", type: "PROXY", canConfigure: true },
  ],
  policies: [
    { id: 4, name: "strict", enabled: true, blockSeverity: "HIGH" },
  ],
  waivers: [
    { id: 5, advisorySelector: "CVE-2026-0001", scopeType: "repository", canDelete: true },
  ],
};

/** Mutation helpers the view exposes through `<script setup>`. */
interface ScanningVm {
  securityScanCanMutate: (permission?: string) => boolean;
  canManageTask: (row: Row) => boolean;
  canRescanTask: (row: Row) => boolean;
  canConfigureRepository: (row: Row) => boolean;
  canCreateWaiverFor: (row: Row) => boolean;
  rescanAsset: (row: Row) => Promise<void>;
  taskAction: (row: Row, action: "retry" | "cancel") => Promise<void>;
  openPolicy: (row?: Row) => void;
  savePolicy: () => Promise<void>;
  openConfig: (row: Row) => Promise<void>;
  saveConfig: () => Promise<void>;
  openWaiver: (finding?: Row) => void;
  saveWaiver: () => Promise<void>;
  askDelete: (row: Row) => void;
  confirmDelete: () => Promise<void>;
}
interface Harness {
  wrapper: VueWrapper;
  vm: ScanningVm;
}

/** Mounts the view with one grant set and one deployment state. */
async function openView(granted: string[], deploymentEnabled = true): Promise<Harness> {
  permissions.value = [...granted];
  session.value = { source: "local", userId: "reader" };
  mocks.get.mockReset();
  mocks.send.mockReset();
  mocks.delete.mockReset();
  mocks.get.mockImplementation(async (path: string) => {
    if (path.includes("/summary")) return { deploymentEnabled, summary: {} };
    if (path.includes("/config")) {
      return { enforcementMode: "AUDIT", pendingAction: "ALLOW", failureAction: "ALLOW", partialAction: "ALLOW" };
    }
    const tab = path.split("?")[0]!.split("/").pop()!;
    return { items: ROWS[tab] ?? [], nextAfter: null };
  });
  mocks.send.mockResolvedValue({});
  mocks.delete.mockResolvedValue({});
  const wrapper = mount(ScanningView);
  await flushPromises();
  return { wrapper, vm: wrapper.vm as unknown as ScanningVm };
}

const mounted: VueWrapper[] = [];

async function open(granted: string[], deploymentEnabled = true): Promise<Harness> {
  const harness = await openView(granted, deploymentEnabled);
  mounted.push(harness.wrapper);
  return harness;
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  permissions.value = [];
  session.value = null;
});

async function selectTab(wrapper: VueWrapper, label: string): Promise<void> {
  const tab = wrapper.findAll(".kk-tab").find((node) => node.text() === label);
  expect(tab, `tab ${label}`).toBeTruthy();
  await tab!.trigger("click");
  await flushPromises();
}

/**
 * Labels of the page's actionable buttons, so absence assertions stay readable.
 * Dialog buttons are excluded: `M3Dialog` always renders its own Cancel/Save
 * pair into the DOM (the element only becomes modal when opened), and those are
 * not page mutation controls.
 */
function buttonLabels(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll("button")
    .filter((button) => !button.element.closest("dialog"))
    .map((button) => visibleLabel(button.element));
}

/** Button text without the decorative Material Symbols ligature text. */
function visibleLabel(element: Element): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".material-symbols-outlined").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

function findButton(wrapper: VueWrapper, label: string) {
  return wrapper.findAll("button").find((button) => visibleLabel(button.element) === label);
}

/** Requests that change scanning state, as opposed to the read-only loads. */
function mutationRequests(): string[] {
  return [
    ...mocks.send.mock.calls.map(([path]) => `send ${String(path)}`),
    ...mocks.delete.mock.calls.map(([path]) => `delete ${String(path)}`),
  ];
}

function listRequests(): string[] {
  return mocks.get.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.startsWith("/internal/security/scanning/") && !path.includes("/summary"));
}

describe("ScanningView scoped reader authorization", () => {
  it("shows a reader no retry, cancel, rescan, configure, policy or waiver mutation controls", async () => {
    const { wrapper } = await open(READER);

    // The default Tasks tab keeps retry/cancel/rescan hidden even though the
    // server reported canManage/canRescan for the row.
    expect(buttonLabels(wrapper)).not.toContain("Retry");
    expect(buttonLabels(wrapper)).not.toContain("Cancel");
    expect(buttonLabels(wrapper)).not.toContain("Rescan");

    await selectTab(wrapper, "Findings");
    expect(buttonLabels(wrapper)).not.toContain("Rescan");
    expect(buttonLabels(wrapper)).not.toContain("Waive");

    await selectTab(wrapper, "Repositories");
    expect(buttonLabels(wrapper)).not.toContain("Configure");

    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).not.toContain("Create policy");
    expect(buttonLabels(wrapper)).not.toContain("Edit");
    expect(buttonLabels(wrapper)).not.toContain("Delete");

    await selectTab(wrapper, "Waivers");
    expect(buttonLabels(wrapper)).not.toContain("Create waiver");
    expect(buttonLabels(wrapper)).not.toContain("Delete");

    expect(mutationRequests()).toEqual([]);
  });

  it("lets a reader keep read-only navigation, search and refresh controls", async () => {
    const { wrapper } = await open(READER);

    expect(wrapper.find("#scan-search").exists()).toBe(true);
    expect(findButton(wrapper, "Refresh")).toBeTruthy();
    expect(findButton(wrapper, "Previous")).toBeTruthy();
    expect(findButton(wrapper, "Next")).toBeTruthy();
    for (const label of ["Tasks", "Findings", "Repositories", "Policies", "Waivers"]) {
      expect(wrapper.findAll(".kk-tab").some((tab) => tab.text() === label), label).toBe(true);
    }
    // The capability rows stay readable: readers see the values, not the actions.
    expect(wrapper.text()).toContain("npm-proxy");
  });

  it("sends no request when a reader reaches the mutation handlers directly", async () => {
    const { vm } = await open(READER);
    const task = ROWS.tasks![0]!;
    const finding = ROWS.findings![0]!;
    const repository = ROWS.repositories![0]!;
    const policy = ROWS.policies![0]!;
    const waiver = ROWS.waivers![0]!;

    await vm.taskAction(task, "retry");
    await vm.taskAction(task, "cancel");
    await vm.rescanAsset(finding);
    await vm.openConfig(repository);
    await vm.saveConfig();
    vm.openPolicy(policy);
    vm.openPolicy();
    await vm.savePolicy();
    vm.askDelete(policy);
    await vm.confirmDelete();
    vm.openWaiver();
    await vm.saveWaiver();
    vm.askDelete(waiver);
    await vm.confirmDelete();
    await flushPromises();

    expect(vm.securityScanCanMutate()).toBe(false);
    expect(vm.securityScanCanMutate("nexus:security-scanning-waivers:create")).toBe(false);
    expect(mutationRequests()).toEqual([]);
    // A reader must not even load the repository scan configuration form.
    expect(listRequests().filter((path) => path.includes("/config"))).toEqual([]);
  });

  it("reveals the update controls for nexus:security-scanning:read,update", async () => {
    const { wrapper, vm } = await open(UPDATER);
    expect(vm.securityScanCanMutate()).toBe(true);

    expect(buttonLabels(wrapper)).toContain("Retry");
    expect(buttonLabels(wrapper)).toContain("Cancel");
    // Rescan lives on the task that owns the asset, matching the legacy console.
    expect(buttonLabels(wrapper)).toContain("Rescan");
    await findButton(wrapper, "Retry")!.trigger("click");
    await flushPromises();
    expect(mocks.send).toHaveBeenCalledWith("/internal/security/scanning/tasks/1/retry", "POST");

    await selectTab(wrapper, "Findings");
    // The update grant does not carry the separate waiver-create grant.
    expect(buttonLabels(wrapper)).not.toContain("Waive");

    await selectTab(wrapper, "Repositories");
    expect(buttonLabels(wrapper)).toContain("Configure");

    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).toContain("Create policy");
    expect(buttonLabels(wrapper)).toContain("Edit");
    expect(buttonLabels(wrapper)).toContain("Delete");
  });

  it("keeps the waiver grants independent from the scan update grant", async () => {
    const waiverGrants = [
      "nexus:security-scanning:read",
      "nexus:security-scanning-waivers:create",
      "nexus:security-scanning-waivers:delete",
    ];
    const { wrapper, vm } = await open(waiverGrants);

    expect(vm.securityScanCanMutate()).toBe(false);
    expect(vm.securityScanCanMutate("nexus:security-scanning-waivers:create")).toBe(true);

    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).not.toContain("Create policy");

    await selectTab(wrapper, "Waivers");
    expect(buttonLabels(wrapper)).toContain("Create waiver");
    expect(buttonLabels(wrapper)).toContain("Delete");

    await selectTab(wrapper, "Findings");
    expect(buttonLabels(wrapper)).not.toContain("Rescan");
    // The waiver grant applies to the finding action even without the scan update grant.
    expect(buttonLabels(wrapper)).toContain("Waive");
  });

  it("treats the nexus:security-scanning:edit alias as the update action", async () => {
    const { wrapper, vm } = await open(["nexus:security-scanning:read", "nexus:security-scanning:edit"]);

    expect(vm.securityScanCanMutate()).toBe(true);
    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).toContain("Create policy");
    expect(buttonLabels(wrapper)).toContain("Edit");

    await selectTab(wrapper, "Repositories");
    expect(buttonLabels(wrapper)).toContain("Configure");
  });

  it("hides every mutation control when the deployment is disabled, whatever the grant", async () => {
    const { wrapper, vm } = await open(["nexus:*"], false);
    expect(vm.securityScanCanMutate()).toBe(false);
    expect(vm.securityScanCanMutate("nexus:security-scanning-waivers:create")).toBe(false);

    expect(buttonLabels(wrapper)).not.toContain("Retry");
    expect(buttonLabels(wrapper)).not.toContain("Cancel");
    await selectTab(wrapper, "Findings");
    expect(buttonLabels(wrapper)).not.toContain("Rescan");
    await selectTab(wrapper, "Repositories");
    expect(buttonLabels(wrapper)).not.toContain("Configure");
    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).not.toContain("Create policy");
    expect(buttonLabels(wrapper)).not.toContain("Edit");
    expect(buttonLabels(wrapper)).not.toContain("Delete");
    await selectTab(wrapper, "Waivers");
    expect(buttonLabels(wrapper)).not.toContain("Create waiver");
    expect(buttonLabels(wrapper)).not.toContain("Delete");
  });

  it("does not turn a reader into a writer when the deployment becomes ready on refresh", async () => {
    const { wrapper, vm } = await open(READER, false);

    // The same account refreshes after the deployment was enabled.
    mocks.get.mockImplementation(async (path: string) => {
      if (path.includes("/summary")) return { deploymentEnabled: true, summary: {} };
      const tab = path.split("?")[0]!.split("/").pop()!;
      return { items: ROWS[tab] ?? [], nextAfter: null };
    });
    await findButton(wrapper, "Refresh")!.trigger("click");
    await flushPromises();

    expect(vm.securityScanCanMutate()).toBe(false);
    expect(buttonLabels(wrapper)).not.toContain("Retry");
    await selectTab(wrapper, "Policies");
    expect(buttonLabels(wrapper)).not.toContain("Create policy");
    await selectTab(wrapper, "Waivers");
    expect(buttonLabels(wrapper)).not.toContain("Create waiver");
  });

  it("combines the grant with the server row capability in both directions", async () => {
    const { vm } = await open(UPDATER);

    // The server still owns the per-row decision: an update grant alone does
    // not enable an action the server denied.
    expect(vm.canManageTask({ id: 1, canManage: false })).toBe(false);
    expect(vm.canRescanTask({ id: 1, assetId: 7, canRescan: false })).toBe(false);
    expect(vm.canConfigureRepository({ id: 3, canConfigure: false })).toBe(false);
    // An asset-less task has no rescan target.
    expect(vm.canRescanTask({ id: 1, assetId: null, canRescan: true })).toBe(false);

    expect(vm.canManageTask({ id: 1, canManage: true })).toBe(true);
    expect(vm.canRescanTask({ id: 1, assetId: 7, canRescan: true })).toBe(true);
    expect(vm.canConfigureRepository({ id: 3, canConfigure: true })).toBe(true);
  });
});
