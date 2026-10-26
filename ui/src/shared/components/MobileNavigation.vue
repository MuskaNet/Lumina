<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { t } from "../i18n";

defineProps<{ title: string; navigationLabel: string; searchHref: string }>();
const dialog = ref<HTMLDialogElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const open = ref(false);

function show() {
  dialog.value?.showModal();
  open.value = true;
}

function close() {
  dialog.value?.close();
}

function onClose() {
  open.value = false;
  toggle.value?.focus();
}

function onResize() {
  if (window.innerWidth > 768 && open.value) close();
}

function onNavigation(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("a, button")) close();
}

window.addEventListener("hashchange", close);
window.addEventListener("resize", onResize);
onBeforeUnmount(() => {
  window.removeEventListener("hashchange", close);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <header class="kk-mobile-header">
    <button ref="toggle" type="button" class="kk-mobile-icon" :aria-label="t('Menu')" :aria-expanded="open" aria-haspopup="dialog" @click="show">
      <span class="material-symbols-outlined" aria-hidden="true">menu</span>
    </button>
    <span class="kk-mobile-header__title">{{ title }}</span>
    <a class="kk-mobile-icon" :href="searchHref" :aria-label="t('Search')">
      <span class="material-symbols-outlined" aria-hidden="true">search</span>
    </a>
  </header>
  <dialog ref="dialog" class="kk-mobile-drawer" :aria-label="navigationLabel" @close="onClose" @click="(event) => { if (event.target === dialog) close(); }">
    <div class="kk-mobile-drawer__surface">
      <div class="kk-mobile-header kk-mobile-header--drawer">
        <button type="button" class="kk-mobile-icon" :aria-label="t('Close')" @click="close">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
        <span class="kk-mobile-header__title">{{ title }}</span>
      </div>
      <div class="kk-mobile-drawer__body">
        <nav class="kk-mobile-drawer__navigation" :aria-label="`${navigationLabel} ${t('Menu')}`" @click="onNavigation"><slot /></nav>
        <hr class="kk-mobile-drawer__divider">
        <div class="kk-mobile-drawer__actions" @click="onNavigation"><slot name="actions" /></div>
      </div>
    </div>
  </dialog>
</template>
