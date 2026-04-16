<script setup lang="ts">
import { computed } from 'vue';
import { resolveLayout } from '../../core/engine/LayoutResolver';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ContainerConfig } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import DynamicComponent from './DynamicComponent.vue';

const props = defineProps<{
  config: ContainerConfig;
  pageConfig: PageConfig;
  context?: Record<string, unknown>;
  /** DOM id for this region; also used as the `idScope` prefix for direct children. */
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);

const layoutClasses = computed(() => {
  const layout = resolveLayout(props.config.layoutTemplate, props.config.layout);
  if (!layout) return '';
  return layout.type === 'flex' ? (layout.flex ?? []).join(' ') : (layout.grid ?? []).join(' ');
});

const classes = computed(() =>
  resolveStyle(props.config.styles, [
    resolveStyle({ styleTemplate: 'chrome.dynamic.container' }),
    layoutClasses.value
  ])
);

const handleClick = async () => {
  if (props.config.click) {
    await execute(props.config.click);
  }
};
</script>

<template>
  <div :id="htmlId" :class="classes" @click="handleClick">
    <template v-for="child in config.children" :key="child.id">
      <DynamicComponent
        :definition="child"
        :page-config="pageConfig"
        :context="context"
        :id-scope="htmlId"
      />
    </template>
  </div>
</template>
