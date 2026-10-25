<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { t } from "../../shared/i18n";

const route = useRoute();
const path = computed(() => route.fullPath);
</script>

<template>
  <section class="kk-empty-state" role="status">
    <span class="material-symbols-outlined kk-empty-state__icon" aria-hidden="true">search_off</span>
    <h2 class="kk-empty-state__title">{{ t("Unknown administration page") }}</h2>
    <p class="kk-empty-state__body"><code class="kk-mono">{{ path }}</code></p>
    <a class="micl-button-text-s" href="#admin/repository/repositories">{{ t("Go to repositories") }}</a>
  </section>
</template>
