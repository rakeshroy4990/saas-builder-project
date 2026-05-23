import Constants from 'expo-constants';

import { getApiBaseUrl } from '@saas-builder/hospital-api-client';

import { pickConfigValue } from '@/config/env';

const DEFAULT_API_BASE_URL = 'https://backend-hospital-yspwmymsgq-el.a.run.app';

export function getMobileApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const resolved = pickConfigValue(process.env.EXPO_PUBLIC_API_BASE_URL, extra.apiBaseUrl);
  return getApiBaseUrl(resolved ?? DEFAULT_API_BASE_URL);
}
