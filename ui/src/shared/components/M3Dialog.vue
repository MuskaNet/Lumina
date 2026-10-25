<script setup lang="ts">
import { ref } from "vue";
import { t } from "../i18n";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    wide?: boolean;
    error?: string;
    hideCancel?: boolean;
  }>(),
  {
    subtitle: undefined,
    confirmLabel: undefined,
    cancelLabel: undefined,
    busy: false,
    wide: false,
    error: "",
    hideCancel: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);

function open() {
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

function onCancel() {
  emit("cancel");
  close();
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    ref="dialog"
    class="micl-dialog kk-dialog"
    :class="{ 'kk-dialog--wide': props.wide }"
    aria-labelledby="kk-dialog-title"
    @close="emit('cancel')"
  >
    <div class="micl-dialog__headline">
      <h2 id="kk-dialog-title">{{ t(props.title) }}</h2>
      <span v-if="props.subtitle" class="micl-dialog__supporting-text">{{ t(props.subtitle) }}</span>
    </div>

    <div class="kk-dialog__body">
      <slot />
    </div>

    <p v-if="props.error" class="kk-form-error" role="alert">{{ props.error }}</p>

    <div class="micl-dialog__actions">
      <button v-if="!props.hideCancel" type="button" class="micl-button-text-m" @click="onCancel">
        {{ t(props.cancelLabel ?? "Cancel") }}
      </button>
      <button type="button" class="micl-button-filled-m" :disabled="props.busy" @click="emit('confirm')">
        {{ props.busy ? t("Saving…") : t(props.confirmLabel ?? "Save") }}
      </button>
    </div>
  </dialog>
</template>
