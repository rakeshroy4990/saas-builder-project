<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { sanitizeDomIdSegment } from '../../core/utils/domId';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';

interface RadioOption {
  label: string;
  labelI18nKey?: string;
  value: string;
}

interface RadioGroupConfig {
  label?: string;
  options: RadioOption[];
  change?: ActionConfig;
}

const props = defineProps<{ config?: RadioGroupConfig; htmlId?: string }>();
const { t } = useI18n();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const selected = ref('');
const fieldsetClass = computed(() => resolveStyle({ styleTemplate: 'form.radio.fieldset' }));
const optionLabelClass = computed(() => resolveStyle({ styleTemplate: 'form.radio.option' }));

const fieldsetId = computed(() => (props.htmlId ? `${props.htmlId}-fieldset` : undefined));
const legendId = computed(() => (props.htmlId ? `${props.htmlId}-legend` : undefined));
const groupName = computed(() => props.htmlId ?? 'dyn-radio-group');

const optionInputId = (index: number, value: string) =>
  props.htmlId ? `${props.htmlId}-input-${index}-${sanitizeDomIdSegment(value)}` : undefined;
const optionLabelId = (index: number, value: string) =>
  props.htmlId ? `${props.htmlId}-option-label-${index}-${sanitizeDomIdSegment(value)}` : undefined;
const optionTextId = (index: number, value: string) =>
  props.htmlId ? `${props.htmlId}-option-text-${index}-${sanitizeDomIdSegment(value)}` : undefined;

const onChange = async () => {
  emit('action', { action: props.config?.change, payload: { value: selected.value } });
};
</script>

<template>
  <fieldset :id="fieldsetId" :class="fieldsetClass">
    <legend :id="legendId">{{ config?.label }}</legend>
    <label
      v-for="(option, index) in config?.options ?? []"
      :key="option.value"
      :id="optionLabelId(index, option.value)"
      :class="optionLabelClass"
    >
      <input
        :id="optionInputId(index, option.value)"
        v-model="selected"
        type="radio"
        :name="groupName"
        :value="option.value"
        @change="onChange"
      />
      <span :id="optionTextId(index, option.value)">{{ option.labelI18nKey ? t(option.labelI18nKey) : option.label }}</span>
    </label>
  </fieldset>
</template>
