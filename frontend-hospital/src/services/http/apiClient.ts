import axios from 'axios';
import * as Sentry from '@sentry/vue';
import type { Router } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { getApiBaseUrl } from './URLRegistry';
import { URLRegistry } from './URLRegistry';
import { getOrCreateTraceId } from '../logging/traceContext';
import { logClient } from '../logging/clientLogger';
import {
  applyAccessExpiryHintFromAuthPayload,
  clearAuthToken,
  isAuthTokenExpired,
  subscribeAuthToken
} from '../auth/authToken';
import { clearPersistedAuthSessionProfile } from '../auth/authSessionStore';
import { useAppStore } from '../../store/useAppStore';
import { ingestSessionTelemetry } from '../analytics/sessionTelemetry';
import { emitLoggedInSessionSummary, SessionSummaryKind } from '../analytics/sessionSummary';

let appRouter: Router | null = null;

export const bindHttpRouter = (router: Router) => {
  appRouter = router;
};

type FlexshellTelemetryConfig = { __flexshellTelemetryT0?: number };

function axiosResolvedUrl(config: { baseURL?: string; url?: string }): string {
  const u = String(config.url ?? '');
  if (u.startsWith('http')) return u;
  const b = String(config.baseURL ?? '').replace(/\/$/, '');
  return `${b}${u.startsWith('/') ? '' : '/'}${u}`;
}

