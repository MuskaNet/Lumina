<script setup lang="ts">
withDefaults(
  defineProps<{
    segmented?: boolean;
    ariaLabel?: string;
  }>(),
  {
    segmented: false,
    ariaLabel: undefined,
  },
);
</script>

<template>
  <ul
    class="micl-list"
    :class="{ 'micl-list--segmented': segmented }"
    :aria-label="ariaLabel"
  >
    <slot />
  </ul>
</template>
