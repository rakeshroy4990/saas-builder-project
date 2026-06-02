import {
  DEFAULT_DYNAMIC_CONFIG,
  mergeDynamicConfig,
  type DeepPartial,
  type DynamicConfig
} from '@saas-builder/extensibility-contract';

export type DynamicConfigFetchOptions = {
  resolveApiUrl: (path: string) => string;
  apiPath?: string;
  credentials?: RequestCredentials;
  bundledDefaults?: DynamicConfig;
  bundledOverride?: DeepPartial<DynamicConfig>;
};

export async function loadDynamicConfig(options: DynamicConfigFetchOptions): Promise<DynamicConfig> {
  const base = options.bundledDefaults ?? DEFAULT_DYNAMIC_CONFIG;
  let merged = mergeDynamicConfig(base, options.bundledOverride);

  const path = options.apiPath?.trim();
  if (!path) {
    return merged;
  }
  try {
    const res = await fetch(options.resolveApiUrl(path), {
      method: 'GET',
      credentials: options.credentials ?? 'omit',
      headers: { Accept: 'application/json' }
    });
    if (res.ok && res.status !== 204) {
      const body = await res.json();
      const root = (body?.data ?? body) as Record<string, unknown>;
      const dynamic = (root?.dynamicConfig ?? root) as DeepPartial<DynamicConfig>;
      merged = mergeDynamicConfig(merged, dynamic);
    }
  } catch {
    /* use defaults */
  }
  return merged;
}
