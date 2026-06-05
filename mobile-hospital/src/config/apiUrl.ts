import Constants from 'expo-constants';

import { pickConfigValue } from '@/config/env';

/** Local dev fallback when no env is set — never a production URL. */
export const DEV_API_BASE_URL_FALLBACK = 'http://localhost:8080';

/**
 * Resolves API base URL from Expo public env or `extra.apiBaseUrl` (set in app.config.js).
 * Supports `EXPO_PUBLIC_API_URL` (preferred) and legacy `EXPO_PUBLIC_API_BASE_URL`.
 */
export function getConfiguredApiBaseUrl(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return pickConfigValue(
    process.env.EXPO_PUBLIC_API_URL,
    process.env.EXPO_PUBLIC_API_BASE_URL,
    extra.apiBaseUrl,
    extra.apiBaseURL
  );
}
