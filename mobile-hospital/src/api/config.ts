import Constants from 'expo-constants';

import { getApiBaseUrl } from '@saas-builder/hospital-api-client';

export function getMobileApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return getApiBaseUrl(fromEnv ?? extra.apiBaseUrl);
}
