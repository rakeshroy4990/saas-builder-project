<script setup lang="ts">
import { computed } from 'vue';
import { useStaticConfig } from '../composables/useStaticConfig';
import { useDynamicConfig } from '../composables/useDynamicConfig';

const props = defineProps<{
  flag: string;
}>();

const { isFlagEnabled } = useStaticConfig();
const { config: dynamicConfig } = useDynamicConfig();

const enabled = computed(() => {
  const dynamicFlags = dynamicConfig.value.flags;
  if (dynamicFlags && props.flag in dynamicFlags) {
    return Boolean(dynamicFlags[props.flag]);
  }
  return isFlagEnabled(props.flag);
});
</script>

<template>
  <slot v-if="enabled" />
</template>
