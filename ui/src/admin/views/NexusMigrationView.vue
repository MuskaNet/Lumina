<script setup lang="ts">
import { reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";

const draft = reactive({
  sourceBaseUrl: "",
  sourceUsername: "",
  sourcePassword: "",
  targetBlobStore: "default",
});

const busy = ref(false);
const preflight = ref("");
const result = ref("");

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function validate(): boolean {
  if (!draft.sourceBaseUrl.trim() || !draft.sourceUsername.trim() || !draft.sourcePassword) {
    showToast(t("Source URL, username and password are required."), "error");
    return false;
  }
  return true;
}

async function run(path: "preflight" | "run") {
  if (!validate()) return;
  busy.value = true;
  try {
    const payload = await api.send<unknown>(`/internal/migration/nexus/${path}`, "POST", {
      sourceBaseUrl: draft.sourceBaseUrl.trim(),
      sourceUsername: draft.sourceUsername.trim(),
      sourcePassword: draft.sourcePassword,
      targetBlobStore: draft.targetBlobStore || "default",
    });
    if (path === "preflight") {
      preflight.value = format(payload);
      showToast(t("Preflight completed."), "ok");
    } else {
      result.value = format(payload);
      showToast(t("Migration finished."), "ok");
    }
  } catch (error) {
    showToast(`${t("Migration request failed")}: ${(error as Error).message}`, "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="kk-toolbar">
    <button type="button" class="micl-button-outlined-s" :disabled="busy" @click="run('preflight')">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">fact_check</span>
      {{ t("Run preflight") }}
    </button>
    <button type="button" class="micl-button-filled-s" :disabled="busy" @click="run('run')">
      <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">play_arrow</span>
      {{ busy ? t("Running…") : t("Run migration") }}
    </button>
  </div>

  <p class="kk-muted">
    {{ t("Migrates Nexus metadata, repositories and security into this instance. Credentials are used for this request only.") }}
  </p>

  <div class="kk-field-grid">
    <div class="micl-textfield-outlined kk-field--wide">
      <label for="migration-url">{{ t("Source URL") }}</label>
      <input id="migration-url" v-model="draft.sourceBaseUrl" type="url" placeholder="https://nexus.example.com" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="migration-user">{{ t("Source username") }}</label>
      <input id="migration-user" v-model="draft.sourceUsername" type="text" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined">
      <label for="migration-password">{{ t("Source password") }}</label>
      <input id="migration-password" v-model="draft.sourcePassword" type="password" autocomplete="new-password">
    </div>
    <div class="micl-textfield-outlined">
      <label for="migration-blobstore">{{ t("Target blob store") }}</label>
      <input id="migration-blobstore" v-model="draft.targetBlobStore" type="text" autocomplete="off">
    </div>
  </div>

  <template v-if="preflight">
    <h3 class="kk-schema-form__group">{{ t("Preflight") }}</h3>
    <pre class="kk-code">{{ preflight }}</pre>
  </template>

  <template v-if="result">
    <h3 class="kk-schema-form__group">{{ t("Migration result") }}</h3>
    <pre class="kk-code">{{ result }}</pre>
  </template>
</template>
