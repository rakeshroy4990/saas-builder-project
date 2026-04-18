<script setup lang="ts">
import { computed } from 'vue';
import { useAsyncBusy } from '@saas-builder/vue-async-ui';
import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { ComponentRegistry } from '../../core/registry/ComponentRegistry';
import { evaluateCondition } from '../../core/engine/ConditionEvaluator';
import { useActionEngine } from '../../composables/useActionEngine';
import { resolveMapping } from '../../core/engine/DataMapper';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { MappingConfig } from '../../core/types/MappingConfig';
import { resolveComponentDomId } from '../../core/utils/domId';

const props = defineProps<{
  definition: ComponentDefinition;
  pageConfig: PageConfig;
  context?: Record<string, unknown>;
  /** When set, child DOM ids are `${idScope}--${definition.id}` unless a child sets `domId`. */
  idScope?: string;
}>();

const elementHtmlId = computed(() =>
  resolveComponentDomId({
    definitionId: props.definition.id,
    type: props.definition.type,
    idScope: props.idScope,
    domId: props.definition.domId
  })
);

const { execute } = useActionEngine(props.pageConfig);
const asyncBusy = useAsyncBusy();
const component = computed(() => ComponentRegistry.get(props.definition.type));
const isVisible = computed(() =>
  props.definition.condition ? evaluateCondition(props.definition.condition) : true
);

const templateTokenRegex = /\{\{\s*([^}]+)\s*\}\}/g;

const resolveTokenString = (source: string): string => {
  if (!props.context) return source;
  return source.replace(templateTokenRegex, (_full, path) => {
    const keys = String(path).split('.');
    const value = keys.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, props.context);
    return value == null ? '' : String(value);
  });
};

const resolveTemplateObject = (value: unknown): unknown => {
  if (typeof value === 'string') return resolveTokenString(value);
  if (Array.isArray(value)) return value.map((entry) => resolveTemplateObject(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        resolveTemplateObject(inner)
      ])
    );
  }
  return value;
};

const resolvedConfig = computed(() => {
  const config = resolveTemplateObject(props.definition.config ?? {}) as Record<string, unknown>;

  if (props.definition.type === 'text' && config.mapping) {
    return { ...config, text: resolveMapping(config.mapping as MappingConfig) };
  }

  if (props.definition.type === 'dropdown' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, options: Array.isArray(mapped) ? mapped : [] };
  }

  if (props.definition.type === 'list' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, items: Array.isArray(mapped) ? mapped : [] };
  }

  if (props.definition.type === 'image' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, src: typeof mapped === 'string' ? mapped : '' };
  }

  return config;
});

const displayConfig = computed(() => {
  if (props.definition.type !== 'button') {
    return resolvedConfig.value;
  }
  const rc = resolvedConfig.value as Record<string, unknown>;
  if (!rc?.click) {
    return rc;
  }
  const raw = props.definition.config as Record<string, unknown> | undefined;
  const anim =
    typeof raw?.busyAnimation === 'string' && raw.busyAnimation.trim().length > 0
      ? raw.busyAnimation.trim()
      : 'dots';
  return {
    ...rc,
    actionPending: asyncBusy.pending.value,
    busyAnimation: anim
  };
});

const onAction = async (event: { action?: ActionConfig; payload?: Record<string, unknown> }) => {
  if (!event?.action) return;
  const raw = props.definition.config as Record<string, unknown> | undefined;
  if (props.definition.type === 'button' && raw?.click) {
    await asyncBusy.runExclusive(() => execute(event.action!, event.payload));
    return;
  }
  await execute(event.action, event.payload);
};

const unknownTypeClass = computed(() => resolveStyle({ styleTemplate: 'system.error.unknownType' }));

const containerContextBinding = computed(() =>
  props.definition.type === 'container' ? { context: props.context } : {}
);
</script>

<template>
  <component
    :is="component"
    v-if="component && isVisible"
    :config="displayConfig"
    :page-config="pageConfig"
    :html-id="elementHtmlId"
    v-bind="containerContextBinding"
    @action="onAction"
  />
  <div v-else-if="!component" :id="elementHtmlId" :class="unknownTypeClass">
    Unknown type: {{ definition.type }}
  </div>
</template>
