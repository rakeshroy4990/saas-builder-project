<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface TextConfig {
  text?: string;
  styles?: StyleConfig;
}

const props = defineProps<{ config?: TextConfig; htmlId?: string }>();
const classes = computed(() => resolveStyle(props.config?.styles));
const value = computed(() => props.config?.text ?? '');
</script>

<template>
  <span :id="htmlId" :class="classes">{{ value }}</span>
</template>
