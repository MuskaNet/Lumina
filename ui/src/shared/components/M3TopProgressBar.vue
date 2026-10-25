<script setup lang="ts">
import { computed } from "vue";
import { progressBarState } from "../progress";

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
    aria-label="Loading"
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
