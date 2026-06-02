import type { Pinia } from 'pinia';
import type { DynamicConfig, StaticConfig } from '@saas-builder/extensibility-contract';
import { loadDynamicConfig, loadStaticConfig } from '../index';
import { useDynamicConfigStore } from '../stores/dynamicConfigStore';
import { useStaticConfigStore } from '../stores/staticConfigStore';

export type FlexShellExtensibilityOptions = {
  /** Required when bootstrapping before `app.use(pinia)`. */
  pinia: Pinia;
  bundledStatic: StaticConfig;
  bundledDynamicDefaults?: DynamicConfig;
  resolveApiUrl: (path: string) => string;
  /** CDN or remote static config URL (set from app `import.meta.env.VITE_STATIC_CONFIG_URL`). */
  staticConfigUrl?: string;
  configStaticPath?: string;
  configDynamicPath?: string;
  dynamicCredentials?: RequestCredentials;
  onStaticLoaded?: (config: StaticConfig) => void;
};

export async function bootstrapFlexShellExtensibility(
  options: FlexShellExtensibilityOptions
): Promise<StaticConfig> {
  const staticStore = useStaticConfigStore(options.pinia);
  const staticConfig = await loadStaticConfig({
    bundledDefaults: options.bundledStatic,
    fetchUrl: options.staticConfigUrl,
    apiPath: options.configStaticPath,
    resolveApiUrl: options.resolveApiUrl
  });
  staticStore.setConfig(staticConfig);
  options.onStaticLoaded?.(staticConfig);
  return staticConfig;
}

export async function hydrateFlexShellDynamicConfig(
  options: FlexShellExtensibilityOptions
): Promise<void> {
  const store = useDynamicConfigStore(options.pinia);
  store.setLoading(true);
  const config = await loadDynamicConfig({
    bundledDefaults: options.bundledDynamicDefaults,
    apiPath: options.configDynamicPath,
    resolveApiUrl: options.resolveApiUrl,
    credentials: options.dynamicCredentials ?? 'omit'
  });
  store.setConfig(config);
}
