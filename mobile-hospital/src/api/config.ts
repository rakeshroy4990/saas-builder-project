import Constants from 'expo-constants';

import { getApiBaseUrl } from '@saas-builder/hospital-api-client';

import { DEV_API_BASE_URL_FALLBACK, getConfiguredApiBaseUrl } from '@/config/apiUrl';

/**
 * Normalized Spring API base URL for the current build/environment.
 * Production URLs must come from EAS env / `.env` — never hardcoded here.
 * Never throws — a missing URL must not crash the app during module init or interceptors.
 */
export function getMobileApiBaseUrl(): string {
  const configured = getConfiguredApiBaseUrl();
  if (configured) {
    return getApiBaseUrl(configured);
  }

  const manifestExtra = (Constants.manifest as { extra?: Record<string, string> } | null)?.extra;
  const manifestUrl = manifestExtra?.apiBaseUrl ?? manifestExtra?.apiBaseURL;
  if (manifestUrl?.trim()) {
    return getApiBaseUrl(manifestUrl);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return getApiBaseUrl(DEV_API_BASE_URL_FALLBACK);
  }

  return getApiBaseUrl(DEV_API_BASE_URL_FALLBACK);
}
