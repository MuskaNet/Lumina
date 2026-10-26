<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

const advancedClaimFields: FieldDef[] = [
  { key: "emailClaim", label: "Email claim", type: "text" },
  { key: "rolesClaim", label: "Roles claim", type: "text" },
];
const cacheFields: FieldDef[] = [
  { key: "clockSkewSeconds", label: "Clock skew (s)", type: "number" },
  { key: "jwksCacheSeconds", label: "JWKS cache (s)", type: "number" },
];

const draft = reactive<Record<string, unknown>>({});
const busy = ref(false);
const loading = ref(true);
const secretDirty = ref(false);

async function load() {
  loading.value = true;
  try {
    const payload = await api.get<Record<string, unknown>>("/internal/security/oidc");
    Object.assign(draft, payload, { clientSecret: "" });
    secretDirty.value = false;
  } catch (error) {
    showToast(`${t("Failed to load OIDC settings")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function save() {
  const required = ["issuer", "clientId", "redirectUri"];
  const requiredLabels: Record<string, string> = { issuer: "Issuer", clientId: "Client ID", redirectUri: "Redirect URI" };
  const missing = required.filter((key) => !String(draft[key] ?? "").trim());
  if (missing.length) {
    showToast(`${t("Required fields are missing")}: ${missing.map((key) => t(requiredLabels[key] ?? key)).join(", ")}`, "error");
    return;
  }
  busy.value = true;
  try {
    const payload: Record<string, unknown> = { ...draft };
    if (!secretDirty.value) delete payload.clientSecret;
    const saved = await api.send<Record<string, unknown>>("/internal/security/oidc", "PUT", payload);
    if (saved) Object.assign(draft, saved, { clientSecret: "" });
    secretDirty.value = false;
    showToast(t("OIDC settings saved."), "ok");
  } catch (error) {
    showToast(`${t("Save failed")}: ${(error as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="kk-settings-page">
  <div class="kk-toolbar kk-action-bar">
    <button type="button" class="micl-button-filled-m kk-primary-action" :disabled="busy || loading" @click="save">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">save</span>
      {{ busy ? t("Saving…") : t("Save OIDC settings") }}
    </button>
    <button type="button" class="micl-button-tonal-s" :disabled="loading" @click="load">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Reload") }}
    </button>
  </div>

  <p class="kk-muted">
    {{ t("OIDC realms sign users in through an external identity provider. Leave the client secret blank to keep the stored value.") }}
  </p>

  <div class="kk-settings-layout">
    <!-- 1. 基本设置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">tune</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Basic settings") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("Enable OIDC authentication and basic attributes") }}</p>
        </div>
      </div>

      <label class="kk-switch-row">
        <input v-model="draft.enabled" class="micl-switch" type="checkbox" role="switch" :disabled="loading">
        <span>{{ t("Enabled") }}</span>
      </label>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="oidc-priority">{{ t("Priority") }}</label>
          <input id="oidc-priority" v-model.number="draft.priority" type="number" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-name">{{ t("Realm name") }}</label>
          <input id="oidc-name" v-model="draft.name" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-source">{{ t("Source") }}</label>
          <input id="oidc-source" v-model="draft.source" type="text" autocomplete="off" :disabled="loading">
        </div>
      </div>
    </div>

    <!-- 2. PROVIDER 设置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">hub</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Provider settings") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("OpenID Connect identity provider endpoints") }}</p>
        </div>
      </div>

      <!-- Issuer 强制独占整行 -->
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="oidc-issuer">{{ t("Issuer") }}</label>
        <input id="oidc-issuer" v-model="draft.issuer" type="text" autocomplete="off" required :disabled="loading">
      </div>

      <!-- 2 列网格：Issuer URI、JWKS URI、Audience、授权端点 -->
      <div class="kk-grid-2">
        <div class="micl-textfield-outlined">
          <label for="oidc-issuer-uri">{{ t("Issuer URI") }}</label>
          <input id="oidc-issuer-uri" v-model="draft.issuerUri" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-jwks-uri">{{ t("JWKS URI") }}</label>
          <input id="oidc-jwks-uri" v-model="draft.jwksUri" type="url" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-audience">{{ t("Audience") }}</label>
          <input id="oidc-audience" v-model="draft.audience" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-auth-endpoint">{{ t("Authorization endpoint") }}</label>
          <input id="oidc-auth-endpoint" v-model="draft.authorizationEndpoint" type="url" autocomplete="off" :disabled="loading">
        </div>
      </div>

      <!-- 2 列网格：Token 端点 与 Scopes -->
      <div class="kk-grid-2">
        <div class="micl-textfield-outlined">
          <label for="oidc-token-endpoint">{{ t("Token endpoint") }}</label>
          <input id="oidc-token-endpoint" v-model="draft.tokenEndpoint" type="url" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-scopes">{{ t("Scopes") }}</label>
          <input id="oidc-scopes" v-model="draft.scopes" type="text" placeholder="openid profile email" autocomplete="off" :disabled="loading">
        </div>
      </div>
    </div>

    <!-- 3. CLIENT 客户端设置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">key</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Client settings") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("Client credentials and redirect URI") }}</p>
        </div>
      </div>

      <!-- Client ID 强制独占整行 -->
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="oidc-client-id">{{ t("Client ID") }}</label>
        <input id="oidc-client-id" v-model="draft.clientId" type="text" autocomplete="off" required :disabled="loading">
      </div>

      <!-- Client Secret 强制独占整行 -->
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="oidc-client-secret">{{ t("Client secret") }}</label>
        <input id="oidc-client-secret" v-model="draft.clientSecret" type="password" autocomplete="new-password" :disabled="loading" @input="secretDirty = true">
      </div>

      <!-- 回调 URI 强制独占整行 -->
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="oidc-redirect-uri">{{ t("Redirect URI") }}</label>
        <input id="oidc-redirect-uri" v-model="draft.redirectUri" type="url" autocomplete="off" required :disabled="loading">
      </div>
    </div>

    <!-- 4. CLAIMS 映射设置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">fingerprint</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Claims mapping") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("Token claims and user attribute mapping") }}</p>
        </div>
      </div>

      <!-- 用户 ID Claim 强制独占整行 -->
      <div class="micl-textfield-outlined kk-field--wide">
        <label for="oidc-user-id-claim">{{ t("User ID claim") }}</label>
        <input id="oidc-user-id-claim" v-model="draft.userIdClaim" type="text" autocomplete="off" :disabled="loading">
      </div>

      <!-- 名 Claim、姓 Claim、组 Claim 采用 3 列网格对齐 -->
      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="oidc-first-name-claim">{{ t("First name claim") }}</label>
          <input id="oidc-first-name-claim" v-model="draft.firstNameClaim" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-last-name-claim">{{ t("Last name claim") }}</label>
          <input id="oidc-last-name-claim" v-model="draft.lastNameClaim" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="oidc-groups-claim">{{ t("Groups claim") }}</label>
          <input id="oidc-groups-claim" v-model="draft.groupsClaim" type="text" autocomplete="off" :disabled="loading">
        </div>
      </div>
      <M3SchemaForm :fields="advancedClaimFields" :model="draft" :disabled="loading" />
      <h3 class="kk-schema-form__group">{{ t("Caching") }}</h3>
      <M3SchemaForm :fields="cacheFields" :model="draft" :disabled="loading" />
    </div>
  </div>
  </div>
</template>
