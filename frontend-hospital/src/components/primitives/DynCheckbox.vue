<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';

interface CheckboxConfig {
  label?: string;
  /** When set (e.g. from Pinia via DynamicComponent), stays in sync with store. */
  checked?: boolean;
  change?: ActionConfig;
}

const props = defineProps<{ config?: CheckboxConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const checked = ref(Boolean(props.config?.checked));

watch(
  () => props.config?.checked,
  (next) => {
    const nextBool = Boolean(next);
    if (nextBool !== checked.value) {
      checked.value = nextBool;
    }
  },
  { immediate: true }
);

const labelClass = computed(() => resolveStyle({ styleTemplate: 'form.checkbox.label' }));

const fieldId = computed(() => (props.htmlId ? `${props.htmlId}-field` : undefined));
const inputId = computed(() => (props.htmlId ? `${props.htmlId}-input` : undefined));
const labelTextId = computed(() => (props.htmlId ? `${props.htmlId}-label` : undefined));

const onChange = async () => {
  emit('action', { action: props.config?.change, payload: { checked: checked.value } });
};
</script>

<template>
  <label :id="fieldId" :class="labelClass">
    <input :id="inputId" v-model="checked" type="checkbox" @change="onChange" />
    <span :id="labelTextId">{{ config?.label }}</span>
  </label>
</template>
