import { getApiBaseUrl } from '@saas-builder/hospital-api-client';

import { DEV_API_BASE_URL_FALLBACK, getConfiguredApiBaseUrl } from '@/config/apiUrl';

/**
 * Normalized Spring API base URL for the current build/environment.
 * Production URLs must come from EAS env / `.env` — never hardcoded here.
 */
export function getMobileApiBaseUrl(): string {
  const configured = getConfiguredApiBaseUrl();
  if (configured) {
    return getApiBaseUrl(configured);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return getApiBaseUrl(DEV_API_BASE_URL_FALLBACK);
  }

  throw new Error(
    'API base URL is not configured. Set EXPO_PUBLIC_API_URL in eas.json or your .env file.'
  );
}
