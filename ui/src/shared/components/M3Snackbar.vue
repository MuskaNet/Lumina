<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { snackbar, dismissToast } from "../snackbar";

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
    element.hidePopover();
    return;
  }
  if (element.matches(":popover-open")) element.hidePopover();
  element.showPopover();
});

function onToggle(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (!element.matches(":popover-open")) dismissToast();
}
</script>

<template>
  <div
    ref="host"
    class="micl-snackbar"
    :class="snackbar ? `kk-snackbar--${snackbar.tone}` : undefined"
    popover="manual"
    data-micldelay="4000"
    @toggle="onToggle"
  >
    <span class="micl-snackbar__icon material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
    <span class="micl-snackbar__supporting-text" role="status" aria-atomic="true">{{ snackbar?.text }}</span>
  </div>
</template>
