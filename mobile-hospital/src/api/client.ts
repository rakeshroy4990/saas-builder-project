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
import {
  emitLoggedInSessionSummary,
  getOrCreateTraceId,
  ingestSessionTelemetry,
  scheduleFlushSessionTelemetry
} from '@/analytics/sessionTelemetry';
import { shouldSkipTelemetrySessionSummaryForUrl } from '@/analytics/telemetryUrlSkip';
import { isAccessTokenExpired, useSessionStore } from '@/auth/sessionStore';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from '@/auth/tokenTtl';
import { toUserFacingApiError } from '@/api/apiErrors';
import { AUTH_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS } from '@/api/timeouts';

import { applyMultipartHeaders } from './multipart';
import { getMobileApiBaseUrl } from './config';

function rejectWithFriendlyMessage(error: AxiosError): Promise<never> {
  const friendly = toUserFacingApiError(error, error.message);
  if (friendly !== error.message) {
    error.message = friendly;
  }
  return Promise.reject(error);
}

type TelemetryAxiosConfig = InternalAxiosRequestConfig & { __telemetryT0?: number };

let refreshInFlight: Promise<boolean> | null = null;
let refreshAbortController: AbortController | null = null;

/** Stops a slow startup refresh so explicit login is not queued behind it. */
export function cancelPendingTokenRefresh(): void {
  refreshAbortController?.abort();
  refreshAbortController = null;
  refreshInFlight = null;
}

export const apiClient = axios.create({
  baseURL: getMobileApiBaseUrl(),
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
  return config;
}

function resolveApiPath(config: InternalAxiosRequestConfig): string {
  const base = String(config.baseURL ?? getMobileApiBaseUrl()).replace(/\/$/, '');
  const url = String(config.url ?? '');
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
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
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
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
