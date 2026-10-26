<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import NotFoundView from "../../shared/components/NotFoundView.vue";

const route = useRoute();
const path = computed(() => route.fullPath);
</script>

<template>
  <NotFoundView
    title="Unknown administration page"
    :path="path"
    action-label="Go to repositories"
    action-href="#admin/repository/repositories"
  />
</template>