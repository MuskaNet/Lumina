<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    lines?: 1 | 2 | 3;
    headline?: string;
    supportingText?: string;
    overline?: string;
    leadingIcon?: string;
    leadingAvatar?: string;
    trailingText?: string;
    trailingIcon?: string;
    disabled?: boolean;
    clickable?: boolean;
    selected?: boolean;
    tabindex?: number | string;
    href?: string;
  }>(),
  {
    lines: 1,
    headline: undefined,
    supportingText: undefined,
    overline: undefined,
    leadingIcon: undefined,
    leadingAvatar: undefined,
    trailingText: undefined,
    trailingIcon: undefined,
    disabled: false,
    clickable: false,
    selected: false,
    tabindex: undefined,
    href: undefined,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent | KeyboardEvent];
}>();

const lineClass = computed(() => {
  if (props.lines === 3) return "micl-list-item-three";
  if (props.lines === 2) return "micl-list-item-two";
  return "micl-list-item-one";
});

const itemTabindex = computed(() => {
  if (props.disabled) return undefined;
  if (props.tabindex !== undefined) return props.tabindex;
  if (props.clickable || props.href) return 0;
  return undefined;
});

function onClick(event: MouseEvent | KeyboardEvent) {
  if (props.disabled) return;
  emit("click", event);
}
</script>

<template>
  <li
    :class="[
      lineClass,
      {
        'micl-list-item--disabled': disabled,
        'is-selected': selected,
      },
    ]"
    :tabindex="itemTabindex"
    :aria-disabled="disabled ? 'true' : undefined"
    @click="onClick"
    @keydown.enter="onClick"
    @keydown.space.prevent="onClick"
  >
    <a v-if="href && !disabled" :href="href">
      <slot name="leading">
        <span
          v-if="leadingIcon"
          class="micl-list-item__icon material-symbols-outlined"
          aria-hidden="true"
        >{{ leadingIcon }}</span>
        <span v-else-if="leadingAvatar" class="micl-list-item__avatar">{{ leadingAvatar }}</span>
      </slot>
      <span class="micl-list-item__text">
        <span v-if="overline || $slots.overline" class="micl-list-item__overline">
          <slot name="overline">{{ overline }}</slot>
        </span>
        <span class="micl-list-item__headline">
          <slot name="headline"><slot>{{ headline }}</slot></slot>
        </span>
        <span v-if="supportingText || $slots.supportingText" class="micl-list-item__supporting-text">
          <slot name="supportingText">{{ supportingText }}</slot>
        </span>
      </span>
      <slot name="trailing">
        <span v-if="trailingText" class="micl-list-item__trailing-text">{{ trailingText }}</span>
        <span
          v-if="trailingIcon"
          class="micl-list-item__icon material-symbols-outlined"
          aria-hidden="true"
        >{{ trailingIcon }}</span>
      </slot>
    </a>
    <template v-else>
      <slot name="leading">
        <span
          v-if="leadingIcon"
          class="micl-list-item__icon material-symbols-outlined"
          aria-hidden="true"
        >{{ leadingIcon }}</span>
        <span v-else-if="leadingAvatar" class="micl-list-item__avatar">{{ leadingAvatar }}</span>
      </slot>
      <span class="micl-list-item__text">
        <span v-if="overline || $slots.overline" class="micl-list-item__overline">
          <slot name="overline">{{ overline }}</slot>
        </span>
        <span class="micl-list-item__headline">
          <slot name="headline"><slot>{{ headline }}</slot></slot>
        </span>
        <span v-if="supportingText || $slots.supportingText" class="micl-list-item__supporting-text">
          <slot name="supportingText">{{ supportingText }}</slot>
        </span>
      </span>
      <slot name="trailing">
        <span v-if="trailingText" class="micl-list-item__trailing-text">{{ trailingText }}</span>
        <span
          v-if="trailingIcon"
          class="micl-list-item__icon material-symbols-outlined"
          aria-hidden="true"
        >{{ trailingIcon }}</span>
      </slot>
    </template>
  </li>
</template>
