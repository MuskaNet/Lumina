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
import MobileNavigation from "../shared/components/MobileNavigation.vue";
import LoginDialog from "../shared/components/LoginDialog.vue";
import { route, navigate, browseHash, BROWSE_PREFIX } from "./route";
import BrowseView from "./views/BrowseView.vue";
import MyTokenView from "./views/MyTokenView.vue";
import RepositoryListView from "./views/RepositoryListView.vue";
import SearchView from "./views/SearchView.vue";
import UploadView from "./views/UploadView.vue";
import WelcomeView from "./views/WelcomeView.vue";
import type { Repository } from "./repositoryUrls";

const repositories = ref<Repository[]>([]);
const search = ref("");
const loginOpen = ref(false);
const version = appVersion();

const NAV = [
  { id: "welcome", label: "Welcome", icon: "home", hash: `${BROWSE_PREFIX}welcome` },
  { id: "browse", label: "Browse", icon: "inventory_2", hash: `${BROWSE_PREFIX}browse` },
  { id: "upload", label: "Upload", icon: "upload", hash: `${BROWSE_PREFIX}upload` },
];

const activeId = computed(() => route.value.view);

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
  // Anonymous browsing is supported, so simply opening the browser must never
  // show the sign-in form: only the "Sign in" button does. `?login=1` is the
  // explicit challenge the server (and the 401 handler) redirects to, and it is
  // pointless once a session exists — e.g. reloading the URL after signing in.
  const loginRequired = new URLSearchParams(globalThis.location.search).get("login") === "1";
  if (loginRequired && !session.value?.userId) {
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
  <MobileNavigation title="Lumina" :navigation-label="t('Repository browser')" :search-href="`${BROWSE_PREFIX}search`">
    <a v-for="item in NAV" :key="item.id" :href="item.hash" :aria-current="item.id === activeId ? 'page' : undefined">
      <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>{{ t(item.label) }}
    </a>
    <template #actions>
      <template v-if="session?.userId">
        <a href="/admin/#admin/repository/repositories" @click="beginTask()"><span class="material-symbols-outlined" aria-hidden="true">settings</span>{{ t('Admin') }}</a>
        <div class="kk-mobile-drawer__account"><span class="material-symbols-outlined" aria-hidden="true">account_circle</span>{{ qualifiedUser() }}</div>
        <a :href="`${BROWSE_PREFIX}my-token`"><span class="material-symbols-outlined" aria-hidden="true">key</span>{{ t('My Token') }}</a>
        <button type="button" @click="signOut()"><span class="material-symbols-outlined" aria-hidden="true">logout</span>{{ t('Sign out') }}</button>
      </template>
      <button v-else type="button" @click="loginOpen = true"><span class="material-symbols-outlined" aria-hidden="true">login</span>{{ t('Sign in') }}</button>
    </template>
  </MobileNavigation>
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
        @click="navigate(`${BROWSE_PREFIX}search`)"
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
    </div>
  </nav>

  <main class="micl-panes">
    <section class="micl-pane">
      <div class="kk-page-header">
        <h1 class="kk-page-title">Lumina</h1>
        <p class="kk-page-subtitle">
          {{ t("Repository browser") }}
          <template v-if="version">
            · <a class="kk-product-version" :href="`${PRODUCT_URL}/releases`" target="_blank" rel="noopener noreferrer">v{{ version }}</a>
          </template>
        </p>
      </div>

      <div class="kk-page">
        <WelcomeView
          v-if="route.view === 'welcome'"
          :repositories="repositories"
          @open="(repo: string) => navigate(browseHash(repo))"
        />
        <RepositoryListView
          v-else-if="route.view === 'browse' && !route.repo"
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

      <!-- Floating bottom toolbar -->
      <aside class="kk-bottom-toolbar kk-bottom-toolbar--browse" role="toolbar" :aria-label="t('Quick toolbar')">
        <div class="kk-bottom-toolbar__inner">
          <form class="kk-bottom-toolbar__search" role="search" @submit="submitSearch">
            <span class="material-symbols-outlined kk-bottom-toolbar__search-icon" aria-hidden="true">search</span>
            <input
              id="browse-search"
              v-model="search"
              type="search"
              :placeholder="t('Search components')"
              :aria-label="t('Search components')"
              autocomplete="off"
            >
          </form>

          <div class="kk-bottom-toolbar__divider"></div>

          <a
            v-if="session?.userId"
            class="micl-iconbutton-standard-s kk-bottom-toolbar__admin-btn"
            href="/admin/#admin/repository/repositories"
            :aria-label="t('Admin')"
            :title="t('Admin')"
            @click="beginTask()"
          >
            <span class="material-symbols-outlined" aria-hidden="true">settings</span>
          </a>
          <button
            v-if="session?.userId"
            type="button"
            class="micl-iconbutton-standard-s kk-bottom-toolbar__account-btn"
            popovertarget="kk-browse-user-menu"
            :aria-label="`Account menu for ${qualifiedUser()}`"
            :title="`Account menu for ${qualifiedUser()}`"
          >
            <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </button>
          <button
            v-else
            type="button"
            class="micl-iconbutton-filled-s kk-bottom-toolbar__login-btn"
            :aria-label="t('Sign in')"
            :title="t('Sign in')"
            @click="loginOpen = true"
          >
            <span class="material-symbols-outlined" aria-hidden="true">login</span>
          </button>
        </div>
      </aside>
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
