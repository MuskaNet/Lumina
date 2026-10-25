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
