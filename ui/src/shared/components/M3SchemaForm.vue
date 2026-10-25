<script setup lang="ts">
import { computed } from "vue";
import { t } from "../i18n";
import type { FieldDef } from "./schema";

/**
 * Renders MICL form controls from a field schema. `model` is mutated in place so
 * callers keep a single reactive draft object per form.
 */
const props = defineProps<{
  fields: FieldDef[];
  model: Record<string, unknown>;
  disabled?: boolean;
}>();

const visibleFields = computed(() => props.fields.filter((field) => field.showWhen?.(props.model) !== false));

const grouped = computed(() => {
  const sections: { group: string | null; fields: FieldDef[] }[] = [];
  for (const field of visibleFields.value) {
    const group = field.group ?? null;
    const last = sections[sections.length - 1];
    if (last && last.group === group) last.fields.push(field);
    else sections.push({ group, fields: [field] });
  }
  return sections;
});

function textValue(key: string): string {
  const value = props.model[key];
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.join(fieldFor(key)?.listSeparator === "comma" ? ", " : "\n");
  }
  return String(value);
}

function fieldFor(key: string): FieldDef | undefined {
  return props.fields.find((field) => field.key === key);
}

function setText(field: FieldDef, event: Event) {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  if (field.type === "list") {
    const separator = field.listSeparator === "comma" ? "," : "\n";
    props.model[field.key] = raw
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
    return;
  }
  props.model[field.key] = raw;
}

function setNumber(field: FieldDef, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  props.model[field.key] = raw === "" ? null : Number(raw);
}

function setBool(field: FieldDef, event: Event) {
  props.model[field.key] = (event.target as HTMLInputElement).checked;
}

function setSelect(field: FieldDef, event: Event) {
  props.model[field.key] = (event.target as HTMLSelectElement).value;
}
</script>

<template>
  <div class="kk-schema-form">
    <template v-for="(section, index) in grouped" :key="`${section.group ?? 'default'}-${index}`">
      <h3 v-if="section.group" class="kk-schema-form__group">{{ t(section.group) }}</h3>
      <div class="kk-field-grid">
        <template v-for="field in section.fields" :key="field.key">
          <label v-if="field.type === 'checkbox'" class="kk-checkbox-row">
            <input
              class="micl-checkbox"
              type="checkbox"
              :checked="Boolean(model[field.key])"
              :disabled="disabled || field.readOnly"
              @change="setBool(field, $event)"
            >
            <span>{{ t(field.label) }}</span>
          </label>

          <div v-else-if="field.type === 'select'" class="micl-textfield-outlined">
            <label :for="`field-${field.key}`">{{ t(field.label) }}</label>
            <select
              :id="`field-${field.key}`"
              :value="textValue(field.key)"
              :disabled="disabled || field.readOnly"
              @change="setSelect(field, $event)"
            >
              <option v-if="!field.required" value="">{{ t("None") }}</option>
              <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">
                {{ t(option.label) }}
              </option>
            </select>
          </div>

          <div v-else-if="field.type === 'textarea'" class="micl-textfield-outlined kk-field--wide">
            <label :for="`field-${field.key}`">{{ t(field.label) }}</label>
            <textarea
              :id="`field-${field.key}`"
              :value="textValue(field.key)"
              :placeholder="field.placeholder"
              :disabled="disabled || field.readOnly"
              rows="3"
              @input="setText(field, $event)"
            ></textarea>
          </div>

          <div v-else-if="field.type === 'number'" class="micl-textfield-outlined">
            <label :for="`field-${field.key}`">{{ t(field.label) }}</label>
            <input
              :id="`field-${field.key}`"
              type="number"
              :value="textValue(field.key)"
              :min="field.min"
              :max="field.max"
              :placeholder="field.placeholder"
              :disabled="disabled || field.readOnly"
              @input="setNumber(field, $event)"
            >
          </div>

          <div v-else-if="field.type === 'list'" class="micl-textfield-outlined kk-field--wide">
            <label :for="`field-${field.key}`">{{ t(field.label) }}</label>
            <textarea
              :id="`field-${field.key}`"
              :value="textValue(field.key)"
              :placeholder="field.placeholder"
              :disabled="disabled || field.readOnly"
              rows="3"
              @input="setText(field, $event)"
            ></textarea>
          </div>

          <div v-else class="micl-textfield-outlined">
            <label :for="`field-${field.key}`">{{ t(field.label) }}</label>
            <input
              :id="`field-${field.key}`"
              :type="field.type"
              :value="textValue(field.key)"
              :placeholder="field.placeholder"
              :disabled="disabled || field.readOnly"
              :autocomplete="field.type === 'password' ? 'new-password' : 'off'"
              @input="setText(field, $event)"
            >
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
