import {
  seedStyleTemplatesFromStaticConfig,
  useDynamicConfigStore,
  useStaticConfigStore,
  type StaticConfig
} from '@saas-builder/extensibility-vue';
import bundledStatic from '../../config/extensibility/static.config.json';
import bundledDynamicDefaults from '../../config/extensibility/dynamic.config.defaults.json';
import { StyleTemplateRegistry } from '../engine/StyleTemplateRegistry';
import type { DynamicConfig } from '@saas-builder/extensibility-contract';
import type { Pinia } from 'pinia';

/** L1/L2 bundled defaults only; server overrides come from {@code GET /api/uiMetdata}. */
export async function bootstrapExtensibility(pinia: Pinia): Promise<void> {
  const staticStore = useStaticConfigStore(pinia);
  staticStore.setConfig(bundledStatic as StaticConfig);

  seedStyleTemplatesFromStaticConfig(bundledStatic as StaticConfig, (key, template) => {
    StyleTemplateRegistry.register(key, template);
  });

  const dynamicStore = useDynamicConfigStore(pinia);
  dynamicStore.setConfig(bundledDynamicDefaults as DynamicConfig);
}

export function seedStyleTemplatesFromStatic(staticConfig: StaticConfig): void {
  seedStyleTemplatesFromStaticConfig(staticConfig, (key, template) => {
    StyleTemplateRegistry.register(key, template);
  });
}
