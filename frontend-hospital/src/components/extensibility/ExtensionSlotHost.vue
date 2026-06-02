<script setup lang="ts">
import { ExtensionSlot } from '@saas-builder/extensibility-vue';
import type { SlotComponentNode } from '@saas-builder/extensibility-contract';
import DynamicContainer from '../renderer/DynamicContainer.vue';
import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';

const props = defineProps<{
  slotId: string;
  pageConfig: PageConfig;
}>();

function toComponentDefinition(node: SlotComponentNode): ComponentDefinition {
  return {
    id: node.id,
    type: node.type as ComponentDefinition['type'],
    config: node.config,
    styleTemplate: node.styleTemplate,
    condition: node.condition
  };
}
</script>

<template>
  <ExtensionSlot :id="slotId">
    <template #node="{ node }">
      <DynamicContainer
        :config="{
          id: `${slotId}-${node.id}`,
          type: 'container',
          layout: { type: 'flex', flex: ['flex-col'] },
          components: [toComponentDefinition(node)]
        }"
        :page-config="pageConfig"
        :html-id="`${slotId}-${node.id}`"
      />
    </template>
  </ExtensionSlot>
</template>
