import {
  mergeDynamicConfig,
  mergeStaticConfig,
  type DeepPartial,
  type DynamicConfig,
  type StaticConfig
} from '@saas-builder/extensibility-contract';
import type { Pinia } from 'pinia';
import { useDynamicConfigStore } from '../stores/dynamicConfigStore';
import { useStaticConfigStore } from '../stores/staticConfigStore';

export type ServerUiExtensibilityDocument = {
  staticConfig?: DeepPartial<StaticConfig> | Record<string, unknown>;
  dynamicConfig?: DeepPartial<DynamicConfig> | Record<string, unknown>;
};

export type ApplyServerExtensibilityOptions = {
  seedStyleTemplates?: (config: StaticConfig) => void;
};

/** Merge L1/L2 fields from {@code GET /api/uiMetdata} into Pinia (after bundled bootstrap). */
export function applyServerExtensibilityOverrides(
  pinia: Pinia,
  doc: ServerUiExtensibilityDocument,
  options: ApplyServerExtensibilityOptions = {}
): void {
  const staticPartial = doc.staticConfig;
  if (staticPartial && typeof staticPartial === 'object' && Object.keys(staticPartial).length > 0) {
    const staticStore = useStaticConfigStore(pinia);
    const merged = mergeStaticConfig(staticStore.config, staticPartial as DeepPartial<StaticConfig>);
    staticStore.setConfig(merged);
    options.seedStyleTemplates?.(merged);
  }

  const dynamicPartial = doc.dynamicConfig;
  if (dynamicPartial && typeof dynamicPartial === 'object' && Object.keys(dynamicPartial).length > 0) {
    const dynamicStore = useDynamicConfigStore(pinia);
    const merged = mergeDynamicConfig(dynamicStore.config, dynamicPartial as DeepPartial<DynamicConfig>);
    dynamicStore.setConfig(merged);
  }
}
