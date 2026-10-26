<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

const advancedUserFields: FieldDef[] = [
  { key: "userRealNameAttribute", label: "Real name attribute", type: "text" },
  { key: "userEmailAddressAttribute", label: "Email attribute", type: "text" },
  { key: "userPasswordAttribute", label: "Password attribute", type: "text" },
  { key: "userMemberOfAttribute", label: "Member-of attribute", type: "text" },
];
const groupFields: FieldDef[] = [
  { key: "ldapGroupsAsRoles", label: "LDAP groups as roles", type: "switch" },
  { key: "groupType", label: "Group type", type: "text" },
  { key: "groupBaseDn", label: "Group base DN", type: "text", wide: true },
  { key: "groupSubtree", label: "Group subtree", type: "switch" },
  { key: "groupIdAttribute", label: "Group ID attribute", type: "text" },
  { key: "groupMemberAttribute", label: "Group member attribute", type: "text" },
  { key: "groupMemberFormat", label: "Group member format", type: "text" },
  { key: "groupObjectClass", label: "Group object class", type: "text" },
];

const draft = reactive<Record<string, unknown>>({});
const busy = ref(false);
const loading = ref(true);
const passwordDirty = computed(() => String(draft.authPassword ?? "") !== "");

async function load() {
  loading.value = true;
  try {
    const payload = await api.get<Record<string, unknown>>("/internal/security/ldap");
    Object.assign(draft, payload, { authPassword: "" });
  } catch (error) {
    showToast(`${t("Failed to load LDAP settings")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (draft.enabled && (!String(draft.url ?? "").trim() || !String(draft.host ?? "").trim())) {
    showToast(t("URL and host are required when LDAP is enabled."), "error");
    return;
  }
  busy.value = true;
  try {
    const payload: Record<string, unknown> = { ...draft };
    if (!passwordDirty.value) delete payload.authPassword;
    const saved = await api.send<Record<string, unknown>>("/internal/security/ldap", "PUT", payload);
    if (saved) Object.assign(draft, saved, { authPassword: "" });
    showToast(t("LDAP settings saved."), "ok");
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
      {{ busy ? t("Saving…") : t("Save LDAP settings") }}
    </button>
    <button type="button" class="micl-button-tonal-s" :disabled="loading" @click="load">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">refresh</span>
      {{ t("Reload") }}
    </button>
  </div>

  <p class="kk-muted">
    {{ t("LDAP realms authenticate users against a directory. Leave the password blank to keep the stored value.") }}
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
          <p class="kk-card-header__subtitle">{{ t("Enable LDAP authentication and basic attributes") }}</p>
        </div>
      </div>

      <label class="kk-switch-row">
        <input v-model="draft.enabled" class="micl-switch" type="checkbox" role="switch" :disabled="loading">
        <span>{{ t("Enabled") }}</span>
      </label>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="ldap-priority">{{ t("Priority") }}</label>
          <input id="ldap-priority" v-model.number="draft.priority" type="number" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-name">{{ t("Realm name") }}</label>
          <input id="ldap-name" v-model="draft.name" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-source">{{ t("Source") }}</label>
          <input id="ldap-source" v-model="draft.source" type="text" autocomplete="off" :disabled="loading">
        </div>
      </div>
    </div>

    <!-- 2. CONNECTION 连接配置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">lan</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Connection settings") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("Directory host, port and connection timeout") }}</p>
        </div>
      </div>

      <div class="micl-textfield-outlined kk-field--wide">
        <label for="ldap-url">{{ t("URL") }}</label>
        <input id="ldap-url" v-model="draft.url" type="text" placeholder="ldap://ldap.example.com:389" :disabled="loading">
      </div>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="ldap-protocol">{{ t("Protocol") }}</label>
          <input id="ldap-protocol" v-model="draft.protocol" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-host">{{ t("Host") }}</label>
          <input id="ldap-host" v-model="draft.host" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-port">{{ t("Port") }}</label>
          <input id="ldap-port" v-model.number="draft.port" type="number" :disabled="loading">
        </div>
      </div>

      <div class="micl-textfield-outlined kk-field--wide">
        <label for="ldap-search-base">{{ t("Search base") }}</label>
        <input id="ldap-search-base" v-model="draft.searchBase" type="text" autocomplete="off" :disabled="loading">
      </div>

      <label class="kk-switch-row">
        <input v-model="draft.useTrustStore" class="micl-switch" type="checkbox" role="switch" :disabled="loading">
        <span>{{ t("Use trust store") }}</span>
      </label>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="ldap-timeout">{{ t("Connection timeout (s)") }}</label>
          <input id="ldap-timeout" v-model.number="draft.connectionTimeout" type="number" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-retry">{{ t("Retry delay (s)") }}</label>
          <input id="ldap-retry" v-model.number="draft.connectionRetryDelay" type="number" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-max-incidents">{{ t("Max incidents") }}</label>
          <input id="ldap-max-incidents" v-model.number="draft.maxIncidentsCount" type="number" :disabled="loading">
        </div>
      </div>
    </div>

    <!-- 3. AUTHENTICATION 认证配置 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">lock</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("Authentication settings") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("Directory binding credentials") }}</p>
        </div>
      </div>

      <div class="micl-textfield-outlined kk-field--wide">
        <label for="ldap-auth-scheme">{{ t("Auth scheme") }}</label>
        <input id="ldap-auth-scheme" v-model="draft.authScheme" type="text" autocomplete="off" :disabled="loading">
      </div>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="ldap-auth-realm">{{ t("Auth realm") }}</label>
          <input id="ldap-auth-realm" v-model="draft.authRealm" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-auth-username">{{ t("Auth username") }}</label>
          <input id="ldap-auth-username" v-model="draft.authUsername" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-auth-password">{{ t("Auth password") }}</label>
          <input id="ldap-auth-password" v-model="draft.authPassword" type="password" autocomplete="new-password" :disabled="loading">
        </div>
      </div>

      <p v-if="!passwordDirty" class="kk-muted" style="margin: 0; font-size: 0.8125rem;">
        {{ t("Password unchanged: the stored secret is kept.") }}
      </p>
    </div>

    <!-- 4. USER MAPPING 用户映射 -->
    <div class="kk-surface-card">
      <div class="kk-card-header">
        <div class="kk-card-header__icon-box">
          <span class="material-symbols-outlined">badge</span>
        </div>
        <div class="kk-card-header__content">
          <h3 class="kk-card-header__title">{{ t("User mapping") }}</h3>
          <p class="kk-card-header__subtitle">{{ t("User Base DN, search filters and attributes") }}</p>
        </div>
      </div>

      <div class="micl-textfield-outlined kk-field--wide">
        <label for="ldap-user-base-dn">{{ t("User base DN") }}</label>
        <input id="ldap-user-base-dn" v-model="draft.userBaseDn" type="text" autocomplete="off" :disabled="loading">
      </div>

      <label class="kk-switch-row">
        <input v-model="draft.userSubtree" class="micl-switch" type="checkbox" role="switch" :disabled="loading">
        <span>{{ t("User subtree") }}</span>
      </label>

      <div class="kk-grid-3">
        <div class="micl-textfield-outlined">
          <label for="ldap-user-object-class">{{ t("User object class") }}</label>
          <input id="ldap-user-object-class" v-model="draft.userObjectClass" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-user-ldap-filter">{{ t("User LDAP filter") }}</label>
          <input id="ldap-user-ldap-filter" v-model="draft.userLdapFilter" type="text" autocomplete="off" :disabled="loading">
        </div>
        <div class="micl-textfield-outlined">
          <label for="ldap-user-id-attr">{{ t("User ID attribute") }}</label>
          <input id="ldap-user-id-attr" v-model="draft.userIdAttribute" type="text" autocomplete="off" :disabled="loading">
        </div>
      </div>
      <M3SchemaForm :fields="advancedUserFields" :model="draft" :disabled="loading" />
      <h3 class="kk-schema-form__group">{{ t("Group mapping") }}</h3>
      <M3SchemaForm :fields="groupFields" :model="draft" :disabled="loading" />
    </div>
  </div>
  </div>
</template>

