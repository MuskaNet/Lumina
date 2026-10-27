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

<style scoped>
/* ---- Mobile header and navigation drawer ------------------------------ */

.kk-mobile-header,
.kk-mobile-drawer {
  display: none;
}

@media (max-width: 768px) {
  .kk-mobile-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    min-block-size: 56px;
    padding: 4px 12px;
    box-sizing: border-box;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
  }

  .kk-mobile-header__title {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .kk-mobile-icon {
    display: inline-flex;
    flex: 0 0 44px;
    align-items: center;
    justify-content: center;
    inline-size: 44px;
    block-size: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .kk-mobile-drawer {
    transform: translateX(-100%);
    transition:
      transform 240ms cubic-bezier(0.2, 0, 0, 1),
      display 240ms allow-discrete,
      overlay 240ms allow-discrete;
    position: fixed;
    inset: 0 auto 0 0;
    inline-size: min(320px, calc(100vw - 40px));
    max-inline-size: none;
    block-size: 100dvh;
    max-block-size: 100dvh;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0 20px 20px 0;
    overflow: hidden;
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface);
  }

  .kk-mobile-drawer[open] {
    display: flex;
    transform: translateX(0);
  }

  .kk-mobile-drawer::backdrop {
    background: rgb(0 0 0 / 40%);
    opacity: 0;
    transition:
      opacity 240ms ease,
      display 240ms allow-discrete,
      overlay 240ms allow-discrete;
  }

  .kk-mobile-drawer[open]::backdrop {
    opacity: 1;
  }

  @starting-style {
    .kk-mobile-drawer[open] {
      transform: translateX(-100%);
    }

    .kk-mobile-drawer[open]::backdrop {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kk-mobile-drawer,
    .kk-mobile-drawer::backdrop {
      transition: none;
    }
  }

  .kk-mobile-drawer__surface {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    min-block-size: 0;
    overflow: hidden;
    background: var(--md-sys-color-surface-container-low);
  }

  .kk-mobile-drawer__body {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--md-sys-color-outline-variant) transparent;
    scrollbar-gutter: stable;
    margin-inline-end: 4px;
    padding-block-end: max(16px, env(safe-area-inset-bottom));
  }

  .kk-mobile-header--drawer {
    flex-shrink: 0;
    z-index: 1;
    background: var(--md-sys-color-surface-container-low);
  }

  .kk-mobile-drawer__navigation,
  .kk-mobile-drawer__actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
  }

  .kk-mobile-drawer :is(.kk-mobile-drawer__navigation, .kk-mobile-drawer__actions) > :deep(:is(a, button, .kk-mobile-drawer__account)) {
    display: flex;
    align-items: center;
    gap: 16px;
    min-block-size: 44px;
    padding: 8px 16px;
    box-sizing: border-box;
    border: 0;
    border-radius: 24px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  .kk-mobile-drawer__navigation > :deep(a[aria-current="page"]) {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    font-weight: 600;
  }

  .kk-mobile-drawer :deep(:is(a, button):hover) {
    background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  }

  .kk-mobile-drawer__divider {
    flex-shrink: 0;
    margin: 8px 20px;
    border: 0;
    border-block-start: 1px solid var(--md-sys-color-outline-variant);
  }
}
</style>
