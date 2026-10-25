<script setup lang="ts">
import { ref } from "vue";
import { t } from "../i18n";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    wide?: boolean;
    destructive?: boolean;
    error?: string;
    hideCancel?: boolean;
  }>(),
  {
    subtitle: undefined,
    icon: undefined,
    confirmLabel: undefined,
    cancelLabel: undefined,
    busy: false,
    wide: false,
    destructive: false,
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

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value && !props.busy) {
    onCancel();
  }
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    ref="dialog"
    class="micl-dialog kk-dialog"
    :class="{ 'kk-dialog--wide': props.wide, 'has-icon': Boolean(props.icon) }"
    aria-labelledby="kk-dialog-title"
    @click="onBackdropClick"
    @close="emit('cancel')"
  >
    <div class="micl-dialog__headline">
      <span
        v-if="props.icon"
        class="micl-dialog__icon material-symbols-outlined"
        :class="{ 'is-destructive': props.destructive }"
        aria-hidden="true"
      >{{ props.icon }}</span>
      <div class="kk-dialog__title-block">
        <h2 id="kk-dialog-title">{{ t(props.title) }}</h2>
        <span v-if="props.subtitle" class="micl-dialog__supporting-text">{{ t(props.subtitle) }}</span>
      </div>
    </div>

    <div class="micl-dialog__content kk-dialog__content">
      <slot />
      <p v-if="props.error" class="kk-form-error" role="alert">{{ props.error }}</p>
    </div>

    <div class="micl-dialog__actions">
      <button v-if="!props.hideCancel" type="button" class="micl-button-text-s" :disabled="props.busy" @click="onCancel">
        {{ t(props.cancelLabel ?? "Cancel") }}
      </button>
      <button
        type="button"
        class="micl-button-filled-s"
        :class="{ 'is-destructive': props.destructive }"
        :disabled="props.busy"
        @click="emit('confirm')"
      >
        <span v-if="props.busy" class="kk-button-spinner" aria-hidden="true"></span>
        {{ props.busy ? t("Saving…") : t(props.confirmLabel ?? "Save") }}
      </button>
    </div>
  </dialog>
</template>

