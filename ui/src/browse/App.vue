<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../shared/api/client";
import { t } from "../shared/i18n";
import { showToast } from "../shared/snackbar";
import { session, loadSecurityContext, signOut, qualifiedUser } from "../shared/session";
import { appVersion, PRODUCT_URL } from "../shared/version";
import { beginTask } from "../shared/progress";
import M3TopProgressBar from "../shared/components/M3TopProgressBar.vue";
import M3Snackbar from "../shared/components/M3Snackbar.vue";
import M3List from "../shared/components/M3List.vue";
import M3ListItem from "../shared/components/M3ListItem.vue";
import LoginDialog from "../shared/components/LoginDialog.vue";
import { route, navigate, browseHash, BROWSE_PREFIX } from "./route";
import BrowseView from "./views/BrowseView.vue";
import MyTokenView from "./views/MyTokenView.vue";
import SearchView from "./views/SearchView.vue";
import UploadView from "./views/UploadView.vue";
import WelcomeView from "./views/WelcomeView.vue";

interface Repository {
  name: string;
  type?: string | null;
  format?: string | null;
  online?: boolean;
  url?: string | null;
}

const repositories = ref<Repository[]>([]);
const search = ref("");
const loginOpen = ref(false);
const version = appVersion();

function focusSearch() {
  const input = document.getElementById("browse-search") as HTMLInputElement | null;
  if (input) {
    input.focus();
    input.select();
  } else {
    navigate(`${BROWSE_PREFIX}search`);
  }
}

const NAV = [
  { id: "welcome", label: "Welcome", icon: "home", hash: `${BROWSE_PREFIX}welcome` },
  { id: "upload", label: "Upload", icon: "upload", hash: `${BROWSE_PREFIX}upload` },
  { id: "my-token", label: "My Token", icon: "key", hash: `${BROWSE_PREFIX}my-token` },
];

const activeId = computed(() => (route.value.view === "browse" ? "welcome" : route.value.view));

async function loadRepositories() {
  try {
    repositories.value = await api.get<Repository[]>("/internal/repositories");
  } catch (error) {
    showToast(`${t("Failed to load repositories")}: ${(error as Error).message}`, "error");
  }
}

function submitSearch(event: Event) {
  event.preventDefault();
  const keyword = search.value.trim();
  navigate(`${BROWSE_PREFIX}search${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`);
}

onMounted(async () => {
  await Promise.all([loadRepositories(), loadSecurityContext()]);
  if (!globalThis.location.hash.startsWith(BROWSE_PREFIX)) {
    navigate(`${BROWSE_PREFIX}welcome`);
  }
  const params = new URLSearchParams(globalThis.location.search);
  if (params.get("login") === "1" || !session.value?.userId) {
    loginOpen.value = true;
  }
});

async function onSignedIn() {
  loginOpen.value = false;
  await Promise.all([loadRepositories(), loadSecurityContext()]);
}
</script>

<template>
  <M3TopProgressBar />
  <nav
    class="micl-navigationrail kk-rail"
    aria-label="Repository browser"
  >
    <div class="kk-rail-action">
      <button
        type="button"
        class="kk-rail-fab"
        :title="t('Search')"
        :aria-label="t('Search')"
        @click="focusSearch"
      >
        <span class="material-symbols-outlined" aria-hidden="true">search</span>
      </button>
    </div>
    <div class="micl-navigationrail__content kk-rail-content">
      <a
        v-for="item in NAV"
        :key="item.id"
        class="micl-navigationrail__item kk-rail-item"
        :href="item.hash"
        :aria-current="item.id === activeId ? 'page' : undefined"
        :title="t(item.label)"
      >
        <div class="kk-rail-indicator">
          <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
        </div>
        <span class="micl-navigationrail__text kk-rail-label">{{ t(item.label) }}</span>
      </a>

      <a
        class="micl-navigationrail__item kk-rail-item"
        href="/admin/#admin/repository/repositories"
        :title="t('Admin')"
        @click="beginTask()"
      >
        <div class="kk-rail-indicator">
          <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">settings</span>
        </div>
        <span class="micl-navigationrail__text kk-rail-label">{{ t("Admin") }}</span>
      </a>
    </div>
  </nav>

  <main class="micl-panes">
    <section class="micl-pane">
      <header class="micl-appbar">
        <div class="micl-appbar__headline">
          <h1>kkRepo</h1>
          <p class="micl-appbar__subtitle">
            {{ t("Repository browser") }}
            <template v-if="version">
              · <a class="kk-product-version" :href="`${PRODUCT_URL}/releases`" target="_blank" rel="noopener noreferrer">v{{ version }}</a>
            </template>
          </p>
        </div>
        <form class="kk-appbar-search" role="search" @submit="submitSearch">
          <div class="micl-textfield-outlined">
            <span class="micl-textfield__icon-leading material-symbols-outlined" aria-hidden="true">search</span>
            <label for="browse-search">{{ t("Search components") }}</label>
            <input id="browse-search" v-model="search" type="search" autocomplete="off">
          </div>
        </form>
        <div class="kk-appbar-actions">
          <button
            v-if="session?.userId"
            type="button"
            class="micl-iconbutton-standard-s"
            popovertarget="kk-browse-user-menu"
            :aria-label="`Account menu for ${qualifiedUser()}`"
            :title="`Account menu for ${qualifiedUser()}`"
          >
            <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </button>
          <button
            v-else
            type="button"
            class="micl-button-filled-s"
            @click="loginOpen = true"
          >
            <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">login</span>
            {{ t("Sign in") }}
          </button>
        </div>
      </header>

      <div class="kk-page">
        <WelcomeView
          v-if="route.view === 'welcome'"
          :repositories="repositories"
          @open="(repo: string) => navigate(browseHash(repo))"
        />
        <BrowseView
          v-else-if="route.view === 'browse'"
          :repositories="repositories"
          :repo="route.repo"
          :path="route.path"
          :source="route.query.get('source') ?? ''"
        />
        <SearchView
          v-else-if="route.view === 'search'"
          :query="route.query.get('q') ?? ''"
          :format="route.query.get('format') ?? ''"
        />
        <UploadView v-else-if="route.view === 'upload'" :repositories="repositories" />
        <MyTokenView v-else-if="route.view === 'my-token'" />
      </div>
    </section>
  </main>

  <nav id="kk-browse-user-menu" class="micl-menu kk-user-menu" popover>
    <M3List>
      <M3ListItem
        :lines="2"
        leading-icon="account_circle"
        :headline="qualifiedUser()"
        :supporting-text="session?.source || t('Local session')"
      />
      <M3ListItem
        :lines="1"
        leading-icon="key"
        :headline="t('My Token')"
        clickable
        @click="navigate(`${BROWSE_PREFIX}my-token`)"
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

  <M3Snackbar />
  <LoginDialog :open="loginOpen" @close="loginOpen = false" @signed-in="onSignedIn" />
</template>
