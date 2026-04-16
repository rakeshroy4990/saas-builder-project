<script setup lang="ts">
import { computed } from 'vue';
import type { ContainerConfig } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import DynamicContainer from '../renderer/DynamicContainer.vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface ListConfig {
  items?: unknown[];
  itemTemplate: ContainerConfig;
  /** Preferred: named template from StyleTemplateRegistry */
  listStyleTemplate?: string;
  /** @deprecated use listStyleTemplate */
  listClass?: string;
  listStyles?: StyleConfig;
}

const props = defineProps<{ config?: ListConfig; pageConfig: PageConfig; htmlId?: string }>();
const items = computed(() => props.config?.items ?? []);

const rowHtmlId = (index: number) =>
  props.htmlId ? `${props.htmlId}-row-${index}` : `list-row-${index}`;
const listClasses = computed(() => {
  const t = props.config?.listStyleTemplate;
  if (t) return resolveStyle({ styleTemplate: t });
  return resolveStyle(props.config?.listStyles, props.config?.listClass ? [props.config.listClass] : []);
});
</script>

<template>
  <div :id="htmlId" :class="listClasses">
    <DynamicContainer
      v-for="(item, index) in items"
      :key="index"
      :config="{ ...config?.itemTemplate, children: config?.itemTemplate?.children ?? [] }"
      :page-config="pageConfig"
      :context="(item as Record<string, unknown>)"
      :html-id="rowHtmlId(index)"
    />
  </div>
</template>
