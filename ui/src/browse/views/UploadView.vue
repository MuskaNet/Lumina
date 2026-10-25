<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { session } from "../../shared/session";
import { browseHash, navigate } from "../route";
import { buildUploadForm, newUploadDraft, type UploadDraft, type UploadSpec } from "../upload";
import UploadFields from "../components/UploadFields.vue";

interface Repository {
  name: string;
  format?: string | null;
  type?: string | null;
}

defineProps<{ repositories: Repository[] }>();
const repositories = ref<Repository[]>([]);
const specs = ref<UploadSpec[]>([]);
const selected = ref("");
const loading = ref(true);
const busy = ref(false);
const status = ref("");
let sequence = 0;
const component = ref<UploadDraft>(newUploadDraft([]));
const assets = ref<{ id: number; draft: UploadDraft }[]>([]);
const target = computed(() => repositories.value.find((repo) => repo.name === selected.value));
const spec = computed(() => specs.value.find((item) => item.format.toLowerCase() === target.value?.format?.toLowerCase()));
const uploadable = computed(() => repositories.value.filter((repo) => specs.value.some((item) => item.format.toLowerCase() === repo.format?.toLowerCase())));
const groups = computed(() => {
  const result = new Map<string, UploadSpec["componentFields"]>();
  for (const field of spec.value?.componentFields ?? []) {
    const name = field.group || "Component attributes";
    if (!result.has(name)) result.set(name, []);
    result.get(name)!.push(field);
  }
  return Array.from(result, ([name, fields]) => ({ name, fields }));
});

function addAsset() {
  if (spec.value) assets.value.push({ id: ++sequence, draft: newUploadDraft(spec.value.assetFields) });
}

watch([selected, spec], () => {
  status.value = "";
  component.value = newUploadDraft(spec.value?.componentFields ?? []);
  assets.value = [];
  addAsset();
});

async function load() {
  loading.value = true;
  status.value = "";
  try {
    const [repos, definitions] = await Promise.all([
      api.get<Repository[]>("/internal/repositories/uploadable"),
      api.get<UploadSpec[]>("/service/rest/v1/formats/upload-specs"),
    ]);
    specs.value = definitions;
    repositories.value = repos;
    if (!uploadable.value.some((repo) => repo.name === selected.value)) {
      selected.value = uploadable.value[0]?.name ?? "";
    }
  } catch (error) {
    status.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(() => session.value?.userId, (userId) => { if (userId) void load(); });

async function upload() {
  if (busy.value || !selected.value || !spec.value) return;
  status.value = "";
  try {
    const form = buildUploadForm(spec.value, component.value, assets.value.map((asset) => asset.draft));
    busy.value = true;
    await api.send(`/service/rest/v1/components?repository=${encodeURIComponent(selected.value)}`, "POST", form);
    showToast(t("Component uploaded successfully."), "ok");
    navigate(browseHash(selected.value, String(component.value.values.directory ?? "")));
  } catch (error) {
    status.value = t((error as Error).message);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <form class="kk-upload-container" @submit.prevent="upload">
    <header class="kk-upload-heading">
      <h2 class="kk-empty-state__title">{{ t("Upload a component") }}</h2>
    </header>
    <fieldset class="kk-upload-fields" :disabled="loading || busy">
      <div class="kk-field-grid">
        <div class="micl-textfield-outlined kk-field--wide">
          <label for="upload-repository">{{ t("Repository") }}</label>
          <select id="upload-repository" v-model="selected" :disabled="!uploadable.length" required>
            <option v-if="!uploadable.length" value="">{{ t("No uploadable repositories") }}</option>
            <option v-for="repo in uploadable" :key="repo.name" :value="repo.name">{{ repo.name }} ({{ repo.format }})</option>
          </select>
        </div>
      </div>
      <template v-if="spec">
        <section v-for="group in groups" :key="group.name" class="kk-upload-section">
          <h3 class="kk-form-section-title">{{ t(group.name) }}</h3>
          <UploadFields :fields="group.fields" :draft="component" prefix="upload-component" />
        </section>
        <section class="kk-upload-section">
          <h3 class="kk-form-section-title">{{ t("Assets") }}</h3>
          <div v-for="(asset, index) in assets" :key="asset.id" class="kk-upload-asset-card">
            <div v-if="spec.multipleUpload" class="kk-upload-asset-header">
              <span class="kk-upload-asset-title">{{ t("Asset #") }}{{ index + 1 }}</span>
              <button v-if="assets.length > 1" type="button" class="micl-button-text-s" @click="assets.splice(index, 1)">{{ t("Remove asset") }}</button>
            </div>
            <UploadFields :fields="spec.assetFields" :draft="asset.draft" :prefix="`upload-asset-${asset.id}`" />
          </div>
          <div v-if="spec.multipleUpload">
            <button type="button" class="micl-button-tonal-s" @click="addAsset">
              <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">add</span>{{ t("Add another asset") }}
            </button>
          </div>
        </section>
      </template>
      <div class="kk-toolbar">
        <button type="submit" class="micl-button-filled-s" :disabled="!spec || !selected">
          <span class="micl-button__icon material-symbols-outlined" aria-hidden="true">upload</span>{{ busy ? t("Uploading…") : t("Upload") }}
        </button>
        <span v-if="target" class="kk-muted">{{ target.format }}</span>
      </div>
    </fieldset>
    <p v-if="status" class="kk-form-error" role="alert">{{ status }}</p>
  </form>
</template>
