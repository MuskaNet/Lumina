import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3DataTable, { type DataTableColumn, type DataTableSort } from "./M3DataTable.vue";

describe("M3DataTable", () => {
  const columns: DataTableColumn[] = [
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "type", label: "Type", align: "end" },
  ];

  const rows = [
    { id: "1", name: "Alpha", type: "hosted" },
    { id: "2", name: "Beta", type: "proxy" },
  ];

  it("renders table rows and columns correctly", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
      },
    });

    const headers = wrapper.findAll("th");
    expect(headers).toHaveLength(3);
    expect(headers[0].text()).toContain("ID");
    expect(headers[1].text()).toContain("Name");
    expect(headers[2].text()).toContain("Type");

    const bodyRows = wrapper.findAll("tbody tr");
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[0].text()).toContain("Alpha");
    expect(bodyRows[1].text()).toContain("Beta");
  });

  it("emits update:sort when clicking sortable header button", async () => {
    const sort: DataTableSort = { key: "name", direction: "asc" };
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
        sort,
      },
    });

    const sortButtons = wrapper.findAll(".kk-sort-button");
    expect(sortButtons).toHaveLength(2);

    // Clicking name button toggles from asc to desc
    await sortButtons[1].trigger("click");
    expect(wrapper.emitted("update:sort")).toEqual([[{ key: "name", direction: "desc" }]]);
  });

  it("renders M3 linear progress bar when loading and linearProgress is true", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
        loading: true,
        linearProgress: true,
      },
    });

    expect(wrapper.find(".kk-table-progress").exists()).toBe(true);
    expect(wrapper.find(".kk-table-progress__bar").exists()).toBe(true);
  });

  it("omits table-level progress bar by default when loading", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
        loading: true,
      },
    });

    expect(wrapper.find(".kk-table-progress").exists()).toBe(false);
  });

  it("renders expressive empty state when rows are empty", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows: [],
        rowKey: (row: any) => String(row),
        emptyText: "Custom empty message",
        emptyIcon: "folder_open",
      },
    });

    expect(wrapper.find(".kk-table-empty").exists()).toBe(true);
    expect(wrapper.find(".kk-table-empty__text").text()).toContain("Custom empty message");
    expect(wrapper.find(".kk-table-empty__icon").text()).toBe("folder_open");
  });

  it("renders loading spinner and status when loading with no rows", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows: [],
        rowKey: (row: any) => String(row),
        loading: true,
      },
    });

    expect(wrapper.find(".kk-table-loading").exists()).toBe(true);
    expect(wrapper.find(".kk-table-spinner").exists()).toBe(true);
  });

  it("supports clickable rows and emits row-click event", async () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
        clickable: true,
      },
    });

    const bodyRows = wrapper.findAll("tbody tr");
    expect(bodyRows[0].classes()).toContain("is-clickable");
    expect(bodyRows[0].attributes("tabindex")).toBe("0");

    await bodyRows[0].trigger("click");
    expect(wrapper.emitted("row-click")).toBeTruthy();
    expect(wrapper.emitted("row-click")![0][0]).toEqual(rows[0]);
  });

  it("applies density and variant classes", () => {
    const wrapper = mount(M3DataTable, {
      props: {
        columns,
        rows,
        rowKey: (row: any) => row.id,
        density: "compact",
        variant: "segmented",
      },
    });

    const frame = wrapper.find(".kk-table-frame");
    expect(frame.classes()).toContain("kk-table-frame--compact");
    expect(frame.classes()).toContain("kk-table-frame--segmented");
  });
});
