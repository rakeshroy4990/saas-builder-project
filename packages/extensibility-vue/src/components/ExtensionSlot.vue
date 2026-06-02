<script setup lang="ts">
import { computed } from 'vue';
import { useDynamicConfig } from '../composables/useDynamicConfig';

const props = defineProps<{
  id: string;
}>();

const { config } = useDynamicConfig();

const slotNodes = computed(() => config.value.slots[props.id] ?? []);
</script>

<template>
  <div v-if="slotNodes.length" :data-extension-slot="id" class="extension-slot contents">
    <!-- Slot nodes are rendered by host app DynamicContainer bridge when integrated -->
    <template v-for="node in slotNodes" :key="node.id">
      <slot name="node" :node="node" />
    </template>
  </div>
</template>
