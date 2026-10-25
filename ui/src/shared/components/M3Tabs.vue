<script setup lang="ts">
import { t } from "../i18n";

defineProps<{
  tabs: { id: string; label: string }[];
  active: string;
}>();

const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <div class="kk-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="kk-tab"
      :class="{ 'is-active': tab.id === active }"
      :aria-selected="tab.id === active"
      :tabindex="tab.id === active ? 0 : -1"
      @click="emit('select', tab.id)"
    >
      {{ t(tab.label) }}
    </button>
  </div>
</template>
