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
import type { ActionConfig, ActionRunTelemetryContext } from '../../core/types/ActionConfig';
import type { MappingConfig } from '../../core/types/MappingConfig';
import { resolveComponentDomId } from '../../core/utils/domId';
import { useAppStore } from '../../store/useAppStore';

/** `text` from `mapping`, optional truncation via `mappingMaxLength`, `textFallback` when empty; `truncatedTitle` = full string when truncated. */
function resolveMappedDisplayFields(
  mapping: MappingConfig,
  config: Record<string, unknown>
): { text: string; truncatedTitle?: string } {
  const raw = resolveMapping(mapping);
  let full = raw == null ? '' : String(raw).trim();
  const maxRaw = config.mappingMaxLength;
  const maxLen =
    typeof maxRaw === 'number' && Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : undefined;
  let s = full;
  if (maxLen != null && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }
  if (!s) {
    const fb = config.textFallback;
    s = typeof fb === 'string' && fb.trim().length > 0 ? fb.trim() : '';
  }
  const truncatedTitle = maxLen != null && full.length > s.length ? full : undefined;
  return { text: s, truncatedTitle };
}

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
const appStore = useAppStore();
const component = computed(() => ComponentRegistry.get(props.definition.type));
const isVisible = computed(() => {
  // Nested keys (e.g. HomeContent.hero.videoId) are not always tracked through getData() alone.
  void appStore.dataRevision;
  return props.definition.condition ? evaluateCondition(props.definition.condition, props.context) : true;
});

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
  void appStore.dataRevision;
  const config = resolveTemplateObject(props.definition.config ?? {}) as Record<string, unknown>;

  if (props.definition.type === 'text' && config.mapping) {
    const { text, truncatedTitle } = resolveMappedDisplayFields(config.mapping as MappingConfig, config);
    const out: Record<string, unknown> = { ...config, text };
    if (truncatedTitle) {
      out.title = truncatedTitle;
    }
    return out;
  }

  if (props.definition.type === 'button') {
    let out: Record<string, unknown> = { ...config };
    if (config.mapping) {
      const { text, truncatedTitle } = resolveMappedDisplayFields(config.mapping as MappingConfig, config);
      const explicitTitle =
        typeof config.title === 'string' && config.title.trim().length > 0 ? config.title.trim() : undefined;
      out = { ...out, text, title: truncatedTitle ?? explicitTitle };
    }
    const dc = props.definition.disabledCondition;
    if (dc && evaluateCondition(dc, props.context)) {
      out = { ...out, disabled: true };
    }
    return out;
  }

  if (props.definition.type === 'dropdown') {
    let out: Record<string, unknown> = { ...config };
    if (config.mapping) {
      const mapped = resolveMapping(config.mapping as MappingConfig);
      out = { ...out, options: Array.isArray(mapped) ? mapped : [] };
    }
    const vm = config.valueMapping as MappingConfig | undefined;
    if (vm) {
      const v = resolveMapping(vm);
      out = { ...out, value: v == null ? '' : String(v) };
    }
    return out;
  }

  if (props.definition.type === 'list' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, items: Array.isArray(mapped) ? mapped : [] };
  }

  if (props.definition.type === 'image' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, src: typeof mapped === 'string' ? mapped : '' };
  }

  if (props.definition.type === 'youtube-embed' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    const aspectMapped = config.aspectModeMapping
      ? resolveMapping(config.aspectModeMapping as MappingConfig)
      : config.aspectMode;
    return {
      ...config,
      videoId: mapped == null ? '' : String(mapped).trim(),
      aspectMode: aspectMapped == null ? 'auto' : String(aspectMapped).trim().toLowerCase()
    };
  }

  if ((props.definition.type === 'input' || props.definition.type === 'medicine-list-editor') && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    let out: Record<string, unknown> = { ...config, value: mapped == null ? '' : String(mapped) };
    if (props.definition.type === 'input' && config.unavailableDatesMapping) {
      const mappedDates = resolveMapping(config.unavailableDatesMapping as MappingConfig);
      out = { ...out, unavailableDates: Array.isArray(mappedDates) ? mappedDates : [] };
    }
    return out;
  }

  if (props.definition.type === 'input' && config.unavailableDatesMapping) {
    const mappedDates = resolveMapping(config.unavailableDatesMapping as MappingConfig);
    return { ...config, unavailableDates: Array.isArray(mappedDates) ? mappedDates : [] };
  }

  if (props.definition.type === 'date-picker') {
    let out: Record<string, unknown> = { ...config };
    if (config.mapping) {
      const mapped = resolveMapping(config.mapping as MappingConfig);
      out = { ...out, value: mapped == null ? '' : String(mapped) };
    }
    if (config.unavailableDatesMapping) {
      const mappedDates = resolveMapping(config.unavailableDatesMapping as MappingConfig);
      out = { ...out, unavailableDates: Array.isArray(mappedDates) ? mappedDates : [] };
    }
    if (config.slotCountsMapping) {
      const mappedCounts = resolveMapping(config.slotCountsMapping as MappingConfig);
      out = { ...out, slotCounts: Array.isArray(mappedCounts) ? mappedCounts : [] };
    }
    return out;
  }

  if (props.definition.type === 'checkbox' && config.mapping) {
    const mapped = resolveMapping(config.mapping as MappingConfig);
    return { ...config, checked: Boolean(mapped) };
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

const runTelemetry = computed<ActionRunTelemetryContext | undefined>(() => ({
  component_id: elementHtmlId.value
}));

const onAction = async (event: { action?: ActionConfig; payload?: Record<string, unknown> }) => {
  if (!event?.action) return;
  const raw = props.definition.config as Record<string, unknown> | undefined;
  const tel = runTelemetry.value;
  if (props.definition.type === 'button' && raw?.click) {
    await asyncBusy.runExclusive(() => execute(event.action!, event.payload, tel));
    return;
  }
  await execute(event.action, event.payload, tel);
};

const unknownTypeClass = computed(() => resolveStyle({ styleTemplate: 'system.error.unknownType' }));

/** Nested `container` → `DynamicContainer` must receive list row `context` (tokens, conditions, actions). */
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
