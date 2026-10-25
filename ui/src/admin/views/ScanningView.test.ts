import { beforeEach, describe, expect, it, vi } from "vitest";
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

import ScanningView from "./ScanningView.vue";

interface CursorPage {
  items: Record<string, unknown>[];
  nextAfter?: number | null;
}

function listRequests(): URLSearchParams[] {
  return mocks.get.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.startsWith("/internal/security/scanning/") && !path.includes("/summary"))
    .map((path) => new URL(path, "http://kkrepo.test").searchParams);
}

function lastRequest(): URLSearchParams {
  return listRequests().at(-1)!;
}

async function selectTab(wrapper: VueWrapper, label: string): Promise<void> {
  const tab = wrapper.findAll(".kk-tab").find((node) => node.text() === label);
  expect(tab, `tab ${label}`).toBeTruthy();
  await tab!.trigger("click");
  await flushPromises();
}

async function clickButton(wrapper: VueWrapper, label: string): Promise<void> {
  const button = wrapper.findAll("button").find((node) => node.text() === label);
  expect(button).toBeTruthy();
  await button!.trigger("click");
  await flushPromises();
}

describe("ScanningView findings filter", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.send.mockReset();
    mocks.delete.mockReset();
    mocks.get.mockImplementation(async (path: string) => {
      if (path.includes("/summary")) {
        return { deploymentEnabled: true, summary: {} };
      }
      return { items: [{ id: 1, advisoryId: "CVE-2026-0001" }], nextAfter: null };
    });
  });

  it("asks for current findings by default on the findings tab only", async () => {
    const wrapper = mount(ScanningView);
    await flushPromises();

    // The overview request must not carry the findings filter.
    expect(wrapper.find(".kk-current-findings").exists()).toBe(false);

    await selectTab(wrapper, "Findings");

    const request = lastRequest();
    expect(request.get("currentOnly")).toBe("true");
    expect(request.get("after")).toBe("0");
    expect(wrapper.find(".kk-current-findings input").element).toHaveProperty("checked", true);

    await selectTab(wrapper, "Tasks");
    expect(lastRequest().has("currentOnly")).toBe(false);
  });

  it("keeps the search term and size but resets pagination when the filter flips", async () => {
    mocks.get.mockImplementation(async (path: string) => {
      if (path.includes("/summary")) {
        return { deploymentEnabled: true, summary: {} };
      }
      return { items: [{ id: 1, advisoryId: "CVE-2026-0001" }], nextAfter: 7 };
    });

    const wrapper = mount(ScanningView);
    await flushPromises();
    await selectTab(wrapper, "Findings");

    await wrapper.find("#scan-search").setValue("app");
    await wrapper.find("#scan-search").trigger("keyup.enter");
    await flushPromises();
    expect(lastRequest().get("q")).toBe("app");
    expect(lastRequest().get("currentOnly")).toBe("true");

    await clickButton(wrapper, "Next");
    expect(lastRequest().get("after")).toBe("7");
    expect(wrapper.text()).toContain("Page 2");

    await wrapper.find(".kk-current-findings input").setValue(false);
    await flushPromises();

    const request = lastRequest();
    expect(request.get("currentOnly")).toBe("false");
    expect(request.get("q")).toBe("app");
    expect(request.get("after")).toBe("0");
    expect(wrapper.text()).toContain("Page 1");
  });

  it("ignores a superseded historical response that resolves late", async () => {
    const pending: ((page: CursorPage) => void)[] = [];
    mocks.get.mockImplementation((path: string) => {
      if (path.includes("/summary")) {
        return Promise.resolve({ deploymentEnabled: true, summary: {} });
      }
      return new Promise<CursorPage>((resolve) => pending.push(resolve));
    });

    const wrapper = mount(ScanningView);
    await flushPromises();
    await selectTab(wrapper, "Findings");
    // The tab switch already requested the default current view.
    expect(pending).toHaveLength(1);

    await wrapper.find(".kk-current-findings input").setValue(false);
    expect(pending).toHaveLength(2);

    pending[1]!({ items: [{ id: 2, advisoryId: "CVE-HISTORICAL" }], nextAfter: null });
    await flushPromises();
    expect(wrapper.text()).toContain("CVE-HISTORICAL");

    // The stale current-only response arrives after the user already switched.
    pending[0]!({ items: [{ id: 1, advisoryId: "CVE-CURRENT" }], nextAfter: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain("CVE-HISTORICAL");
    expect(wrapper.text()).not.toContain("CVE-CURRENT");
  });
});
