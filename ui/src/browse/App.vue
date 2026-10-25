<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../shared/api/client";
import { t } from "../shared/i18n";
import { showToast } from "../shared/snackbar";
import { session, loadSecurityContext, signOut, qualifiedUser } from "../shared/session";
import { appVersion, PRODUCT_URL } from "../shared/version";
import M3Snackbar from "../shared/components/M3Snackbar.vue";
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
  <nav class="micl-navigationrail kk-rail" aria-label="Repository browser">
    <div class="micl-navigationrail__content">
      <a
        v-for="item in NAV"
        :key="item.id"
        class="micl-navigationrail__item"
        :href="item.hash"
        :aria-current="item.id === activeId ? 'page' : undefined"
        :title="t(item.label)"
      >
        <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
        <span class="micl-navigationrail__text">{{ t(item.label) }}</span>
      </a>
      <a class="micl-navigationrail__item" href="/admin/#admin/repository/repositories" title="kkRepo Admin">
        <span class="micl-navigationrail__icon material-symbols-outlined" aria-hidden="true">settings</span>
        <span class="micl-navigationrail__text">{{ t("Admin") }}</span>
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
            class="micl-button-filled-m"
            @click="loginOpen = true"
          >
            <span class="material-symbols-outlined" aria-hidden="true" slot="icon">login</span>
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
    <ul class="micl-list">
      <li class="micl-list-item-two">
        <span class="micl-list-item__icon material-symbols-outlined" aria-hidden="true">account_circle</span>
        <span class="micl-list-item__text">
          <span class="micl-list-item__headline">{{ qualifiedUser() }}</span>
          <span class="micl-list-item__supporting-text">{{ session?.source || t("Local session") }}</span>
        </span>
      </li>
      <li
        class="micl-list-item-one"
        tabindex="0"
        @click="navigate(`${BROWSE_PREFIX}my-token`)"
        @keydown.enter="navigate(`${BROWSE_PREFIX}my-token`)"
      >
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

  <M3Snackbar />
  <LoginDialog :open="loginOpen" @close="loginOpen = false" @signed-in="onSignedIn" />
</template>
