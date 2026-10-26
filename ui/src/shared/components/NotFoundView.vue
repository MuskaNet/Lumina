<script setup lang="ts">
import { t } from "../i18n";

/**
 * Shared "not found / empty" state used by the admin router and the browse
 * console. Renders as a centered empty state with an optional monospace path
 * and a single navigation action.
 */
withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    description?: string;
    path?: string;
    actionLabel?: string;
    actionHref?: string;
  }>(),
  {
    icon: "search_off",
    description: undefined,
    path: undefined,
    actionLabel: undefined,
    actionHref: undefined,
  },
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <section class="kk-empty-state" role="status">
    <span class="material-symbols-outlined kk-empty-state__icon" aria-hidden="true">{{ icon }}</span>
    <h2 class="kk-empty-state__title">{{ t(title) }}</h2>
    <p v-if="description" class="kk-empty-state__body">{{ t(description) }}</p>
    <p v-if="path" class="kk-empty-state__body"><code class="kk-mono">{{ path }}</code></p>
    <a v-if="actionHref && actionLabel" class="micl-button-text-s" :href="actionHref">
      {{ t(actionLabel) }}
    </a>
    <button
      v-else-if="actionLabel"
      type="button"
      class="micl-button-text-s"
      @click="emit('action')"
    >
      {{ t(actionLabel) }}
    </button>
  </section>
</template>
