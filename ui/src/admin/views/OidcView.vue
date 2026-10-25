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
const secretDirty = ref(false);

const FIELDS: FieldDef[] = [
  { key: "enabled", label: "Enabled", type: "checkbox" },
  { key: "priority", label: "Priority", type: "number" },
  { key: "name", label: "Realm name", type: "text" },
  { key: "source", label: "Source", type: "text" },

  { key: "issuer", label: "Issuer", type: "text", group: "Provider", required: true },
  { key: "issuerUri", label: "Issuer URI", type: "text" },
  { key: "jwksUri", label: "JWKS URI", type: "url" },
  { key: "audience", label: "Audience", type: "text" },
  { key: "authorizationEndpoint", label: "Authorization endpoint", type: "url" },
  { key: "tokenEndpoint", label: "Token endpoint", type: "url" },
  { key: "scopes", label: "Scopes", type: "text", placeholder: "openid profile email" },

  { key: "clientId", label: "Client ID", type: "text", group: "Client", required: true },
  { key: "clientSecret", label: "Client secret", type: "password" },
  { key: "redirectUri", label: "Redirect URI", type: "url", required: true },

  { key: "userIdClaim", label: "User ID claim", type: "text", group: "Claims" },
  { key: "firstNameClaim", label: "First name claim", type: "text" },
  { key: "lastNameClaim", label: "Last name claim", type: "text" },
  { key: "emailClaim", label: "Email claim", type: "text" },
  { key: "groupsClaim", label: "Groups claim", type: "text" },
  { key: "rolesClaim", label: "Roles claim", type: "text" },

  { key: "clockSkewSeconds", label: "Clock skew (s)", type: "number", group: "Caching" },
  { key: "jwksCacheSeconds", label: "JWKS cache (s)", type: "number" },
];

const fields = computed(() => FIELDS);

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
  const missing = required.filter((key) => !String(draft[key] ?? "").trim());
  if (missing.length) {
    showToast(`${t("Required fields are missing")}: ${missing.join(", ")}`, "error");
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
  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-m" :disabled="busy || loading" @click="save">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">save</span>
      {{ busy ? t("Saving…") : t("Save OIDC settings") }}
    </button>
    <button type="button" class="micl-button-outlined-m" @click="load">{{ t("Reload") }}</button>
  </div>

  <p class="kk-muted">
    {{ t("OIDC realms sign users in through an external identity provider. Leave the client secret blank to keep the stored value.") }}
  </p>

  <M3SchemaForm :fields="fields" :model="draft" :disabled="loading" />
</template>
