<script setup lang="ts">
import { computed, type Component } from 'vue';
import { BusyIndicatorRegistry } from '@saas-builder/vue-async-ui';
import { resolveStyle } from '../../core/engine/StyleResolver';
import { DISABLED_NATIVE_CONTROL_CLASSES } from '../../core/theme/disabledControlChrome';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface ButtonConfig {
  text?: string;
  disabled?: boolean;
  hiddenWhenEmptyText?: boolean;
  title?: string;
  styles?: StyleConfig;
  click?: ActionConfig;
  /** Set by DynamicComponent while the click action chain is in flight */
  actionPending?: boolean;
  /** Registry id, default `dots` */
  busyAnimation?: string;
}

const props = defineProps<{ config?: ButtonConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();

const busyIndicator = computed((): Component | null => {
  if (!props.config?.actionPending) return null;
  const id = props.config.busyAnimation;
  return BusyIndicatorRegistry.resolve(typeof id === 'string' ? id : undefined) ?? null;
});

const isDisabled = computed(() => !!(props.config?.disabled || props.config?.actionPending));

const classes = computed(() => [
  resolveStyle(props.config?.styles),
  DISABLED_NATIVE_CONTROL_CLASSES,
  props.config?.actionPending ? 'cursor-wait' : ''
]);

const shouldRender = computed(() => {
  if (!props.config?.hiddenWhenEmptyText) return true;
  return String(props.config?.text ?? '').trim().length > 0;
});

const onClick = () => {
  if (isDisabled.value) return;
  emit('action', { action: props.config?.click, payload: {} });
};
</script>

<template>
  <button
    v-if="shouldRender"
    :id="htmlId"
    type="button"
    :class="classes"
    :disabled="isDisabled"
    :title="config?.title"
    :aria-busy="config?.actionPending ? 'true' : undefined"
    @click="onClick"
  >
    <span
      v-if="config?.actionPending && busyIndicator"
      class="inline-flex min-h-[1.25em] min-w-[2em] items-center justify-center"
    >
      <component :is="busyIndicator" />
    </span>
    <span v-else>{{ config?.text ?? '' }}</span>
  </button>
</template>
