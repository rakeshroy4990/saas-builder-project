import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  getApiBaseUrl,
  isEnvelopeSuccess,
  parseAuthLoginPayload,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';

import {
  clearSecureAuth,
  getStoredRefreshToken,
  setStoredRefreshToken,
  setStoredSessionProfile
} from '@/auth/secureTokens';
import { isAccessTokenExpired, useSessionStore } from '@/auth/sessionStore';
import { getMobileApiBaseUrl } from './config';

let refreshInFlight: Promise<boolean> | null = null;

export const apiClient = axios.create({
  baseURL: getMobileApiBaseUrl(),
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

function attachBearer(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = useSessionStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(
        `${getMobileApiBaseUrl()}${SERVER_PATHS.refresh}`,
        { DeviceId: 'mobile', RefreshToken: refreshToken },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 30_000 }
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
        expiresInSeconds: parsed.expiresInSeconds
      });
      await setStoredSessionProfile(user);

      if (parsed.refreshToken) {
        await setStoredRefreshToken(parsed.refreshToken);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

apiClient.interceptors.request.use(async (config) => {
  const url = String(config.url ?? '');
  const isRefresh = url.includes(SERVER_PATHS.refresh);
  if (!isRefresh && isAccessTokenExpired()) {
    await refreshAccessToken();
  }
  if (!isRefresh) {
    return attachBearer(config);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original || original._retry) {
      return Promise.reject(error);
    }
    const status = error.response?.status;
    const url = String(original.url ?? '');
    if (status === 401 && !url.includes(SERVER_PATHS.refresh) && !url.includes(SERVER_PATHS.login)) {
      original._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient(attachBearer(original));
      }
      useSessionStore.getState().clearSession();
      await clearSecureAuth();
    }
    return Promise.reject(error);
  }
);

export { unwrapEnvelope, getApiBaseUrl };
