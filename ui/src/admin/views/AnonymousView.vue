<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";

interface AnonymousSettings {
  enabled: boolean;
  userSource: string;
  userId: string;
  realmName: string;
}

const settings = reactive<AnonymousSettings>({ enabled: false, userSource: "", userId: "", realmName: "" });
const busy = ref(false);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const payload = await api.get<AnonymousSettings>("/internal/security/anonymous");
    Object.assign(settings, {
      enabled: Boolean(payload.enabled),
      userSource: payload.userSource ?? "",
      userId: payload.userId ?? "",
      realmName: payload.realmName ?? "",
    });
  } catch (error) {
    showToast(`${t("Failed to load anonymous settings")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (settings.enabled && (!settings.userId.trim() || !settings.realmName.trim())) {
    showToast(t("User ID and realm name are required."), "error");
    return;
  }
  busy.value = true;
  try {
    const payload = await api.send<AnonymousSettings>("/internal/security/anonymous", "PUT", settings);
    if (payload) Object.assign(settings, payload);
    showToast(t("Anonymous access saved."), "ok");
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
      {{ busy ? t("Saving…") : t("Save") }}
    </button>
    <button type="button" class="micl-button-outlined-m" @click="load">{{ t("Reload") }}</button>
  </div>

  <p class="kk-muted">
    {{ t("Anonymous requests are authenticated as the configured user when enabled.") }}
  </p>

  <div class="kk-field-grid">
    <label class="kk-checkbox-row">
      <input v-model="settings.enabled" class="micl-checkbox" type="checkbox">
      <span>{{ t("Allow anonymous access") }}</span>
    </label>
    <div class="micl-textfield-outlined">
      <label for="anon-user">{{ t("User ID") }}</label>
      <input id="anon-user" v-model="settings.userId" type="text" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="anon-realm">{{ t("Realm name") }}</label>
      <input id="anon-realm" v-model="settings.realmName" type="text" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="anon-source">{{ t("User source") }}</label>
      <input id="anon-source" v-model="settings.userSource" type="text" autocomplete="off">
    </div>
  </div>
</template>
