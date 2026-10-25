import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3SchemaForm from "./M3SchemaForm.vue";
import type { FieldDef } from "./schema";

/**
 * Boolean fields in the schema describe a single on/off setting (LDAP `enabled`,
 * `userSubtree`, ...). They must render as MICL switches, not checkboxes.
 */
describe("M3SchemaForm switch fields", () => {
  it("renders a switch input with the switch role", () => {
    const wrapper = mount(M3SchemaForm, {
      props: {
        fields: [{ key: "enabled", label: "Enabled", type: "switch" }],
        model: { enabled: false },
      },
    });

    const control = wrapper.find("input");
    expect(control.exists()).toBe(true);
    expect(control.classes()).toContain("micl-switch");
    expect(control.classes()).not.toContain("micl-checkbox");
    expect(control.attributes("type")).toBe("checkbox");
    expect(control.attributes("role")).toBe("switch");
    expect((control.element as HTMLInputElement).checked).toBe(false);

    // The wrapped label is what makes the whole row clickable in MICL.
    expect(wrapper.find("label.kk-switch-row").text()).toContain("Enabled");
  });

  it("writes the toggled value back into the draft model", async () => {
    const model: Record<string, unknown> = { enabled: false };
    const wrapper = mount(M3SchemaForm, {
      props: { fields: [{ key: "enabled", label: "Enabled", type: "switch" }], model },
    });

    await wrapper.find("input").setValue(true);
    expect(model.enabled).toBe(true);
    expect((wrapper.find("input").element as HTMLInputElement).checked).toBe(true);

    await wrapper.find("input").setValue(false);
    expect(model.enabled).toBe(false);
  });

  it("dims disabled and read-only switches without dropping the role", () => {
    const fields: FieldDef[] = [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "subtree", label: "Subtree", type: "switch", readOnly: true },
    ];
    const wrapper = mount(M3SchemaForm, {
      props: { fields, model: { enabled: true, subtree: true }, disabled: true },
    });

    const controls = wrapper.findAll("input");
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control.attributes("disabled")).toBeDefined();
      expect(control.attributes("role")).toBe("switch");
    }
  });
});
