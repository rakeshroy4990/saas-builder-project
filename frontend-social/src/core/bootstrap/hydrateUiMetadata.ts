import { applyServerExtensibilityOverrides } from '@saas-builder/extensibility-vue';
import {
  applyServerUiMetadataPackages,
  type UiMetadataResponse
} from './mergeServerUiMetadata';
import { URLRegistry } from '../../services/http/URLRegistry';
import { logClient } from '../../services/logging/clientLogger';
import type { Pinia } from 'pinia';

/**
 * Loads page patches plus L1/L2 extensibility from {@code GET /api/uiMetdata}.
 */
export async function hydrateUiMetadataFromServer(pinia: Pinia): Promise<void> {
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
    if (Array.isArray(packages) && packages.length > 0) {
      applyServerUiMetadataPackages(packages);
      await logClient('INFO', 'Applied UI metadata package overrides', { packages: packages.length });
    }

    applyServerExtensibilityOverrides(pinia, body);
  } catch {
    await logClient('WARN', 'Unable to fetch UI metadata; using local defaults');
  }
}
