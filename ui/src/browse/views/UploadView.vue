<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../shared/api/client";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { browseHash, navigate } from "../route";

interface Repository {
  name: string;
  format?: string | null;
  type?: string | null;
}

interface UploadSpec {
  format?: string;
  [key: string]: unknown;
}

const props = defineProps<{ repositories: Repository[] }>();

const uploadable = ref<Repository[]>([]);
const specs = ref<UploadSpec[]>([]);
const busy = ref(false);
const status = ref("");

const draft = reactive({
  repository: "",
  directory: "",
  file: null as File | null,
});

const target = computed(() => uploadable.value.find((repo) => repo.name === draft.repository));

const columns = computed(() =>
  specs.value
    .filter((spec) => spec.format)
    .map((spec) => String(spec.format))
    .sort(),
);

async function load() {
  try {
    const [repos, specList] = await Promise.all([
      api.getOrNull<Repository[]>("/internal/repositories/uploadable"),
      api.getOrNull<UploadSpec[]>("/service/rest/v1/formats/upload-specs"),
    ]);
    uploadable.value = repos ?? props.repositories.filter((repo) => repo.type === "hosted");
    specs.value = specList ?? [];
    if (!draft.repository && uploadable.value.length) draft.repository = uploadable.value[0].name;
  } catch (error) {
    status.value = (error as Error).message;
  }
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  draft.file = input.files?.[0] ?? null;
}

async function upload() {
  if (!draft.repository) {
    status.value = t("Select a repository first.");
    return;
  }
  if (!draft.file) {
    status.value = t("Select a file to upload.");
    return;
  }
  busy.value = true;
  status.value = "";
  try {
    const form = new FormData();
    form.append("raw.directory", draft.directory);
    form.append("raw.asset1", draft.file);
    form.append("raw.asset1.filename", draft.file.name);
    await api.send(
      `/service/rest/v1/components?repository=${encodeURIComponent(draft.repository)}`,
      "POST",
      form,
    );
    showToast(t("Upload complete."), "ok");
    navigate(browseHash(draft.repository, draft.directory));
  } catch (error) {
    status.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="kk-empty-state" style="align-items: flex-start; text-align: start">
    <h2 class="kk-empty-state__title">{{ t("Upload a component") }}</h2>
    <p class="kk-empty-state__body">
      {{ t("Uploads use the raw component endpoint: pick a hosted repository, an optional directory, then a file.") }}
    </p>
  </section>

  <div class="kk-field-grid">
    <div class="micl-textfield-outlined">
      <label for="upload-repository">{{ t("Repository") }}</label>
      <select id="upload-repository" v-model="draft.repository">
        <option v-if="!uploadable.length" value="">{{ t("No uploadable repositories") }}</option>
        <option v-for="repo in uploadable" :key="repo.name" :value="repo.name">
          {{ repo.name }} ({{ repo.format }})
        </option>
      </select>
    </div>
    <div class="micl-textfield-outlined">
      <label for="upload-directory">{{ t("Directory") }}</label>
      <input id="upload-directory" v-model="draft.directory" type="text" placeholder="team/releases" autocomplete="off">
    </div>
    <div class="micl-textfield-outlined kk-field--wide">
      <label for="upload-file">{{ t("File") }}</label>
      <input id="upload-file" type="file" @change="onFile">
    </div>
  </div>

  <div class="kk-toolbar">
    <button type="button" class="micl-button-filled-m" :disabled="busy" @click="upload">
      <span class="material-symbols-outlined" aria-hidden="true" slot="icon">upload</span>
      {{ busy ? t("Uploading…") : t("Upload") }}
    </button>
    <span v-if="target" class="kk-muted">{{ target.name }} · {{ target.format }}</span>
  </div>

  <p v-if="status" class="kk-form-error" role="alert">{{ status }}</p>

  <p v-if="columns.length" class="kk-muted">
    {{ t("Upload specifications are available for") }}: {{ columns.join(", ") }}
  </p>
</template>
