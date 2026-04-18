<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface TextConfig {
  text?: string;
  styles?: StyleConfig;
  click?: ActionConfig;
}

const props = defineProps<{ config?: TextConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const classes = computed(() => resolveStyle(props.config?.styles));
const value = computed(() => props.config?.text ?? '');
const interactiveClasses = computed(() =>
  props.config?.click ? ' cursor-pointer select-none underline-offset-4 hover:opacity-90' : ''
);

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
