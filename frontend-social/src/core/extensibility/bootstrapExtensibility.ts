import {
  bootstrapFlexShellExtensibility,
  useDynamicConfigStore,
  type StaticConfig
} from '@saas-builder/extensibility-vue';
import bundledStatic from '../../config/extensibility/static.config.json';
import bundledDynamicDefaults from '../../config/extensibility/dynamic.config.defaults.json';
import { resolveSpringApiUrl } from '../../services/http/apiPaths';
import type { DynamicConfig } from '@saas-builder/extensibility-contract';
import type { Pinia } from 'pinia';

/** Bundled L1/L2 only; server overrides via {@code GET /api/uiMetdata}. */
export async function bootstrapExtensibility(pinia: Pinia): Promise<void> {
  await bootstrapFlexShellExtensibility({
    pinia,
    bundledStatic: bundledStatic as StaticConfig,
    bundledDynamicDefaults: bundledDynamicDefaults as DynamicConfig,
    resolveApiUrl: resolveSpringApiUrl
  });
  const dynamicStore = useDynamicConfigStore(pinia);
  dynamicStore.setConfig(bundledDynamicDefaults as DynamicConfig);
}
