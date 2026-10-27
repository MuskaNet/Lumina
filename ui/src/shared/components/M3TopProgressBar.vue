<script setup lang="ts">
import { computed } from "vue";
import { progressBarState } from "../progress";
import { t } from "../i18n";

const isVisible = computed(() => progressBarState.visible);
const progressPercent = computed(() => Math.min(100, Math.max(0, progressBarState.progress)));
const isFinishing = computed(() => progressBarState.status === "finishing");
const isError = computed(() => progressBarState.status === "error");
</script>

<template>
  <div
    v-if="isVisible"
    class="kk-top-progress-bar"
    :class="{
      'is-finishing': isFinishing,
      'is-error': isError,
    }"
    role="progressbar"
    :aria-label="t('Loading')"
    :aria-valuenow="Math.round(progressPercent)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="kk-top-progress-bar__indicator"
      :style="{ inlineSize: `${progressPercent}%` }"
    >
      <div class="kk-top-progress-bar__glow" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
/* ---- Top-of-page Loading & Page Navigation Progress Bar (Material 3 Expressive) ---- */

.kk-top-progress-bar {
  position: fixed;
  inset-block-start: 0;
  inset-inline-start: 0;
  inset-inline-end: 0;
  inline-size: 100%;
  block-size: 3px;
  background-color: transparent;
  overflow: hidden;
  z-index: 99999;
  pointer-events: none;
  opacity: 1;
  transition: opacity 300ms cubic-bezier(0.2, 0, 0, 1);
}

.kk-top-progress-bar.is-finishing {
  opacity: 0;
  transition: opacity 350ms cubic-bezier(0.2, 0, 0, 1) 150ms;
}

.kk-top-progress-bar__indicator {
  block-size: 100%;
  background-color: var(--md-sys-color-primary, #6750a4);
  border-radius: 0 9999px 9999px 0;
  position: relative;
  transition: inline-size 220ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: inline-size;
}

.kk-top-progress-bar.is-error .kk-top-progress-bar__indicator {
  background-color: var(--md-sys-color-error, #ba1a1a);
}

.kk-top-progress-bar__glow {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  block-size: 100%;
  inline-size: 100px;
  box-shadow:
    0 0 10px var(--md-sys-color-primary, #6750a4),
    0 0 4px var(--md-sys-color-primary, #6750a4);
  opacity: 0.85;
  border-radius: 9999px;
}

.kk-top-progress-bar.is-error .kk-top-progress-bar__glow {
  box-shadow:
    0 0 10px var(--md-sys-color-error, #ba1a1a),
    0 0 4px var(--md-sys-color-error, #ba1a1a);
}
</style>
