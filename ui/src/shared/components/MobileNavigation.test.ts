import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MobileNavigation from "./MobileNavigation.vue";
import AppShell from "./AppShell.vue";

function renderNavigation() {
  return mount(MobileNavigation, {
    props: { title: "Lumina", navigationLabel: "Repository browser", searchHref: "#browse/search" },
    slots: { default: '<a href="#browse/welcome">Welcome</a>', actions: '<button type="button">Account</button>' },
  });
}

describe("MobileNavigation", () => {
  it("places search at the header end and separates navigation from account actions", () => {
    const wrapper = renderNavigation();
    expect(wrapper.find(".kk-mobile-header > :last-child").attributes("href")).toBe("#browse/search");
    expect(wrapper.find(".kk-mobile-header--drawer a").exists()).toBe(false);
    expect(wrapper.find(".kk-mobile-drawer__navigation").text()).toBe("Welcome");
    expect(wrapper.find(".kk-mobile-drawer__divider").element.nextElementSibling).toBe(wrapper.find(".kk-mobile-drawer__actions").element);
    expect(wrapper.find(".kk-mobile-drawer__actions").text()).toBe("Account");
    const body = wrapper.find(".kk-mobile-drawer__body");
    expect(body.find(".kk-mobile-header--drawer").exists()).toBe(false);
    expect(body.element.previousElementSibling).toBe(wrapper.find(".kk-mobile-header--drawer").element);
    expect(body.find(".kk-mobile-drawer__navigation").exists()).toBe(true);
    expect(body.find(".kk-mobile-drawer__actions").exists()).toBe(true);
    expect(wrapper.find('input[type="search"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("opens a modal drawer and closes after choosing navigation or an account action", async () => {
    const wrapper = renderNavigation();
    const menu = wrapper.find(".kk-mobile-header button");
    const dialog = wrapper.find("dialog").element as HTMLDialogElement;
    await menu.trigger("click");
    expect(dialog.open).toBe(true);
    expect(menu.attributes("aria-expanded")).toBe("true");
    await wrapper.find(".kk-mobile-drawer__navigation a").trigger("click");
    expect(dialog.open).toBe(false);
    await menu.trigger("click");
    await wrapper.find(".kk-mobile-drawer__actions button").trigger("click");
    expect(dialog.open).toBe(false);
    wrapper.unmount();
  });

  it("places admin navigation and former toolbar content into separate drawer sections", () => {
    const wrapper = mount(AppShell, {
      props: { title: "Administration", activeId: "repositories", nav: [{ id: "repositories", label: "Repositories", icon: "inventory_2", href: "#admin/repository/repositories" }] },
    });
    const mobile = wrapper.findComponent(MobileNavigation);
    expect(mobile.find('.kk-mobile-header > a').attributes('href')).toBe('/browse/#browse/search');
    expect(mobile.find('.kk-mobile-drawer__navigation').text()).toContain('Repositories');
    expect(mobile.find('.kk-mobile-drawer__actions a').attributes('href')).toMatch(/^https:\/\//);
    expect(mobile.find('.kk-mobile-drawer__actions').text()).toContain('My Token');
    expect(mobile.find('.kk-mobile-drawer__actions').text()).toContain('Sign out');
    expect(wrapper.find('.kk-bottom-toolbar').exists()).toBe(true);
    wrapper.unmount();
  });

  it("closes the drawer when navigation changes", async () => {
    const wrapper = renderNavigation();
    await wrapper.find(".kk-mobile-header button").trigger("click");
    window.dispatchEvent(new Event("hashchange"));
    expect((wrapper.find("dialog").element as HTMLDialogElement).open).toBe(false);
    wrapper.unmount();
  });
});
