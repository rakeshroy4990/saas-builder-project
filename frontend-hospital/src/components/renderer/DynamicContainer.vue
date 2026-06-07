<script setup lang="ts">
import { computed, type Component } from 'vue';
import { BusyIndicatorRegistry, useAsyncBusy } from '@saas-builder/vue-async-ui';
import { resolveLayout } from '../../core/engine/LayoutResolver';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ContainerConfig } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { resolveContextTemplate } from '../../core/engine/contextTemplate';
import type { ActionConfig } from '../../core/types/ActionConfig';
import DynamicComponent from './DynamicComponent.vue';

const props = defineProps<{
  config: ContainerConfig;
  pageConfig: PageConfig;
  context?: Record<string, unknown>;
  /** DOM id for this region; also used as the `idScope` prefix for direct children. */
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const asyncBusy = useAsyncBusy();

const layoutClasses = computed(() => {
  const layout = resolveLayout(props.config.layoutTemplate, props.config.layout);
  if (!layout) return '';
  return layout.type === 'flex' ? (layout.flex ?? []).join(' ') : (layout.grid ?? []).join(' ');
});

const actionPending = computed(() => Boolean(props.config.click && asyncBusy.pending.value));

const classes = computed(() =>
  resolveStyle(props.config.styles, [
    resolveStyle({ styleTemplate: 'chrome.dynamic.container' }),
    layoutClasses.value,
    actionPending.value ? 'pointer-events-none cursor-wait opacity-80' : ''
  ])
);

const rootAttrsBind = computed(() => {
  const r = props.config.rootAttrs;
  const base = r && typeof r === 'object' ? { ...r } : {};
  if (props.config.click) {
    return {
      ...base,
      'aria-busy': actionPending.value ? 'true' : undefined
    };
  }
  return base;
});

const busyIndicator = computed((): Component | null => {
  if (!actionPending.value) return null;
  return BusyIndicatorRegistry.resolve('dots') ?? null;
});

const handleClick = async () => {
  if (!props.config.click || asyncBusy.pending.value) return;
  const resolvedClick = resolveContextTemplate(props.config.click, props.context) as ActionConfig;
  await asyncBusy.runExclusive(() =>
    execute(resolvedClick, undefined, {
      component_id: props.config.domId ?? props.htmlId ?? 'container'
    })
  );
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.config.click || asyncBusy.pending.value) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  void handleClick();
};
</script>

<template>
  <div
    :id="htmlId"
    :class="classes"
    v-bind="rootAttrsBind"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div
      v-if="actionPending && busyIndicator"
      class="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/75"
      aria-hidden="true"
    >
      <component :is="busyIndicator" class="text-emerald-700" />
    </div>
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
