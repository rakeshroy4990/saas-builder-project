import {
  DEFAULT_STATIC_CONFIG,
  mergeStaticConfig,
  type DeepPartial,
  type StaticConfig
} from '@saas-builder/extensibility-contract';

export type StaticConfigLoaderOptions = {
  bundledDefaults?: StaticConfig;
  bundledOverride?: DeepPartial<StaticConfig>;
  fetchUrl?: string;
  apiPath?: string;
  resolveApiUrl?: (path: string) => string;
};

/**
 * Load L1 static config: bundled defaults → optional bundled override → remote URL or API.
 */
export async function loadStaticConfig(options: StaticConfigLoaderOptions = {}): Promise<StaticConfig> {
  const base = options.bundledDefaults ?? DEFAULT_STATIC_CONFIG;
  let merged = mergeStaticConfig(base, options.bundledOverride);

  const remoteUrl = String(options.fetchUrl ?? '').trim();
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, { credentials: 'omit' });
      if (res.ok) {
        const json = (await res.json()) as DeepPartial<StaticConfig>;
        merged = mergeStaticConfig(merged, json);
      }
    } catch {
      /* keep bundled */
    }
    return merged;
  }

  const apiPath = options.apiPath?.trim();
  if (apiPath && options.resolveApiUrl) {
    try {
      const res = await fetch(options.resolveApiUrl(apiPath), {
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      });
      if (res.ok && res.status !== 204) {
        const body = await res.json();
        const data = (body?.data ?? body) as DeepPartial<StaticConfig>;
        merged = mergeStaticConfig(merged, data);
      }
    } catch {
      /* keep bundled */
    }
  }

  return merged;
}
