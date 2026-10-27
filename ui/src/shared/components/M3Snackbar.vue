<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { snackbar, dismissToast } from "../snackbar";
import { t } from "../i18n";

const host = ref<HTMLElement | null>(null);

const icon = computed(() => {
  switch (snackbar.value?.tone) {
    case "ok":
      return "check_circle";
    case "error":
      return "error";
    default:
      return "info";
  }
});

watch(snackbar, (message) => {
  const element = host.value;
  if (!element) return;
  if (!message) {
    if (element.matches(":popover-open")) element.hidePopover();
    return;
  }
  if (element.matches(":popover-open")) element.hidePopover();
  element.showPopover();
});

function onToggle(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (!element.matches(":popover-open")) dismissToast();
}

function dismiss() {
  const element = host.value;
  if (element?.matches(":popover-open")) {
    element.hidePopover();
  }
  dismissToast();
}
</script>

<template>
  <div
    ref="host"
    class="micl-snackbar kk-snackbar"
    :class="snackbar ? `kk-snackbar--${snackbar.tone}` : undefined"
    popover="manual"
    data-micldelay="4000"
    @toggle="onToggle"
  >
    <div class="kk-snackbar__body">
      <span class="kk-snackbar__icon material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
      <span class="micl-snackbar__supporting-text" role="status" aria-atomic="true">{{ snackbar?.text }}</span>
    </div>
    <button
      type="button"
      class="kk-snackbar__close"
      :aria-label="t('Close')"
      :title="t('Close')"
      @click="dismiss"
    >
      <span class="material-symbols-outlined" aria-hidden="true">close</span>
    </button>
  </div>
</template>

<style scoped>
/* ---- Snackbar / Toast --------------------------------------------------
 * Material Design 3 Expressive Snackbar enhancements.
 * Positioned at the top on PC, centered in the main content area (accounting
 * for the 80px side rail, matching the floating toolbar horizontal center).
 */

.micl-snackbar.kk-snackbar {
  position: fixed !important;
  inset-block-start: max(20px, env(safe-area-inset-top, 20px)) !important;
  inset-block-end: auto !important;
  inset-inline: auto !important;
  inset-inline-start: calc(50% + 40px) !important; /* accounts for 80px side rail */
  inset-inline-end: auto !important;
  transform: translateX(-50%) !important;
  margin-block: 0 !important;
  margin-inline: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 12px !important;
  min-inline-size: min(320px, calc(100vw - 32px)) !important;
  max-inline-size: min(560px, calc(100vw - 32px)) !important;
  inline-size: fit-content !important;
  padding: 8px 8px 8px 16px !important;
  border-radius: var(--md-sys-shape-corner-medium, 12px) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.1)) !important;
  z-index: 100000 !important;
}

.micl-snackbar.kk-snackbar:not(:popover-open) {
  pointer-events: none !important;
}

@media (max-width: 768px) {
  .micl-snackbar.kk-snackbar {
    inset-block-start: max(12px, env(safe-area-inset-top, 12px)) !important;
    inset-block-end: auto !important;
    inset-inline-start: 50% !important;
  }
}

.kk-snackbar__body {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-inline-size: 0;
}

.kk-snackbar__icon {
  font-size: 22px !important;
  inline-size: 22px !important;
  block-size: 22px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--md-sys-color-inverse-primary, currentColor);
}

.kk-snackbar--ok .kk-snackbar__icon {
  color: var(--md-sys-color-inverse-primary, #82d5c7) !important;
}

.kk-snackbar--error .kk-snackbar__icon {
  color: var(--md-sys-color-error, #ba1a1a) !important;
}

.kk-snackbar--info .kk-snackbar__icon {
  color: var(--md-sys-color-inverse-on-surface, #ecf2ef) !important;
}

.micl-snackbar.kk-snackbar .micl-snackbar__supporting-text {
  font-family: var(--md-ref-typeface-plain);
  font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
  line-height: 1.25rem;
  color: var(--md-comp-snackbar-supporting-text-color, var(--md-sys-color-inverse-on-surface));
  overflow-wrap: anywhere;
  text-align: start;
}

.kk-snackbar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 32px;
  block-size: 32px;
  min-inline-size: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--md-comp-snackbar-icon-color, var(--md-sys-color-inverse-on-surface));
  cursor: pointer;
  margin-inline-start: auto;
  flex-shrink: 0;
  opacity: 0.8;
  transition: opacity 150ms ease, background-color 150ms ease;
}

.kk-snackbar__close .material-symbols-outlined {
  font-size: 18px;
}

.kk-snackbar__close:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.12);
}

.kk-snackbar__close:focus-visible {
  outline: 2px solid var(--md-sys-color-inverse-primary);
  outline-offset: 1px;
}
</style>
