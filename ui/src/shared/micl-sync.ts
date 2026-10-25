/**
 * Synchronizes input values with MICL's `data-miclvalue` attribute.
 *
 * MICL's floating-label implementation requires `[data-miclvalue="1"]` on the
 * input element for the label to float when populated. While MICL hooks into
 * native user `input` and `change` events, Vue 3's reactive `v-model` binding
 * assigns `.value` programmatically via the prototype setter without firing
 * events. This caused asynchronously loaded data to render with labels sitting
 * inside the input text rather than floating above it.
 */

let installed = false;

function syncElementValue(el: Element | null | undefined): void {
  if (!el) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const hasValue = Boolean(el.value);
    if (hasValue) {
      if (el.dataset.miclvalue !== "1") {
        el.dataset.miclvalue = "1";
      }
    } else {
      if (el.dataset.miclvalue) {
        delete el.dataset.miclvalue;
      }
    }
  }
}

export function syncAllMiclInputs(root: ParentNode = document): void {
  if (typeof document === "undefined") return;
  const elements = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '[class*="micl-textfield-"] > input, [class*="micl-textfield-"] > textarea',
  );
  elements.forEach(syncElementValue);
}

export function installMiclValueSync(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1. Intercept programmatic `.value` setter on HTMLInputElement
  const inputDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (inputDescriptor?.set) {
    const originalSet = inputDescriptor.set;
    Object.defineProperty(HTMLInputElement.prototype, "value", {
      get() {
        return inputDescriptor.get?.call(this);
      },
      set(val: unknown) {
        originalSet.call(this, val);
        syncElementValue(this);
      },
      configurable: true,
      enumerable: inputDescriptor.enumerable,
    });
  }

  // 2. Intercept programmatic `.value` setter on HTMLTextAreaElement
  const textareaDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (textareaDescriptor?.set) {
    const originalTextareaSet = textareaDescriptor.set;
    Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
      get() {
        return textareaDescriptor.get?.call(this);
      },
      set(val: unknown) {
        originalTextareaSet.call(this, val);
        syncElementValue(this);
      },
      configurable: true,
      enumerable: textareaDescriptor.enumerable,
    });
  }

  // 3. Observe dynamic DOM changes and ensure newly mounted inputs are synced
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches('[class*="micl-textfield-"] > input, [class*="micl-textfield-"] > textarea')) {
              syncElementValue(node);
            } else {
              syncAllMiclInputs(node);
            }
          }
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    syncAllMiclInputs(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      syncAllMiclInputs(document.body);
    });
  }
}
