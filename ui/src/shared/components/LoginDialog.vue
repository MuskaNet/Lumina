<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api, authRequiredLocation, currentReturnTo, safeReturnTo } from "../api/client";
import { t } from "../i18n";
import { session, loadSecurityContext } from "../session";

interface LoginOptions {
  ldapEnabled?: boolean;
  oidcEnabled?: boolean;
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; signedIn: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const tab = ref<"password" | "oidc">("password");
const options = ref<LoginOptions>({});
const username = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const returnTo = ref("");

const passwordTabLabel = computed(() => (options.value.ldapEnabled ? "Local / LDAP" : "Local"));

async function loadOptions() {
  try {
    options.value = await api.get<LoginOptions>("/internal/security/login/options");
    if (!options.value.oidcEnabled && tab.value === "oidc") tab.value = "password";
  } catch {
    options.value = {};
  }
}

function resolveReturnTo(): string {
  const fromQuery = new URLSearchParams(globalThis.location.search).get("returnTo");
  return safeReturnTo(fromQuery) || safeReturnTo(returnTo.value) || currentReturnTo();
}

async function submit() {
  error.value = "";
  if (!username.value.trim() || !password.value) {
    error.value = t("Username and password are required.");
    return;
  }
  busy.value = true;
  try {
    const result = await api.send<{ returnTo?: string }>("/internal/security/login", "POST", {
      username: username.value.trim(),
      password: password.value,
      returnTo: resolveReturnTo(),
    });
    const target = safeReturnTo(result?.returnTo) ?? resolveReturnTo();
    const current = currentReturnTo();
    password.value = "";
    await loadSecurityContext();
    if (target !== current) {
      globalThis.location.assign(target);
      return;
    }
    emit("signedIn");
    close();
  } catch (cause) {
    const message = (cause as Error).message;
    error.value = message === "Authentication required." ? t("Invalid username or password.") : message;
  } finally {
    busy.value = false;
  }
}

function signInWithOidc() {
  const target = resolveReturnTo();
  globalThis.location.assign(`/internal/security/oidc/login?returnTo=${encodeURIComponent(target)}`);
}

function close() {
  dialog.value?.close();
  emit("close");
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value && !busy.value) {
    close();
  }
}

function signOutAndReload() {
  globalThis.location.assign("/internal/security/logout?returnTo=" + encodeURIComponent(authRequiredLocation()));
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      error.value = "";
      void loadOptions();
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

onMounted(async () => {
  if (!session.value) await loadSecurityContext();
  if (props.open) {
    await loadOptions();
    dialog.value?.showModal();
  }
});

defineExpose({ close, signOutAndReload });
</script>

<template>
  <dialog
    ref="dialog"
    class="micl-dialog kk-dialog kk-dialog--login"
    aria-labelledby="kk-login-title"
    @click="onBackdropClick"
    @close="emit('close')"
  >
    <div class="micl-dialog__headline">
      <div class="kk-dialog__title-block">
        <h2 id="kk-login-title">{{ t("Sign in") }}</h2>
        <span class="micl-dialog__supporting-text">{{ t("Sign in to browse or manage this repository.") }}</span>
      </div>
    </div>

    <div class="micl-dialog__content kk-dialog__content">
      <div v-if="options.oidcEnabled" class="kk-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="kk-tab"
          :class="{ 'is-active': tab === 'password' }"
          :aria-selected="tab === 'password'"
          @click="tab = 'password'"
        >
          {{ t(passwordTabLabel) }}
        </button>
        <button
          type="button"
          role="tab"
          class="kk-tab"
          :class="{ 'is-active': tab === 'oidc' }"
          :aria-selected="tab === 'oidc'"
          @click="tab = 'oidc'"
        >
          OIDC
        </button>
      </div>

      <form v-if="tab === 'password'" id="kk-login-form" class="kk-schema-form" @submit.prevent="submit">
        <div class="micl-textfield-outlined">
          <label for="kk-login-username">{{ t("Username") }}</label>
          <input id="kk-login-username" v-model="username" type="text" autocomplete="username" required>
        </div>
        <div class="micl-textfield-outlined">
          <label for="kk-login-password">{{ t("Password") }}</label>
          <input id="kk-login-password" v-model="password" type="password" autocomplete="current-password" required>
        </div>
        <p v-if="error" class="kk-form-error" role="alert">{{ error }}</p>
      </form>

      <div v-else class="kk-oidc-prompt">
        <p class="kk-muted">{{ t("Continue with the configured OIDC identity provider.") }}</p>
      </div>
    </div>

    <div class="micl-dialog__actions">
      <button type="button" class="micl-button-text-s" :disabled="busy" @click="close">{{ t("Cancel") }}</button>
      <button
        v-if="tab === 'password'"
        type="submit"
        form="kk-login-form"
        class="micl-button-filled-s"
        :disabled="busy"
      >
        <span v-if="busy" class="kk-button-spinner" aria-hidden="true"></span>
        {{ busy ? t("Signing in…") : t("Sign in") }}
      </button>
      <button
        v-else
        type="button"
        class="micl-button-filled-s"
        @click="signInWithOidc"
      >
        {{ t("Continue with OIDC") }}
      </button>
    </div>
  </dialog>
</template>
