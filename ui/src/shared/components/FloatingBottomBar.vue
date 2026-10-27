<script setup lang="ts">
import { t } from "../i18n";

defineProps<{
  browse?: boolean;
}>();
</script>

<template>
  <aside
    class="kk-bottom-toolbar"
    :class="{ 'kk-bottom-toolbar--browse': browse }"
    role="toolbar"
    :aria-label="t('Quick toolbar')"
  >
    <div class="kk-bottom-toolbar__inner">
      <slot name="brand" />
      <slot name="search" />
      <div v-if="$slots.search && $slots.actions" class="kk-bottom-toolbar__divider"></div>
      <slot name="actions" />
      <div v-if="$slots.account" class="kk-bottom-toolbar__divider"></div>
      <slot name="account" />
    </div>
  </aside>
</template>

<style scoped>
/* ---- Floating Bottom Toolbar (M3 Expressive) --------------------------- */

.kk-bottom-toolbar {
  --kk-toolbar-button-size: 56px;
  --kk-toolbar-gap: 8px;
  --kk-toolbar-padding-block: 6px;
  --kk-toolbar-padding-inline: 10px;
  --kk-toolbar-icon-size: 30px;
  --kk-toolbar-search-font-size: 1rem;
  position: fixed;
  max-inline-size: calc(100vw - 24px);
  inset-block-end: 20px;
  inset-inline-start: calc(50% + 40px); /* accounts for 80px side rail */
  transform: translateX(-50%);
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* children re-enable pointer-events */
}

@media (max-width: 768px) {
  .kk-bottom-toolbar {
    inset-inline-start: 50%;
  }
}

.kk-bottom-toolbar__inner {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--kk-toolbar-gap);
  padding: var(--kk-toolbar-padding-block) var(--kk-toolbar-padding-inline);
  box-sizing: border-box;
  max-inline-size: 100%;
  background-color: var(--md-sys-color-surface-container-high, var(--md-sys-color-surface-container));
  color: var(--md-sys-color-on-surface);
  border-radius: 9999px;
  border: none;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.18),
    0 2px 6px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition:
    transform var(--md-sys-motion-expressive-default-effects-duration, 200ms) var(--md-sys-motion-expressive-default-spatial),
    box-shadow var(--md-sys-motion-expressive-default-effects-duration, 200ms) ease;
}

.kk-bottom-toolbar__inner:hover {
  box-shadow:
    0 6px 22px rgba(0, 0, 0, 0.24),
    0 3px 8px rgba(0, 0, 0, 0.12);
}

.kk-bottom-toolbar__divider {
  inline-size: 1px;
  block-size: 24px;
  background-color: var(--md-sys-color-outline-variant);
}

:deep(.kk-bottom-toolbar__brand) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-inline-start: 8px;
}

:deep(.material-symbols-outlined) {
  font-size: var(--kk-toolbar-icon-size) !important;
}

:deep(.kk-bottom-toolbar__admin-btn),
:deep(.kk-bottom-toolbar__account-btn),
:deep(.kk-bottom-toolbar__login-btn) {
  margin: 0 !important;
  inline-size: var(--kk-toolbar-button-size) !important;
  min-inline-size: var(--kk-toolbar-button-size) !important;
  block-size: var(--kk-toolbar-button-size) !important;
  flex-shrink: 0;
  text-decoration: none;
  border-radius: 50% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

:deep(.kk-bottom-toolbar__admin-btn),
:deep(.kk-bottom-toolbar__account-btn) {
  color: var(--md-sys-color-on-surface-variant) !important;
}

:deep(.kk-bottom-toolbar__admin-btn:hover),
:deep(.kk-bottom-toolbar__account-btn:hover) {
  color: var(--md-sys-color-on-surface) !important;
}

:deep(.kk-bottom-toolbar__login-btn) {
  background-color: var(--md-sys-color-primary) !important;
  color: var(--md-sys-color-on-primary) !important;
}

:deep(.kk-bottom-toolbar__search) {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background-color: var(--md-sys-color-surface-container-lowest, var(--md-sys-color-surface));
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 9999px;
  padding: 8px 18px 8px 14px;
  inline-size: 320px;
  transition:
    border-color 300ms ease,
    inline-size 350ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 300ms ease;
  will-change: inline-size;
}

:deep(.kk-bottom-toolbar__search:hover) {
  border-color: var(--md-sys-color-outline);
}

:deep(.kk-bottom-toolbar__search:focus-within) {
  border-color: var(--md-sys-color-primary);
  inline-size: 440px;
  box-shadow: 0 0 0 1px var(--md-sys-color-primary);
}

:deep(.kk-bottom-toolbar__search-icon) {
  font-size: 22px;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

:deep(.kk-bottom-toolbar__search input) {
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-family: var(--md-ref-typeface-plain);
  font-size: var(--md-sys-typescale-body-medium-size, 0.875rem);
  outline: none;
  inline-size: 100%;
}

:deep(.kk-bottom-toolbar__search input::placeholder) {
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0.8;
}

.kk-bottom-toolbar--browse :deep(.kk-bottom-toolbar__search) {
  box-sizing: border-box;
  inline-size: min(280px, calc(100vw - 184px));
  min-inline-size: 0;
  min-block-size: var(--kk-toolbar-button-size);
  padding: 6px 14px;
}

.kk-bottom-toolbar--browse :deep(.kk-bottom-toolbar__search:focus-within) {
  inline-size: min(420px, calc(100vw - 184px));
}

.kk-bottom-toolbar--browse :deep(.kk-bottom-toolbar__search input) {
  min-inline-size: 0;
  font-size: var(--kk-toolbar-search-font-size);
}

@media (max-width: 1024px), (max-height: 700px) {
  .kk-bottom-toolbar {
    inset-block-end: 12px;
  }
}

@media (max-width: 600px), (max-height: 480px) {
  .kk-bottom-toolbar {
    --kk-toolbar-gap: 6px;
    --kk-toolbar-padding-block: 4px;
    --kk-toolbar-padding-inline: 8px;
    inset-block-end: 8px;
  }

  .kk-bottom-toolbar--browse :deep(.kk-bottom-toolbar__search) {
    inline-size: min(240px, calc(100vw - 184px));
    padding-inline: 10px;
    gap: 6px;
  }

  :deep(.kk-bottom-toolbar__brand) {
    gap: 4px;
    padding-inline-start: 4px;
    font-size: 0.875rem;
  }

  .kk-bottom-toolbar__divider {
    block-size: 20px;
    flex-shrink: 0;
  }
}
</style>
