import {
  applyServerUiMetadataPackages,
  type UiMetadataResponse
} from './mergeServerUiMetadata';
import { URLRegistry } from '../../services/http/URLRegistry';
import { logClient } from '../../services/logging/clientLogger';

/**
 * Fetches optional UI overrides from the backend. 204 / empty packages / network errors are ignored
 * so bundled page configs continue to work unchanged.
 */
export async function hydrateUiMetadataFromServer(): Promise<void> {
  try {
    await logClient('INFO', 'Fetching UI metadata from server');
    const res = await URLRegistry.request('uiMetadata', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (res.status === 204) return;
    if (!res.ok) return;

    const text = await res.text();
    if (!text?.trim()) return;

    const body = JSON.parse(text) as UiMetadataResponse;
    const packages = body.packages;
    if (!Array.isArray(packages) || packages.length === 0) return;

    applyServerUiMetadataPackages(packages);
    await logClient('INFO', 'Applied UI metadata package overrides', { packages: packages.length });
  } catch {
    await logClient('WARN', 'Unable to fetch UI metadata; using local defaults');
    /* offline or invalid JSON — keep local UI */
  }
}
