import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn(), send: vi.fn(), navigate: vi.fn() }));
vi.mock("../../shared/api/client", () => ({ api: mocks }));
vi.mock("../route", () => ({ browseHash: (repo: string) => `#browse/browse/${repo}`, navigate: mocks.navigate }));
vi.mock("../../shared/snackbar", () => ({ showToast: vi.fn() }));
import UploadView from "./UploadView.vue";

const definitions = [
  { format: "raw", multipleUpload: true, componentFields: [{ name: "directory", type: "STRING", description: "Directory", optional: false }],
    assetFields: [{ name: "asset", type: "FILE", description: "File", optional: false }, { name: "filename", type: "STRING", description: "Filename", optional: false }] },
  { format: "alpine", multipleUpload: false, componentFields: [{ name: "distribution", type: "STRING", description: "Distribution", optional: false }],
    assetFields: [{ name: "asset", type: "FILE", description: "File", optional: false }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((path: string) => Promise.resolve(path.includes("upload-specs") ? definitions : [
    { name: "raw-one", format: "raw" }, { name: "raw-two", format: "raw" }, { name: "alpine", format: "alpine" }, { name: "docker", format: "docker" },
  ]));
  mocks.send.mockResolvedValue(null);
});

async function selectFile(wrapper: ReturnType<typeof mount>, name = "demo.txt") {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: [new File(["fixture"], name)] });
  await input.trigger("change");
}

describe("UploadView", () => {
  it("renders spec fields and excludes unsupported formats", async () => {
    const wrapper = mount(UploadView, { props: { repositories: [] } });
    await flushPromises();
    expect(wrapper.get("select").text()).not.toContain("docker");
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(1);
    await wrapper.get("select").setValue("alpine");
    expect(wrapper.find('#upload-component-distribution').exists()).toBe(true);
    expect(wrapper.find('#upload-component-directory').exists()).toBe(false);
    wrapper.unmount();
  });

  it("autofills filenames and submits the correct form data", async () => {
    const wrapper = mount(UploadView, { props: { repositories: [] } });
    await flushPromises();
    await wrapper.get('#upload-component-directory').setValue("releases");
    await selectFile(wrapper);
    expect((wrapper.get('input[id$="-filename"]').element as HTMLInputElement).value).toBe("demo.txt");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0]![0]).toContain("repository=raw-one");
    expect((mocks.send.mock.calls[0]![2] as FormData).get("raw.asset1.filename")).toBe("demo.txt");
    expect(mocks.navigate).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("resets visible file controls when switching repositories of the same format", async () => {
    const wrapper = mount(UploadView, { props: { repositories: [] } });
    await flushPromises();
    await selectFile(wrapper);
    const previous = wrapper.get('input[type="file"]').element;
    await wrapper.get("select").setValue("raw-two");
    expect(wrapper.get('input[type="file"]').element).not.toBe(previous);
    await wrapper.get("form").trigger("submit");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("required");
    wrapper.unmount();
  });

  it("does not fall back to raw or readable repositories when loading fails", async () => {
    mocks.get.mockRejectedValue(new Error("Upload specs unavailable"));
    const wrapper = mount(UploadView, { props: { repositories: [{ name: "raw-readable", format: "raw", type: "hosted" }] } });
    await flushPromises();
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("unavailable");
    wrapper.unmount();
  });
});
