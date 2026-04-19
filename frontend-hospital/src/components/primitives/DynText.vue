<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface TextConfig {
  text?: string;
  styles?: StyleConfig;
  click?: ActionConfig;
  /** With `click`, skip hover underline; use a light background hover instead (e.g. header brand title). */
  plainClick?: boolean;
}

const props = defineProps<{ config?: TextConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const classes = computed(() => resolveStyle(props.config?.styles));
const value = computed(() => props.config?.text ?? '');
const interactiveClasses = computed(() => {
  if (!props.config?.click) return '';
  if (props.config.plainClick) {
    return ' cursor-pointer select-none rounded-md px-1 -mx-1 py-0.5 hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';
  }
  return ' cursor-pointer select-none rounded-md px-1 -mx-1 py-0.5 decoration-emerald-600/50 underline-offset-4 hover:underline hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';
});

const onClick = async () => {
  if (props.config?.click) {
    emit('action', { action: props.config.click, payload: {} });
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if (!props.config?.click) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    void onClick();
  }
};
</script>

<template>
  <span
    v-if="config?.click"
    :id="htmlId"
    role="link"
    tabindex="0"
    :class="[classes, interactiveClasses]"
    @click="onClick"
    @keydown="onKeydown"
    >{{ value }}</span
  >
  <span v-else :id="htmlId" :class="classes">{{ value }}</span>
</template>
