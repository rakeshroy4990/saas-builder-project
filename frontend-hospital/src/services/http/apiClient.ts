import axios from 'axios';
import type { Router } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { getApiBaseUrl } from './URLRegistry';
import { URLRegistry } from './URLRegistry';
import { getOrCreateTraceId } from '../logging/traceContext';
import { logClient } from '../logging/clientLogger';
import { clearAuthToken } from '../auth/authToken';
import { getAuthToken } from '../auth/authToken';
import { setAuthTokens } from '../auth/authToken';
import { isAuthTokenExpired, subscribeAuthToken } from '../auth/authToken';
import { clearPersistedAuthSessionProfile, syncHospitalUserIdFromAccessToken } from '../auth/authSessionStore';
import { useAppStore } from '../../store/useAppStore';

let appRouter: Router | null = null;

export const bindHttpRouter = (router: Router) => {
  appRouter = router;
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

let refreshInFlight: Promise<boolean> | null = null;
let tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;
const AUTH_UNAUTHORIZED_CODE = 'AUTH_UNAUTHORIZED';
const DEFAULT_AUTH_UNAUTHORIZED_MESSAGE = 'Invalid or expired token, Please login again.';
const PLEASE_LOGIN_MESSAGE = 'You are not logged in. Please login.';

/** Map legacy or technical API messages to a single friendly prompt. */
function normalizeAuthUserMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;
  if (/missing\s*bearer\s*token/i.test(t)) return PLEASE_LOGIN_MESSAGE;
  return t;
}

function clearAuthSessionUi(): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthSession', 'userId', '');
  appStore.setProperty('hospital', 'AuthSession', 'userDisplayName', '');
  appStore.setProperty('hospital', 'AuthSession', 'email', '');
  appStore.setProperty('hospital', 'AuthSession', 'mobileNumber', '');
  appStore.setProperty('hospital', 'AuthSession', 'address', '');
  appStore.setProperty('hospital', 'AuthSession', 'gender', '');
  appStore.setProperty('hospital', 'AuthSession', 'department', '');
  appStore.setProperty('hospital', 'AuthSession', 'fullName', '');
  appStore.setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
  clearPersistedAuthSessionProfile();
}

function navigateToLogin(): void {
  const popupStore = usePopupStore(pinia);
  // Open a popup instead of navigating to a dedicated route.
  // We never want to redirect users to `/page/hospital/login-popup`.
  popupStore.open({ packageName: 'hospital', pageId: 'login-popup', title: 'Login' });
}

function setLoginErrorMessage(message: string): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthForm', 'identity', '');
  appStore.setProperty('hospital', 'AuthForm', 'password', '');
  appStore.setProperty('hospital', 'AuthForm', 'emailError', '');
  appStore.setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
  appStore.setProperty('hospital', 'AuthForm', 'authError', message);
}

function performLocalLogoutAndRedirect(message = DEFAULT_AUTH_UNAUTHORIZED_MESSAGE): void {
  clearAuthToken();
  clearAuthSessionUi();
  setLoginErrorMessage(message);
  navigateToLogin();
}

function readUnauthorizedPayload(payload: unknown): { isUnauthorized: boolean; message: string } {
  const row = (payload ?? {}) as Record<string, unknown>;
  const code = String(row.code ?? row.Code ?? '').trim().toUpperCase();
  const rawMessage = normalizeAuthUserMessage(String(row.message ?? row.Message ?? '').trim());
  const message = rawMessage || DEFAULT_AUTH_UNAUTHORIZED_MESSAGE;
  const normalized = rawMessage.toLowerCase();
  const isTokenExpiryMessage =
    normalized === DEFAULT_AUTH_UNAUTHORIZED_MESSAGE.toLowerCase() ||
    normalized.includes('invalid or expired token');
  return { isUnauthorized: code === AUTH_UNAUTHORIZED_CODE && isTokenExpiryMessage, message };
}

subscribeAuthToken(({ accessToken, expiresAtMs }) => {
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
  if (!accessToken) return;
  if (!expiresAtMs) return;

  const now = Date.now();
  const delayMs = Math.max(0, expiresAtMs - now + 250);
  tokenExpiryTimer = setTimeout(() => {
    if (isAuthTokenExpired()) {
      performLocalLogoutAndRedirect();
    }
  }, delayMs);
});

function setHeader(headers: unknown, key: string, value: string): void {
  if (headers && typeof headers === 'object' && 'set' in headers && typeof (headers as { set: unknown }).set === 'function') {
    (headers as { set: (k: string, v: string) => void }).set(key, value);
    return;
  }
  (headers as Record<string, string>)[key] = value;
}

