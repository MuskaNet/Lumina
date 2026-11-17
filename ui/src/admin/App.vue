<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppShell from "../shared/components/AppShell.vue";
import LoginDialog from "../shared/components/LoginDialog.vue";
import { ADMIN_NAV, visibleAdminNav } from "./nav";
import { revalidateAdminRoute } from "./router";
import { loadSecurityContext, permissions, securityContextLoaded, session } from "../shared/session";

const route = useRoute();
const activeId = computed(() => (typeof route.name === "string" ? route.name : undefined));
const loginOpen = ref(false);

/**
 * The sidebar only offers views the account can open. `ADMIN_NAV` stays the
 * full catalog so every legacy deep link still resolves; the router guard
 * refuses the ones this account may not use. Before the security context is
 * known the full catalog is shown, matching the router's permissive start, so a
 * slow or failed context load cannot leave the console with an empty sidebar.
 */
const nav = computed(() =>
  securityContextLoaded.value ? visibleAdminNav(permissions.value) : ADMIN_NAV,
);

onMounted(async () => {
  await loadSecurityContext();
  if (!session.value?.userId) loginOpen.value = true;
  // The first navigation usually runs before the context exists, so re-check
  // the current route once the grants are known.
  await revalidateAdminRoute();
});

// A grant that arrives later (sign-in or a permission change) must re-open the
// route the account is actually allowed to see.
watch(permissions, () => {
  void revalidateAdminRoute();
});
</script>

<template>
  <AppShell title="Admin" :nav="nav" :active-id="activeId">
    <RouterView />
  </AppShell>
  <LoginDialog :open="loginOpen" @close="loginOpen = false" @signed-in="loginOpen = false" />
</template>