function shouldSkipSessionSummaryForAxios(config: { baseURL?: string; url?: string }): boolean {
  return axiosResolvedUrl(config).includes('/api/telemetry/session-event');
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

let refreshInFlight: Promise<boolean> | null = null;
/** Proactively refresh this long before access JWT `exp` so long consultations are not interrupted. */
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Refresh session cookies ~2 minutes before approximate access expiry (httpOnly tokens). */
const PROACTIVE_REFRESH_BEFORE_EXPIRY_MS = 120_000;
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
  appStore.setProperty('hospital', 'AuthSession', 'qualifications', '');
  appStore.setProperty('hospital', 'AuthSession', 'smcName', '');
  appStore.setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', '');
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

function emitSessionExpiredTelemetryOnce(httpStatus?: number): void {
  const traceId = getOrCreateTraceId();
  const dedupeKey = `flexshell-auth-expired-telemetry:${traceId}`;
  try {
    if (sessionStorage.getItem(dedupeKey) === '1') return;
    sessionStorage.setItem(dedupeKey, '1');
  } catch {
    // continue without dedupe if storage unavailable
  }
  void ingestSessionTelemetry({
    event_name: 'auth_session_expired',
    flow: 'auth',
    status: 'fail',
    reason_code: 'session_expired',
    http_status: httpStatus,
    trace_id: traceId
  });
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

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await apiClient.post(URLRegistry.paths.refresh, { DeviceId: 'browser' });
      const root = response.data as Record<string, unknown> | undefined;
      const dataNode = (root?.data ?? root?.Data ?? root ?? {}) as Record<string, unknown>;
      applyAccessExpiryHintFromAuthPayload(dataNode);
      applyAccessExpiryHintFromAuthPayload(root);
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isRefreshRequestUrl(url: string): boolean {
  return url.includes(URLRegistry.paths.refresh);
}

subscribeAuthToken(({ expiresAtMs }) => {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  if (!expiresAtMs) return;

  const now = Date.now();
  const delayMs = Math.max(0, expiresAtMs - now - PROACTIVE_REFRESH_BEFORE_EXPIRY_MS);
  proactiveRefreshTimer = setTimeout(() => {
    void refreshAccessToken();
  }, delayMs);
});

function setHeader(headers: unknown, key: string, value: string): void {
  if (headers && typeof headers === 'object' && 'set' in headers && typeof (headers as { set: unknown }).set === 'function') {
    (headers as { set: (k: string, v: string) => void }).set(key, value);
    return;
  }
  (headers as Record<string, string>)[key] = value;
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

apiClient.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  setHeader(config.headers, 'X-Trace-Id', getOrCreateTraceId());
  const requestUrl = String(config.url ?? '');
  const isRefresh = isRefreshRequestUrl(requestUrl);
  if (isRefresh) {
    deleteHeader(config.headers, 'Authorization');
  }

  const isMultipartUpload = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isMultipartUpload) {
    // Let the browser set multipart boundary automatically.
    deleteHeader(config.headers, 'Content-Type');
    // Upload requests may take longer than default API calls.
    config.timeout = Math.max(config.timeout ?? 0, 120000);
  }

  // Access + refresh tokens are httpOnly cookies — no Authorization header. Refresh cookies when our TTL hint says we're close.
  if (!isRefresh && isAuthTokenExpired()) {
    await refreshAccessToken();
  }
  if (!shouldSkipSessionSummaryForAxios(config)) {
    (config as FlexshellTelemetryConfig).__flexshellTelemetryT0 = performance.now();
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (!shouldSkipSessionSummaryForAxios(response.config)) {
      const cfg = response.config as FlexshellTelemetryConfig;
      const t0 = cfg.__flexshellTelemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(performance.now() - t0) : undefined;
      emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_CALL,
        api_path: axiosResolvedUrl(response.config),
        http_method: String(response.config.method ?? 'get').toUpperCase(),
        http_status: response.status,
        duration_ms: durationMs
      });
    }
    const authPayload = readUnauthorizedPayload(response.data);
    if (authPayload.isUnauthorized) {
      emitSessionExpiredTelemetryOnce(401);
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
    if (error.config && !shouldSkipSessionSummaryForAxios(error.config)) {
      const cfg = error.config as FlexshellTelemetryConfig;
      const t0 = cfg.__flexshellTelemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(performance.now() - t0) : undefined;
      const data = error.response?.data as { Message?: string; message?: string } | undefined;
      const errMsg =
        (data?.Message ?? data?.message ?? (error instanceof Error ? error.message : String(error))).toString();
      emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_ERROR,
        api_path: axiosResolvedUrl(error.config),
        http_method: String(error.config.method ?? 'get').toUpperCase(),
        http_status: error.response?.status,
        duration_ms: durationMs,
        error_message: errMsg.slice(0, 2000)
      });
    }
    const popupStore = usePopupStore(pinia);
    const toastStore = useToastStore(pinia);
    const requestUrl = String(error.config?.url ?? '');
    const isLoginRequest =
      requestUrl.includes(URLRegistry.paths.login) || requestUrl.includes(URLRegistry.paths.googleLogin);
    const isLogoutRequest = requestUrl.includes(URLRegistry.paths.logout);
    const isRefreshRequest = requestUrl.includes(URLRegistry.paths.refresh);
    const isDoctorDirectoryRequest = requestUrl.includes(URLRegistry.paths.doctorGet);
    const isSmartAiRequest = requestUrl.includes(URLRegistry.paths.hospitalAiChat);
    const isMultipartUpload = typeof FormData !== 'undefined' && error.config?.data instanceof FormData;
    const authPayload = readUnauthorizedPayload(error.response?.data);
    const status = error.response?.status as number | undefined;

    if (authPayload.isUnauthorized) {
      emitSessionExpiredTelemetryOnce(error.response?.status);
      performLocalLogoutAndRedirect(authPayload.message);
      return Promise.reject(error);
    }

    // Sentry: capture handled transport/server failures (exclude expected auth failures).
    if (!isLoginRequest && !isLogoutRequest && !isRefreshRequest) {
      if (!status || status >= 500) {
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
          tags: { area: 'http', kind: 'api_client' },
          extra: {
            url: requestUrl,
            method: String(error.config?.method ?? 'get').toUpperCase(),
            status: status ?? null
          }
        });
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      if (
        isLoginRequest ||
        isLogoutRequest ||
        isRefreshRequest ||
        isDoctorDirectoryRequest ||
        isMultipartUpload ||
        isSmartAiRequest
      ) {
        if (isSmartAiRequest) {
          toastStore.show('Health Assistant is temporarily unavailable. Please try again shortly.', 'error');
        }
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
        emitSessionExpiredTelemetryOnce(401);
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
      if (isSmartAiRequest) {
        toastStore.show('Health Assistant is temporarily unavailable. Please try again shortly.', 'error');
        return Promise.reject(error);
      }
      popupStore.openError(new Error('Server error. Please try again later.'));
    } else {
      const data = error.response?.data as { Message?: string; message?: string } | undefined;
      const message = data?.Message ?? data?.message ?? error.message;
      toastStore.show(String(message), 'error');
    }

    return Promise.reject(error);
  }
);
