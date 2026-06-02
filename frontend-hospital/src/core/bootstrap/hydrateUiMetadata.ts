import { applyServerExtensibilityOverrides } from '@saas-builder/extensibility-vue';
import {
  applyServerUiMetadataPackages,
  type UiMetadataResponse
} from './mergeServerUiMetadata';
import { URLRegistry } from '../../services/http/URLRegistry';
import { logClient } from '../../services/logging/clientLogger';
import { hasPersistedAuthSessionProfile } from '../../services/auth/authSessionStore';
import { seedStyleTemplatesFromStatic } from '../extensibility/bootstrapExtensibility';
import { setServerI18nBundles } from '../../i18n/serverI18nBundles';
import { wirePublicHeaderBrandI18nOnAllPages } from './wirePublicHeaderBrandI18n';
import type { Pinia } from 'pinia';

function hasHospitalBrandBundles(bundles: UiMetadataResponse['i18nBundles']): boolean {
  if (!bundles || typeof bundles !== 'object') return false;
  for (const localeMessages of Object.values(bundles)) {
    if (!localeMessages || typeof localeMessages !== 'object') continue;
    if (
      'hospital.brandTitle' in localeMessages ||
      (typeof localeMessages.hospital === 'object' &&
        localeMessages.hospital !== null &&
        'brandTitle' in (localeMessages.hospital as Record<string, unknown>))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Loads page patches plus L1/L2 extensibility from {@code GET /api/uiMetdata}.
 * 204 / network errors keep bundled defaults.
 */
export async function hydrateUiMetadataFromServer(pinia: Pinia): Promise<void> {
  const hasSessionHint = hasPersistedAuthSessionProfile();

  try {
    await logClient('INFO', 'Fetching UI metadata from server');
    const res = await URLRegistry.request('uiMetadata', {
      method: 'GET',
      credentials: hasSessionHint ? 'include' : 'omit',
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

    applyServerExtensibilityOverrides(pinia, body, {
      seedStyleTemplates: seedStyleTemplatesFromStatic
    });

    if (body.i18nBundles && typeof body.i18nBundles === 'object' && Object.keys(body.i18nBundles).length > 0) {
      setServerI18nBundles(body.i18nBundles);
      if (hasHospitalBrandBundles(body.i18nBundles)) {
        wirePublicHeaderBrandI18nOnAllPages();
      }
      await logClient('INFO', 'Applied server i18n bundles from UI metadata', {
        locales: Object.keys(body.i18nBundles)
      });
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      const hasBundles =
        body.i18nBundles && typeof body.i18nBundles === 'object' && Object.keys(body.i18nBundles).length > 0;
      if (!hasBundles) {
        await logClient('WARN', 'UI metadata load returned no packages or i18nBundles');
      }
    }

    const hasStatic =
      body.staticConfig && typeof body.staticConfig === 'object' && Object.keys(body.staticConfig).length > 0;
    const hasDynamic =
      body.dynamicConfig && typeof body.dynamicConfig === 'object' && Object.keys(body.dynamicConfig).length > 0;
    if (hasStatic || hasDynamic) {
      await logClient('INFO', 'Applied extensibility overrides from UI metadata', {
        static: Boolean(hasStatic),
        dynamic: Boolean(hasDynamic)
      });
    }
  } catch {
    await logClient('WARN', 'Unable to fetch UI metadata; using local defaults');
  }
}
