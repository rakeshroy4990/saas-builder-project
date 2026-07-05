import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  getApiBaseUrl,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';
import { activeMobileLocale } from '@/i18n/locale';

import {
  clearSecureAuth
} from '@/auth/secureTokens';
import {
  emitLoggedInSessionSummary,
  getOrCreateTraceId,
  ingestSessionTelemetry,
  scheduleFlushSessionTelemetry
} from '@/analytics/sessionTelemetry';
import { shouldSkipTelemetrySessionSummaryForUrl } from '@/analytics/telemetryUrlSkip';
import { useSessionStore } from '@/auth/sessionStore';
import { toUserFacingApiError } from '@/api/apiErrors';
import { DEFAULT_API_TIMEOUT_MS, GROWTH_SUMMARY_TIMEOUT_MS } from '@/api/timeouts';
import {
  cancelPendingTokenRefresh,
  ensureFreshAccessToken,
  refreshAccessToken
} from '@/api/tokenRefresh';

import { applyMultipartHeaders } from './multipart';
import { getMobileApiBaseUrl } from './config';

export {
  cancelPendingTokenRefresh,
  ensureFreshAccessToken,
  refreshAccessToken
} from '@/api/tokenRefresh';

function rejectWithFriendlyMessage(error: AxiosError): Promise<never> {
  const friendly = toUserFacingApiError(error, error.message);
  if (friendly !== error.message) {
    error.message = friendly;
  }
  return Promise.reject(error);
}

type TelemetryAxiosConfig = InternalAxiosRequestConfig & { __telemetryT0?: number };

export const apiClient = axios.create({
  timeout: DEFAULT_API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

function attachBearer(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = useSessionStore.getState().accessToken;
  config.headers = config.headers ?? {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const trace = getOrCreateTraceId();
  if (!config.headers['X-Trace-Id']) {
    config.headers['X-Trace-Id'] = trace;
  }
  if (!config.headers['Accept-Language']) {
    config.headers['Accept-Language'] = acceptLanguageHeaderValue(activeMobileLocale());
  }
  return config;
}

function resolveApiPath(config: InternalAxiosRequestConfig): string {
  const base = String(config.baseURL ?? getMobileApiBaseUrl()).replace(/\/$/, '');
  const url = String(config.url ?? '');
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Runs `fetch` with Bearer auth; on 401, silently refreshes once and retries. */
export async function fetchWithAuthRetry(buildRequest: () => Promise<Response>): Promise<Response> {
  await ensureFreshAccessToken();

  let res = await buildRequest();
  if (res.status !== 401) {
    return res;
  }

  const refreshed = await refreshAccessToken();
  if (refreshed) {
    return buildRequest();
  }

  useSessionStore.getState().clearSession();
  await clearSecureAuth();
  return res;
}

apiClient.interceptors.request.use(async (config) => {
  if (!config.baseURL) {
    config.baseURL = getMobileApiBaseUrl();
  }
  applyMultipartHeaders(config);
  const url = String(config.url ?? '');
  const isRefresh = url.includes(SERVER_PATHS.refresh);
  const isExplicitLogin = url.includes(SERVER_PATHS.login) || url.includes(SERVER_PATHS.googleLogin);
  if (isExplicitLogin) {
    cancelPendingTokenRefresh();
    useSessionStore.getState().setSessionRestoreInFlight(false);
    return attachBearer(config);
  }
  if (!isRefresh) {
    await ensureFreshAccessToken();
  }
  const resolved = resolveApiPath(config);
  if (resolved.includes('/growth-records/history-summary')) {
    config.timeout = Math.max(config.timeout ?? 0, GROWTH_SUMMARY_TIMEOUT_MS);
  }
  if (!shouldSkipTelemetrySessionSummaryForUrl(resolved)) {
    (config as TelemetryAxiosConfig).__telemetryT0 = Date.now();
  }
  if (!isRefresh) {
    return attachBearer(config);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const resolved = resolveApiPath(response.config);
    if (!shouldSkipTelemetrySessionSummaryForUrl(resolved)) {
      const t0 = (response.config as TelemetryAxiosConfig).__telemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(Date.now() - t0) : undefined;
      void emitLoggedInSessionSummary({
        kind: 'api_call',
        api_path: resolved,
        http_method: String(response.config.method ?? 'get').toUpperCase(),
        http_status: response.status,
        duration_ms: durationMs
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original || original._retry) {
      return rejectWithFriendlyMessage(error);
    }
    const status = error.response?.status;
    const url = String(original.url ?? '');
    const resolved = resolveApiPath(original);
    if (!shouldSkipTelemetrySessionSummaryForUrl(resolved)) {
      const t0 = (original as TelemetryAxiosConfig).__telemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(Date.now() - t0) : undefined;
      const data = error.response?.data as { Message?: string; message?: string } | undefined;
      const errMsg = String(data?.Message ?? data?.message ?? error.message ?? 'Request failed').slice(
        0,
        500
      );
      void emitLoggedInSessionSummary({
        kind: 'api_error',
        api_path: resolved,
        http_method: String(original.method ?? 'get').toUpperCase(),
        http_status: status,
        duration_ms: durationMs,
        error_message: errMsg
      });
      if (status === 401) {
        void ingestSessionTelemetry({
          event_name: 'auth_session_expired',
          flow: 'auth',
          status: 'fail',
          reason_code: 'session_expired',
          http_status: 401,
          trace_id: getOrCreateTraceId()
        });
        scheduleFlushSessionTelemetry();
      }
    }
    if (status === 401 && !url.includes(SERVER_PATHS.refresh) && !url.includes(SERVER_PATHS.login)) {
      original._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient(attachBearer(original));
      }
      useSessionStore.getState().clearSession();
      await clearSecureAuth();
    }
    return rejectWithFriendlyMessage(error);
  }
);

export { unwrapEnvelope, getApiBaseUrl };
