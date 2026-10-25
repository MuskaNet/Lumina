<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { t } from "../i18n";
import { qualifiedUser, session, signOut } from "../session";
import { appVersion, PRODUCT_URL } from "../version";
import M3SnackbarHost from "./M3Snackbar.vue";

export interface ShellNavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

const props = defineProps<{
  title: string;
  subtitle?: string;
  nav: ShellNavItem[];
  activeId?: string;
}>();

const RAIL_STORAGE_KEY = "kkrepo.railExpanded";

function readRailExpanded(): boolean {
  try {
    const stored = localStorage.getItem(RAIL_STORAGE_KEY);
    // Administration labels are long; an expanded rail is the useful default.
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

const railExpanded = ref(readRailExpanded());
watch(railExpanded, (value) => {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable; the rail still toggles for this session.
  }
});

const accountLabel = computed(() => qualifiedUser() || t("Account"));
const activeItem = computed(() => props.nav.find((item) => item.id === props.activeId));
const version = appVersion();

function openMyToken() {
  globalThis.location?.assign("/browse/#browse/my-token");
}
</script>

<template>
  <nav class="micl-navigationrail kk-rail" aria-label="Administration">
    <div class="micl-navigationrail__headline">
      <button
        type="button"
        class="micl-iconbutton-standard-s micl-button--toggle"
        :aria-pressed="railExpanded"
        :aria-label="railExpanded ? t('Collapse navigation') : t('Expand navigation')"
        :title="railExpanded ? t('Collapse navigation') : t('Expand navigation')"
        @click="railExpanded = !railExpanded"
      >
        <span class="material-symbols-outlined" aria-hidden="true">menu</span>
      </button>
    </div>
    <div class="micl-navigationrail__content">
      <a class="micl-navigationrail__item" href="/browse/#browse/welcome" title="kkRepo Browse">
        <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">home</span>
        <span class="micl-navigationrail__text">Browse</span>
      </a>
      <a
        v-for="item in nav"
        :key="item.id"
        class="micl-navigationrail__item"
        :href="item.href"
        :aria-current="item.id === activeId ? 'page' : undefined"
        :title="t(item.label)"
      >
        <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
        <span class="micl-navigationrail__text">{{ t(item.label) }}</span>
      </a>
    </div>
  </nav>

  <main class="micl-panes">
    <section class="micl-pane">
      <header class="micl-appbar">
        <div class="micl-appbar__headline">
          <h1>{{ t(activeItem?.label ?? title) }}</h1>
          <p v-if="subtitle" class="micl-appbar__subtitle">{{ t(subtitle) }}</p>
        </div>
        <div class="kk-appbar-actions">
          <a class="kk-product-link" :href="PRODUCT_URL" target="_blank" rel="noopener noreferrer">kkRepo</a>
          <a
            v-if="version"
            class="kk-product-version"
            :href="`${PRODUCT_URL}/releases`"
            target="_blank"
            rel="noopener noreferrer"
          >v{{ version }}</a>
          <slot name="actions" />
          <button
            type="button"
            class="micl-iconbutton-standard-s"
            popovertarget="kk-user-menu"
            :aria-label="`Account menu for ${accountLabel}`"
            :title="`Account menu for ${accountLabel}`"
          >
            <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </button>
        </div>
      </header>

      <div class="kk-page">
        <slot />
      </div>
    </section>
  </main>

  <nav id="kk-user-menu" class="micl-menu kk-user-menu" popover>
    <ul class="micl-list">
      <li class="micl-list-item-two">
        <span class="micl-list-item__icon material-symbols-outlined" aria-hidden="true">account_circle</span>
        <span class="micl-list-item__text">
          <span class="micl-list-item__headline">{{ accountLabel }}</span>
          <span class="micl-list-item__supporting-text">{{ session?.source || t("Local session") }}</span>
        </span>
      </li>
      <li class="micl-list-item-one" tabindex="0" @click="openMyToken" @keydown.enter="openMyToken">
        <span class="micl-list-item__icon material-symbols-outlined" aria-hidden="true">key</span>
        <span class="micl-list-item__text">
          <span class="micl-list-item__headline">{{ t("My Token") }}</span>
        </span>
      </li>
      <li class="micl-list-item-one" tabindex="0" @click="signOut()" @keydown.enter="signOut()">
        <span class="micl-list-item__icon material-symbols-outlined" aria-hidden="true">logout</span>
        <span class="micl-list-item__text">
          <span class="micl-list-item__headline">{{ t("Sign out") }}</span>
        </span>
      </li>
    </ul>
  </nav>

  <M3SnackbarHost />
</template>