function getHeader(headers: unknown, key: string): string | undefined {
  if (headers && typeof headers === 'object' && 'get' in headers && typeof (headers as { get: unknown }).get === 'function') {
    const value = (headers as { get: (k: string) => string | null }).get(key);
    return value == null ? undefined : String(value);
  }
  const record = headers as Record<string, unknown>;
  const value = record?.[key] ?? record?.[key.toLowerCase()] ?? record?.[key.toUpperCase()];
  return value == null ? undefined : String(value);
}

function deleteHeader(headers: unknown, key: string): void {
  if (headers && typeof headers === 'object' && 'delete' in headers && typeof (headers as { delete: unknown }).delete === 'function') {
    (headers as { delete: (k: string) => void }).delete(key);
    return;
  }
  const record = headers as Record<string, unknown>;
  delete record[key];
  delete record[key.toLowerCase()];
  delete record[key.toUpperCase()];
}

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  setHeader(config.headers, 'X-Trace-Id', getOrCreateTraceId());
  const isMultipartUpload = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isMultipartUpload) {
    // Let the browser set multipart boundary automatically.
    deleteHeader(config.headers, 'Content-Type');
    // Upload requests may take longer than default API calls.
    config.timeout = Math.max(config.timeout ?? 0, 120000);
  }
  const accessToken = getAuthToken();
  if (accessToken && isAuthTokenExpired()) {
    performLocalLogoutAndRedirect();
    return Promise.reject(new Error('Session expired. Please log in again.'));
  }
  if (accessToken && !getHeader(config.headers, 'Authorization')) {
    setHeader(config.headers, 'Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const authPayload = readUnauthorizedPayload(response.data);
    if (authPayload.isUnauthorized) {
      performLocalLogoutAndRedirect(authPayload.message);
      return Promise.reject(new Error(authPayload.message));
    }
    return response;
  },
  async (error) => {
    void logClient('ERROR', 'HTTP request failed', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });
    const popupStore = usePopupStore(pinia);
    const toastStore = useToastStore(pinia);
    const requestUrl = String(error.config?.url ?? '');
    const isLoginRequest = requestUrl.includes(URLRegistry.paths.login);
    const isRefreshRequest = requestUrl.includes(URLRegistry.paths.refresh);
    const isDoctorDirectoryRequest = requestUrl.includes(URLRegistry.paths.doctorGet);
    const isMultipartUpload = typeof FormData !== 'undefined' && error.config?.data instanceof FormData;
    const authPayload = readUnauthorizedPayload(error.response?.data);

    if (authPayload.isUnauthorized) {
      performLocalLogoutAndRedirect(authPayload.message);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      if (isLoginRequest || isRefreshRequest || isDoctorDirectoryRequest || isMultipartUpload) {
        return Promise.reject(error);
      }
      const originalRequest = error.config ?? {};
      const wasRetried = Boolean((originalRequest as { _retried?: boolean })._retried);
      if (!wasRetried) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          (originalRequest as { _retried?: boolean })._retried = true;
          return apiClient.request(originalRequest);
        }
      }
      if (error.response?.status === 401) {
        const message =
          normalizeAuthUserMessage(
            String(error.response?.data?.message ?? error.response?.data?.Message ?? '').trim()
          ) || DEFAULT_AUTH_UNAUTHORIZED_MESSAGE;
        popupStore.openError(new Error(message));
        performLocalLogoutAndRedirect(message);
      } else {
        popupStore.openError(new Error('You do not have permission to perform this action.'));
      }
    } else if (error.response?.status >= 500) {
      popupStore.openError(new Error('Server error. Please try again later.'));
    } else {
      const message = error.response?.data?.message ?? error.message;
      toastStore.show(message, 'error');
    }

    return Promise.reject(error);
  }
);

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await apiClient.post(URLRegistry.paths.refresh, { DeviceId: 'browser' });
      const dataNode = (response.data?.data ?? response.data?.Data ?? response.data ?? {}) as Record<string, unknown>;
      const accessToken = String(dataNode.accessToken ?? dataNode.AccessToken ?? '').trim();
      const refreshToken = String(dataNode.refreshToken ?? dataNode.RefreshToken ?? '').trim();
      if (accessToken && refreshToken) {
        setAuthTokens(accessToken, refreshToken);
        syncHospitalUserIdFromAccessToken();
      }
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
