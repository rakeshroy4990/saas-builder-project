export {
  DEFAULT_STATIC_CONFIG,
  DEFAULT_DYNAMIC_CONFIG,
  DEFAULT_ENDPOINT_MAP,
  deepMerge,
  mergeStaticConfig,
  mergeDynamicConfig,
  endpointKey,
  type StaticConfig,
  type DynamicConfig,
  type EndpointMap,
  type NavItem,
  type UIAction,
  type SlotComponentNode,
  type UserRole
} from '@saas-builder/extensibility-contract';

export { applyBrandTokensToDom } from './static/applyBrandTokens';
export { loadStaticConfig, type StaticConfigLoaderOptions } from './static/loadStaticConfig';
export { seedStyleTemplatesFromStaticConfig, type StyleTemplateRegistrar } from './static/seedStyleTemplates';

export { loadDynamicConfig, type DynamicConfigFetchOptions } from './dynamic/loadDynamicConfig';
export {
  executeExtensionAction,
  buildExtensionActionContext,
  isAllowedExtensionHandler,
  type ExtensionActionContext,
  type ServiceRegistryLike
} from './dynamic/extensionActionRegistry';

export { useStaticConfigStore } from './stores/staticConfigStore';
export { useDynamicConfigStore } from './stores/dynamicConfigStore';
export { useStaticConfig } from './composables/useStaticConfig';
export { useDynamicConfig } from './composables/useDynamicConfig';
export { useNavigation, type NavigationZone } from './composables/useNavigation';

export { default as FeatureGate } from './components/FeatureGate.vue';
export { default as ExtensionSlot } from './components/ExtensionSlot.vue';

export {
  bootstrapFlexShellExtensibility,
  hydrateFlexShellDynamicConfig,
  type FlexShellExtensibilityOptions
} from './bootstrap/flexShellExtensibility';
export {
  applyServerExtensibilityOverrides,
  type ServerUiExtensibilityDocument,
  type ApplyServerExtensibilityOptions
} from './bootstrap/applyServerExtensibility';
