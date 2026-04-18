<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { sanitizeDomIdSegment } from '../../core/utils/domId';
import { resolveStyle } from '../../core/engine/StyleResolver';
import { DISABLED_NATIVE_CONTROL_CLASSES } from '../../core/theme/disabledControlChrome';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface DropdownConfig {
  label?: string;
  options?: Array<{ label?: string; value?: string; id?: string; name?: string } | string>;
  /** Current selection — keep in sync with store via `valueMapping` on the page definition. */
  value?: string;
  disabled?: boolean;
  styles?: StyleConfig;
  labelStyles?: StyleConfig;
  change?: ActionConfig;
}

const props = defineProps<{ config?: DropdownConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();
const selected = ref('');
const classes = computed(() => [resolveStyle(props.config?.styles), DISABLED_NATIVE_CONTROL_CLASSES]);
const labelClass = computed(() => [
  resolveStyle(props.config?.labelStyles ?? { styleTemplate: 'form.label.stack' }),
  Boolean(props.config?.disabled) ? 'opacity-60' : ''
]);
const options = computed(() => props.config?.options ?? []);

const fieldId = computed(() => (props.htmlId ? `${props.htmlId}-field` : undefined));
const labelTextId = computed(() => (props.htmlId ? `${props.htmlId}-label` : undefined));
const selectId = computed(() => (props.htmlId ? `${props.htmlId}-select` : undefined));

const optionId = (index: number, raw: unknown) => {
  if (!props.htmlId) return undefined;
  const seg =
    typeof raw === 'string' || typeof raw === 'number'
      ? sanitizeDomIdSegment(String(raw))
      : `i${index}`;
  return `${props.htmlId}-opt-${index}-${seg}`;
};

const onChange = async () => {
  emit('action', { action: props.config?.change, payload: { value: selected.value } });
};

watch(
  () => props.config?.value,
  (next) => {
    const v = next == null ? '' : String(next);
    if (v !== selected.value) {
      selected.value = v;
    }
  },
  { immediate: true }
);
</script>

<template>
  <label :id="fieldId" :class="labelClass">
    <span :id="labelTextId">{{ config?.label }}</span>
    <select
      :id="selectId"
      v-model="selected"
      :class="classes"
      :disabled="Boolean(config?.disabled)"
      @change="onChange"
    >
      <option :id="htmlId ? `${htmlId}-opt-placeholder` : undefined" value="">Select...</option>
      <option
        v-for="(option, index) in options"
        :id="optionId(index, option.value ?? option.id ?? option)"
        :key="option.value ?? option.id ?? option"
        :value="option.value ?? option.id ?? option"
      >
        {{ option.label ?? option.name ?? option }}
      </option>
    </select>
  </label>
</template>
