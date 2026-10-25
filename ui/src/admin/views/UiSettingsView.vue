<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../../shared/api/client";
import { t, applyLanguagePreference } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { setTheme } from "../../shared/theme";
import type { UiLanguage } from "../../shared/settings";

interface UiSettingsView {
  defaultLanguage: string;
  supportedDefaultLanguages: string[];
  defaultTheme: string;
  supportedDefaultThemes: string[];
  updatedAt?: string | null;
}

const settings = ref<UiSettingsView | null>(null);
const language = ref("browser");
const theme = ref("default");
const busy = ref(false);
const loading = ref(true);

const languageLabel = (value: string) => {
  if (value === "browser") return t("Match browser");
  if (value === "zh-CN") return "简体中文";
  return "English";
};

const updatedLabel = computed(() => {
  if (!settings.value?.updatedAt) return "—";
  const date = new Date(settings.value.updatedAt);
  return Number.isNaN(date.getTime()) ? String(settings.value.updatedAt) : date.toLocaleString();
});

async function load() {
  loading.value = true;
  try {
    const payload = await api.get<UiSettingsView>("/internal/ui-settings");
    settings.value = payload;
    language.value = payload.defaultLanguage;
    theme.value = payload.defaultTheme;
  } catch (error) {
    showToast(`${t("Failed to load UI settings")}: ${(error as Error).message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function save() {
  busy.value = true;
  try {
    const payload = await api.send<UiSettingsView>("/internal/ui-settings", "PUT", {
      defaultLanguage: language.value,
      defaultTheme: theme.value,
    });
    if (payload) settings.value = payload;
    setTheme(theme.value);
    applyLanguagePreference(language.value as UiLanguage);
    showToast(t("UI settings saved."), "ok");
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
      {{ busy ? t("Saving…") : t("Save settings") }}
    </button>
    <button type="button" class="micl-button-outlined-m" @click="load">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">refresh</span>
      {{ t("Reload") }}
    </button>
  </div>

  <div class="kk-summary">
    <div class="kk-summary__item">
      <span class="kk-summary__label">{{ t("Last updated") }}</span>
      <strong class="kk-summary__value">{{ updatedLabel }}</strong>
    </div>
  </div>

  <div class="kk-field-grid">
    <div class="micl-textfield-outlined">
      <label for="ui-language">{{ t("Default language") }}</label>
      <select id="ui-language" v-model="language">
        <option v-for="item in settings?.supportedDefaultLanguages ?? ['browser', 'zh-CN', 'en']" :key="item" :value="item">
          {{ languageLabel(item) }}
        </option>
      </select>
    </div>
    <div class="micl-textfield-outlined">
      <label for="ui-theme">{{ t("Default theme") }}</label>
      <select id="ui-theme" v-model="theme">
        <option v-for="item in settings?.supportedDefaultThemes ?? ['default']" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </div>
  </div>
</template>
