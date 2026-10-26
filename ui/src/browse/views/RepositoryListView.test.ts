import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const showToast = vi.hoisted(() => vi.fn());
vi.mock("../../shared/snackbar", () => ({ showToast }));

import RepositoryListView from "./RepositoryListView.vue";
import type { Repository } from "../repositoryUrls";

const REPOSITORIES: Repository[] = [
  {
    name: "maven-hosted",
    format: "maven2",
    type: "HOSTED",
    online: true,
    url: "/repository/maven-hosted/",
  },
  {
    name: "docker-hub",
    format: "docker",
    type: "PROXY",
    online: true,
    docker: { connectorEnabled: true, connectorPublicUrl: "https://hub.example.com/" },
  },
  {
    name: "raw-dev",
    format: "raw",
    type: "GROUP",
    online: false,
    url: "/repository/raw-dev/",
  },
];

let wrapper: VueWrapper | null = null;

function mountView(repositories: Repository[] = REPOSITORIES): VueWrapper {
  wrapper = mount(RepositoryListView, { props: { repositories } });
  return wrapper;
}

function rowNames(view: VueWrapper): string[] {
  return view.findAll(".kk-repo-name").map((name) => name.text());
}

function rowFor(view: VueWrapper, name: string) {
  const row = view.findAll("tbody tr").find((candidate) => candidate.text().includes(name));
  expect(row, `row ${name}`).toBeDefined();
  return row!;
}

function sortButton(view: VueWrapper, label: string) {
  const button = view.findAll(".kk-sort-button").find((candidate) => candidate.text().includes(label));
  expect(button, `sort button ${label}`).toBeDefined();
  return button!;
}

function stubClipboard(writeText: (text: string) => Promise<void> = async () => undefined) {
  const clipboard = { writeText: vi.fn(writeText) };
  Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => clipboard });
  return clipboard;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  delete (document as unknown as { execCommand?: unknown }).execCommand;
});

describe("RepositoryListView", () => {
  it("renders the catalog columns, repository rows and client URLs", () => {
    const view = mountView();

    const headers = view.findAll("thead th").map((th) => {
      const label = th.find(".kk-sort-button span:not(.kk-sort-icon)");
      return label.exists() ? label.text() : th.text();
    });
    expect(headers).toEqual(["", "Name", "Type", "Format", "Status", "URL"]);
    expect(rowNames(view)).toEqual(["docker-hub", "maven-hosted", "raw-dev"]);

    const dockerRow = rowFor(view, "docker-hub");
    expect(dockerRow.find(".material-symbols-outlined").text()).toBe("cloud_download");
    expect(dockerRow.find(".format-cell .format-logo-docker").exists()).toBe(true);
    expect(dockerRow.find(".format-cell-label").text()).toBe("docker");
    expect(dockerRow.find(".kk-badge--ok").text()).toBe("Online");
    expect(dockerRow.find("a.kk-repo-url__link").attributes("href")).toBe("https://hub.example.com");

    const mavenRow = rowFor(view, "maven-hosted");
    expect(mavenRow.find(".material-symbols-outlined").text()).toBe("inventory_2");
    expect(mavenRow.find(".format-cell .format-logo-maven").exists()).toBe(true);
    expect(new URL(mavenRow.find("a.kk-repo-url__link").attributes("href")!).pathname).toBe(
      "/repository/maven-hosted/",
    );

    const groupRow = rowFor(view, "raw-dev");
    expect(groupRow.find(".material-symbols-outlined").text()).toBe("hub");
    expect(groupRow.find(".kk-badge--bad").text()).toBe("Offline");
  });

  it("filters across repository name, type, format and status", async () => {
    const view = mountView();

    await view.find("#repository-filter").setValue("docker");
    expect(rowNames(view)).toEqual(["docker-hub"]);

    await view.find("#repository-filter").setValue("offline");
    expect(rowNames(view)).toEqual(["raw-dev"]);

    await view.find("#repository-filter").setValue("maven2");
    expect(rowNames(view)).toEqual(["maven-hosted"]);

    await view.find("#repository-filter").setValue("missing");
    expect(rowNames(view)).toEqual([]);
    expect(view.find(".kk-table-empty__text").text()).toBe("No repositories found.");
  });

  it("sorts by the sortable columns and toggles direction", async () => {
    const view = mountView();

    expect(rowNames(view)).toEqual(["docker-hub", "maven-hosted", "raw-dev"]);

    await sortButton(view, "Type").trigger("click");
    expect(rowNames(view)).toEqual(["raw-dev", "maven-hosted", "docker-hub"]);

    await sortButton(view, "Type").trigger("click");
    expect(rowNames(view)).toEqual(["docker-hub", "maven-hosted", "raw-dev"]);

    await sortButton(view, "Format").trigger("click");
    expect(rowNames(view)).toEqual(["docker-hub", "maven-hosted", "raw-dev"]);
  });

  it("opens the repository tree from a row but not from its URL controls", async () => {
    const view = mountView();

    const mavenRow = rowFor(view, "maven-hosted");
    await mavenRow.trigger("click");
    expect(view.emitted("open")).toEqual([["maven-hosted"]]);

    // The URL link keeps its own behaviour; drop `href` so happy-dom does not
    // start a navigation while the row-click guard is exercised.
    const link = mavenRow.find("a.kk-repo-url__link");
    link.element.removeAttribute("href");
    await link.trigger("click");
    await mavenRow.find(".kk-repo-url__copy").trigger("click");
    expect(view.emitted("open")).toHaveLength(1);
  });

  it("copies the client URL and confirms it on the button", async () => {
    const clipboard = stubClipboard();
    const view = mountView();

    const dockerRow = rowFor(view, "docker-hub");
    await dockerRow.find(".kk-repo-url__copy").trigger("click");
    await flushPromises();

    expect(clipboard.writeText).toHaveBeenCalledWith("https://hub.example.com");
    expect(showToast).toHaveBeenCalledWith("Repository URL copied", "ok");
    const copyButton = dockerRow.find(".kk-repo-url__copy");
    expect(copyButton.attributes("aria-label")).toBe("Copied");
    expect(copyButton.find(".material-symbols-outlined").text()).toBe("check");
  });

  it("falls back to the legacy copy command outside secure contexts", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => undefined });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    const view = mountView();

    await rowFor(view, "maven-hosted").find(".kk-repo-url__copy").trigger("click");
    await flushPromises();

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(showToast).toHaveBeenCalledWith("Repository URL copied", "ok");
  });

  it("reports a clipboard failure instead of claiming success", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    const view = mountView();

    await rowFor(view, "maven-hosted").find(".kk-repo-url__copy").trigger("click");
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith("Unable to copy repository URL", "error");
    expect(showToast).not.toHaveBeenCalledWith("Repository URL copied", "ok");
  });

  it("renders the empty state when the catalog is empty", () => {
    const view = mountView([]);

    expect(view.findAll("tbody tr")).toHaveLength(1);
    expect(view.find(".kk-table-empty__text").text()).toBe("No repositories found.");
  });
});
