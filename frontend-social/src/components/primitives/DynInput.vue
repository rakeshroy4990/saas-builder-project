<script setup lang="ts">
import { ref, computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface InputConfig {
  label?: string;
  placeholder?: string;
  inputType?: string;
  styles?: StyleConfig;
  /** Defaults to theme template `form.label.stack` */
  labelStyles?: StyleConfig;
  change?: ActionConfig;
}

const props = defineProps<{ config?: InputConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const model = ref('');
const classes = computed(() => resolveStyle(props.config?.styles));
const labelClass = computed(() =>
  resolveStyle(props.config?.labelStyles ?? { styleTemplate: 'form.label.stack' })
);

const fieldId = computed(() => (props.htmlId ? `${props.htmlId}-field` : undefined));
const labelTextId = computed(() => (props.htmlId ? `${props.htmlId}-label` : undefined));
const inputId = computed(() => (props.htmlId ? `${props.htmlId}-input` : undefined));

const onChange = async () => {
  emit('action', { action: props.config?.change, payload: { value: model.value } });
};
</script>

<template>
  <label :id="fieldId" :class="labelClass">
    <span v-if="config?.label" :id="labelTextId">{{ config?.label }}</span>
    <input
      :id="inputId"
      v-model="model"
      :class="classes"
      :type="config?.inputType ?? 'text'"
      :placeholder="config?.placeholder"
      @change="onChange"
    />
  </label>
</template>
