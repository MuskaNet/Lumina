<script setup lang="ts">
import { computed } from "vue";
import { t } from "../i18n";
import { qualifiedUser, session, signOut } from "../session";
import { appVersion, PRODUCT_URL } from "../version";
import { beginTask } from "../progress";
import M3SnackbarHost from "./M3Snackbar.vue";
import M3List from "./M3List.vue";
import M3ListItem from "./M3ListItem.vue";
import M3TopProgressBar from "./M3TopProgressBar.vue";

export interface ShellNavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  group?: string;
}

const props = defineProps<{
  title: string;
  subtitle?: string;
  nav: ShellNavItem[];
  activeId?: string;
}>();

const accountLabel = computed(() => qualifiedUser() || t("Account"));
const activeItem = computed(() => props.nav.find((item) => item.id === props.activeId));
const version = appVersion();

function openMyToken() {
  globalThis.location?.assign("/browse/#browse/my-token");
}
</script>

<template>
  <M3TopProgressBar />
  <nav class="micl-navigationrail kk-rail" aria-label="Administration">
    <div class="kk-rail-action">
      <a
        class="kk-rail-fab"
        href="/browse/#browse/welcome"
        :title="t('Back to browse')"
        :aria-label="t('Back to browse')"
        @click="beginTask()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      </a>
    </div>
    <div class="micl-navigationrail__content kk-rail-content">
      <a
        v-for="item in nav"
        :key="item.id"
        class="micl-navigationrail__item kk-rail-item"
        :href="item.href"
        :aria-current="item.id === activeId ? 'page' : undefined"
        :title="t(item.label)"
      >
        <div class="kk-rail-indicator">
          <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
        </div>
        <span class="micl-navigationrail__text kk-rail-label">{{ t(item.label) }}</span>
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
    <M3List>
      <M3ListItem
        :lines="2"
        leading-icon="account_circle"
        :headline="accountLabel"
        :supporting-text="session?.source || t('Local session')"
      />
      <M3ListItem
        :lines="1"
        leading-icon="key"
        :headline="t('My Token')"
        clickable
        @click="openMyToken"
      />
      <M3ListItem
        :lines="1"
        leading-icon="logout"
        :headline="t('Sign out')"
        clickable
        @click="signOut()"
      />
    </M3List>
  </nav>

  <M3SnackbarHost />
</template>
