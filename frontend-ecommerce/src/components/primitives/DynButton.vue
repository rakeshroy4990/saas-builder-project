<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface ButtonConfig {
  text?: string;
  disabled?: boolean;
  styles?: StyleConfig;
  click?: ActionConfig;
}

const props = defineProps<{ config?: ButtonConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const classes = computed(() => resolveStyle(props.config?.styles));

const onClick = async () => {
  emit('action', { action: props.config?.click, payload: {} });
};
</script>

<template>
  <button :id="htmlId" :class="classes" :disabled="config?.disabled" @click="onClick">
    {{ config?.text ?? '' }}
  </button>
</template>
