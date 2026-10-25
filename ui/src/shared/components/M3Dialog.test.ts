import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import M3Dialog from "./M3Dialog.vue";

describe("M3Dialog", () => {
  it("renders standard M3 dialog structure with headline, content and actions", () => {
    const wrapper = mount(M3Dialog, {
      props: {
        title: "Test Dialog",
        subtitle: "A description of the action",
        icon: "delete",
        destructive: true,
      },
      slots: {
        default: "<p>Dialog body text</p>",
      },
    });

    const dialog = wrapper.find("dialog.micl-dialog");
    expect(dialog.exists()).toBe(true);
    expect(dialog.classes()).toContain("has-icon");

    // Headline with icon and title block
    const headline = wrapper.find(".micl-dialog__headline");
    expect(headline.exists()).toBe(true);
    expect(headline.find(".micl-dialog__icon").text()).toBe("delete");
    expect(headline.find(".micl-dialog__icon").classes()).toContain("is-destructive");
    expect(headline.find("h2").text()).toBe("Test Dialog");
    expect(headline.find(".micl-dialog__supporting-text").text()).toBe("A description of the action");

    // Content container
    const content = wrapper.find(".micl-dialog__content");
    expect(content.exists()).toBe(true);
    expect(content.text()).toContain("Dialog body text");

    // Actions container with destructive button
    const actions = wrapper.find(".micl-dialog__actions");
    expect(actions.exists()).toBe(true);
    const confirmBtn = actions.find("button.is-destructive");
    expect(confirmBtn.exists()).toBe(true);
  });

  it("emits confirm and cancel events", async () => {
    const wrapper = mount(M3Dialog, {
      props: {
        title: "Confirm Action",
        confirmLabel: "Proceed",
        cancelLabel: "Dismiss",
      },
    });

    const buttons = wrapper.findAll(".micl-dialog__actions button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text()).toBe("Dismiss");
    expect(buttons[1].text()).toBe("Proceed");

    await buttons[1].trigger("click");
    expect(wrapper.emitted("confirm")).toBeTruthy();

    await buttons[0].trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("renders error message inside the content container", () => {
    const wrapper = mount(M3Dialog, {
      props: {
        title: "Dialog with error",
        error: "Something went wrong.",
      },
    });

    const content = wrapper.find(".micl-dialog__content");
    const error = content.find(".kk-form-error");
    expect(error.exists()).toBe(true);
    expect(error.text()).toBe("Something went wrong.");
  });

  it("hides cancel button when hideCancel is true", () => {
    const wrapper = mount(M3Dialog, {
      props: {
        title: "Info Only",
        hideCancel: true,
        confirmLabel: "Understood",
      },
    });

    const buttons = wrapper.findAll(".micl-dialog__actions button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe("Understood");
  });
});
