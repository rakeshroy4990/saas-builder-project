import axios from 'axios';
import {
  isEnvelopeSuccess,
  parseAuthLoginPayload,
  SERVER_PATHS
} from '@saas-builder/hospital-api-client';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';

import { activeMobileLocale } from '@/i18n/locale';
import {
  clearSecureAuth,
  getStoredRefreshToken,
  setStoredRefreshToken,
  setStoredSessionProfile
} from '@/auth/secureTokens';
import { isAccessTokenExpired, useSessionStore } from '@/auth/sessionStore';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from '@/auth/tokenTtl';
import { getMobileApiBaseUrl } from '@/api/config';
import { AUTH_API_TIMEOUT_MS } from '@/api/timeouts';

let refreshInFlight: Promise<boolean> | null = null;
let refreshAbortController: AbortController | null = null;

/** Stops a slow startup refresh so explicit login is not queued behind it. */
export function cancelPendingTokenRefresh(): void {
  refreshAbortController?.abort();
  refreshAbortController = null;
  refreshInFlight = null;
}

const DEFAULT_REFRESH_TIMEOUT_MS = AUTH_API_TIMEOUT_MS;

export async function refreshAccessToken(options?: {
  timeoutMs?: number;
  /** When true, aborts any in-flight refresh and starts a new one. */
  force?: boolean;
}): Promise<boolean> {
  if (refreshInFlight) {
    if (options?.force) {
      cancelPendingTokenRefresh();
    } else {
      return refreshInFlight;
    }
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;
  const controller = new AbortController();
  refreshAbortController = controller;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(
        `${getMobileApiBaseUrl()}${SERVER_PATHS.refresh}`,
        { DeviceId: 'mobile', RefreshToken: refreshToken },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Accept-Language': acceptLanguageHeaderValue(activeMobileLocale())
          },
          timeout: timeoutMs,
          signal: controller.signal
        }
      );

      if (!isEnvelopeSuccess(response.data)) return false;

      const parsed = parseAuthLoginPayload(response.data, '');
      if (!parsed.accessToken) return false;

      const user = useSessionStore.getState().user ?? {
        userId: parsed.userId,
        email: parsed.email,
        displayName: parsed.displayName,
        role: parsed.role
      };
      useSessionStore.getState().setSession({
        accessToken: parsed.accessToken,
        user,
        expiresInSeconds: parsed.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS
      });
      await setStoredSessionProfile(user);

      if (parsed.refreshToken) {
        await setStoredRefreshToken(parsed.refreshToken);
      }
      return true;
    } catch (error) {
      if (axios.isCancel(error)) return false;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) {
        useSessionStore.getState().clearSession();
        await clearSecureAuth();
      }
      return false;
    } finally {
      if (refreshAbortController === controller) {
        refreshAbortController = null;
      }
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Refreshes the access JWT when expired or close to expiry (fetch, STOMP, proactive keeper). */
export async function ensureFreshAccessToken(): Promise<boolean> {
  const hasAccess = Boolean(useSessionStore.getState().accessToken);
  if (!hasAccess) {
    const refresh = await getStoredRefreshToken();
    if (!refresh?.trim()) return false;
  }
  if (!isAccessTokenExpired()) {
    return Boolean(useSessionStore.getState().accessToken);
  }
  return refreshAccessToken();
}
