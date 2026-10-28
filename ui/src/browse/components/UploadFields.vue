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
  <div class="kk-field-grid kk-upload-fields-grid">
    <template v-for="field in fields" :key="field.name">
      <label v-if="field.type === 'BOOLEAN'" class="kk-checkbox-row kk-field--span-3">
        <input v-model="draft.values[field.name]" type="checkbox" class="micl-checkbox">
        <span>{{ t(field.description || field.name) }}</span>
      </label>
      <div v-else-if="field.type === 'FILE'" class="kk-upload-file kk-field--wide kk-field--span-3">
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

<style scoped>
.kk-upload-file {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-inline-size: 0;
  font-size: 0.875rem;
}

.kk-upload-file > label {
  color: var(--md-sys-color-on-surface-variant);
}

.kk-upload-file > input {
  inline-size: 100%;
  min-inline-size: 0;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-small, 8px);
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font: inherit;
}

.kk-upload-file > input::file-selector-button {
  margin-inline-end: 12px;
  padding: 8px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font: inherit;
  cursor: pointer;
}

.kk-upload-file > input:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
</style>
