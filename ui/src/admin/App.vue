<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AppShell from "../shared/components/AppShell.vue";
import LoginDialog from "../shared/components/LoginDialog.vue";
import { ADMIN_NAV } from "./nav";
import { loadSecurityContext, session } from "../shared/session";

const route = useRoute();
const activeId = computed(() => (typeof route.name === "string" ? route.name : undefined));
const loginOpen = ref(false);

onMounted(async () => {
  await loadSecurityContext();
  if (!session.value?.userId) loginOpen.value = true;
});
</script>

<template>
  <AppShell title="Admin" :nav="ADMIN_NAV" :active-id="activeId">
    <RouterView />
  </AppShell>
  <LoginDialog :open="loginOpen" @close="loginOpen = false" @signed-in="loginOpen = false" />
</template>
