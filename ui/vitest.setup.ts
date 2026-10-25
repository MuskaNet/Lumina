// happy-dom does not implement the Popover API. Components use it to render
// dropdowns in the top layer (so dialogs/overflow containers cannot clip them);
// a minimal shim keeps the unit tests focused on behaviour instead of layout.
if (typeof HTMLElement !== "undefined") {
  const prototype = HTMLElement.prototype as unknown as {
    showPopover?: () => void;
    hidePopover?: () => void;
    togglePopover?: (force?: boolean) => void;
  };
  if (typeof prototype.showPopover !== "function") {
    prototype.showPopover = function showPopover() {
      this.setAttribute("data-test-popover-open", "true");
    };
    prototype.hidePopover = function hidePopover() {
      this.removeAttribute("data-test-popover-open");
    };
    prototype.togglePopover = function togglePopover(force?: boolean) {
      const isOpen = this.hasAttribute("data-test-popover-open");
      if (force === undefined ? isOpen : !force) this.hidePopover?.();
      else this.showPopover?.();
    };
  }
}

// Some happy-dom versions ship an incomplete <dialog> implementation. The login
// dialog calls showModal()/close() when it opens, so keep the tests focused on
// the login flow instead of failing on the platform gap.
if (typeof HTMLDialogElement !== "undefined") {
  const prototype = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof prototype.showModal !== "function") {
    prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (typeof prototype.close !== "function") {
    prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  }
}
