<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import M3SchemaForm from "../../shared/components/M3SchemaForm.vue";
import type { FieldDef } from "../../shared/components/schema";

const draft = reactive<Record<string, unknown>>({});
const busy = ref(false);
const loading = ref(true);
const passwordDirty = computed(() => String(draft.authPassword ?? "") !== "");

const FIELDS: FieldDef[] = [
  { key: "enabled", label: "Enabled", type: "checkbox" },
  { key: "priority", label: "Priority", type: "number" },
  { key: "name", label: "Realm name", type: "text" },
  { key: "source", label: "Source", type: "text" },

  { key: "url", label: "URL", type: "text", group: "Connection", placeholder: "ldap://ldap.example.com:389" },
  { key: "protocol", label: "Protocol", type: "text" },
  { key: "host", label: "Host", type: "text" },
  { key: "port", label: "Port", type: "number" },
  { key: "useTrustStore", label: "Use trust store", type: "checkbox" },
  { key: "searchBase", label: "Search base", type: "text" },
  { key: "connectionTimeout", label: "Connection timeout (s)", type: "number" },
  { key: "connectionRetryDelay", label: "Retry delay (s)", type: "number" },
  { key: "maxIncidentsCount", label: "Max incidents", type: "number" },

  { key: "authScheme", label: "Auth scheme", type: "text", group: "Authentication" },
  { key: "authRealm", label: "Auth realm", type: "text" },
  { key: "authUsername", label: "Auth username", type: "text" },
  { key: "authPassword", label: "Auth password", type: "password" },

  { key: "userBaseDn", label: "User base DN", type: "text", group: "User mapping" },
  { key: "userSubtree", label: "User subtree", type: "checkbox" },
  { key: "userObjectClass", label: "User object class", type: "text" },
  { key: "userLdapFilter", label: "User LDAP filter", type: "text" },
  { key: "userIdAttribute", label: "User ID attribute", type: "text" },
  { key: "userRealNameAttribute", label: "Real name attribute", type: "text" },
  { key: "userEmailAddressAttribute", label: "Email attribute", type: "text" },
  { key: "userPasswordAttribute", label: "Password attribute", type: "text" },
  { key: "userMemberOfAttribute", label: "Member-of attribute", type: "text" },

  { key: "ldapGroupsAsRoles", label: "LDAP groups as roles", type: "checkbox", group: "Group mapping" },
  { key: "groupType", label: "Group type", type: "text" },
  { key: "groupBaseDn", label: "Group base DN", type: "text" },
  { key: "groupSubtree", label: "Group subtree", type: "checkbox" },
  { key: "groupIdAttribute", label: "Group ID attribute", type: "text" },
  { key: "groupMemberAttribute", label: "Group member attribute", type: "text" },
  { key: "groupMemberFormat", label: "Group member format", type: "text" },
  { key: "groupObjectClass", label: "Group object class", type: "text" },
];

const fields = computed(() => FIELDS);
const passwordField = computed(() => fields.value.find((field) => field.key === "authPassword"));

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
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-s" :disabled="busy || loading" @click="save">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">save</span>
      {{ busy ? t("Saving…") : t("Save LDAP settings") }}
    </button>
    <button type="button" class="micl-button-outlined-s" @click="load">{{ t("Reload") }}</button>
  </div>

  <p class="kk-muted">
    {{ t("LDAP realms authenticate users against a directory. Leave the password blank to keep the stored value.") }}
  </p>

  <M3SchemaForm :fields="fields" :model="draft" :disabled="loading" />

  <p v-if="passwordField && !passwordDirty" class="kk-muted">
    {{ t("Password unchanged: the stored secret is kept.") }}
  </p>
</template>

