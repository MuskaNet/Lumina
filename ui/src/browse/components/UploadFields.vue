<script setup lang="ts">
import { t } from "../../shared/i18n";
import type { UploadDraft, UploadField } from "../upload";

const props = defineProps<{ fields: UploadField[]; draft: UploadDraft; prefix: string }>();

function selectFile(event: Event, field: UploadField) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  props.draft.files[field.name] = file;
  if (!file || field.name !== "asset") return;
  if ("filename" in props.draft.values && !props.draft.values.filename) {
    props.draft.values.filename = file.name;
  }
  if ("extension" in props.draft.values && !props.draft.values.extension) {
    props.draft.values.extension = file.name.includes(".") ? file.name.split(".").pop()! : "";
  }
}
</script>

<template>
  <div class="kk-field-grid">
    <template v-for="field in fields" :key="field.name">
      <label v-if="field.type === 'BOOLEAN'" class="kk-checkbox-row">
        <input v-model="draft.values[field.name]" type="checkbox" class="micl-checkbox">
        <span>{{ t(field.description || field.name) }}</span>
      </label>
      <div v-else-if="field.type === 'FILE'" class="kk-upload-file kk-field--wide">
        <label :for="`${prefix}-${field.name}`">
          {{ t(field.description || field.name) }}<span v-if="!field.optional" aria-hidden="true"> *</span>
        </label>
        <input :id="`${prefix}-${field.name}`" type="file" :required="!field.optional" @change="selectFile($event, field)">
      </div>
      <div v-else class="micl-textfield-outlined">
        <label :for="`${prefix}-${field.name}`">
          {{ t(field.description || field.name) }}<span v-if="!field.optional" aria-hidden="true"> *</span>
        </label>
        <input :id="`${prefix}-${field.name}`" v-model="draft.values[field.name]" type="text"
          placeholder=" " :required="!field.optional" autocomplete="off">
      </div>
    </template>
  </div>
</template>
