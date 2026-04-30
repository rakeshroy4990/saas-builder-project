<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface InputConfig {
  label?: string;
  placeholder?: string;
  inputType?: string;
  value?: string;
  min?: string;
  max?: string;
  /** HTML attribute; use with `numericOnly` for digit-only age-style fields. */
  maxlength?: number;
  inputMode?: string;
  pattern?: string;
  /** Strip non-digits on each input (value is digits only). */
  numericOnly?: boolean;
  accept?: string;
  multiple?: boolean;
  rows?: number;
  styles?: StyleConfig;
  /** Defaults to theme template `form.label.stack` */
  labelStyles?: StyleConfig;
  change?: ActionConfig;
  unavailableDates?: string[];
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
const inputElementRef = ref<HTMLInputElement | null>(null);
const unavailableDateSet = computed(() => new Set((props.config?.unavailableDates ?? []).map((x) => String(x).trim())));

const emitChange = async () => {
  emit('action', { action: props.config?.change, payload: { value: model.value } });
};

const onTextOrDateInput = async () => {
  if (props.config?.numericOnly) {
    const digits = model.value.replace(/\D/g, '');
    if (digits !== model.value) {
      model.value = digits;
    }
  }
  if (props.config?.inputType === 'date' && model.value && unavailableDateSet.value.has(model.value)) {
    const input = inputElementRef.value;
    if (input) {
      input.setCustomValidity('No slots available for this date. Please choose another date.');
      input.reportValidity();
      input.setCustomValidity('');
    }
    model.value = '';
  }
  await emitChange();
};

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const files = input?.files ? Array.from(input.files) : [];
  const fileNames = files.map((file) => file.name);
  emit('action', {
    action: props.config?.change,
    payload: { value: fileNames.join(', '), files, fileNames }
  });
};

const onLabelClick = () => {
  if (props.config?.inputType !== 'date') {
    return;
  }
  const input = inputElementRef.value;
  if (!input) {
    return;
  }
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof pickerInput.showPicker === 'function') {
    pickerInput.showPicker();
    return;
  }
  input.focus();
};

watch(
  () => props.config?.value,
  (nextValue) => {
    const resolved = nextValue == null ? '' : String(nextValue);
    if (resolved !== model.value) {
      model.value = resolved;
    }
  },
  { immediate: true }
);
</script>

<template>
  <label :id="fieldId" :class="labelClass" @click="onLabelClick">
    <span v-if="config?.label" :id="labelTextId">{{ config?.label }}</span>
    <input
      v-if="config?.inputType === 'file'"
      :id="inputId"
      :class="classes"
      type="file"
      :accept="config?.accept"
      :multiple="Boolean(config?.multiple)"
      @change="onFileChange"
    />
    <input
      v-else-if="config?.inputType !== 'textarea'"
      ref="inputElementRef"
      :id="inputId"
      v-model="model"
      :class="classes"
      :type="config?.inputType ?? 'text'"
      :placeholder="config?.placeholder"
      :min="config?.min"
      :max="config?.max"
      :maxlength="config?.maxlength"
      :inputmode="config?.inputMode"
      :pattern="config?.pattern"
      @input="onTextOrDateInput"
    />
    <textarea
      v-else
      :id="inputId"
      v-model="model"
      :class="classes"
      :rows="config?.rows ?? 4"
      :placeholder="config?.placeholder"
      @input="emitChange"
    />
  </label>
</template>
