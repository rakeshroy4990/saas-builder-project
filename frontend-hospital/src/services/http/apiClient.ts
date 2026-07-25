import axios, { type AxiosRequestConfig } from 'axios';
import * as Sentry from '@sentry/vue';
import type { Router } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { getApiBaseUrl } from './URLRegistry';
import { URLRegistry } from './URLRegistry';
import { shouldSkipTelemetrySessionSummaryForApiUrl } from './telemetryUrlSkip';
import { getOrCreateTraceId } from '../logging/traceContext';
import { logClient } from '../logging/clientLogger';
import { openHospitalLoginPopup } from '../auth/hospitalLoginGate';
import {
  applyAccessExpiryHintFromAuthPayload,
  clearAuthToken,
  isAuthTokenExpired,
  subscribeAuthToken
} from '../auth/authToken';
import { getEphemeralRefreshToken, setEphemeralRefreshToken } from '../auth/refreshTokenEphemeral';
import { clearHospitalAuthSessionLocally } from '../auth/authSessionStore';
import { useAppStore } from '../../store/useAppStore';
import { flushSessionTelemetryQueue, ingestSessionTelemetry } from '../analytics/sessionTelemetry';
import { emitLoggedInSessionSummary, SessionSummaryKind } from '../analytics/sessionSummary';
import { stashPendingHttpReplay } from '../domain/hospital/auth/postLoginHttpReplay';
import { localizeTimeoutErrorMessageIfNeeded } from './httpUserFacingErrors';
import { recordPerf } from '@/composables/usePerf';
import { i18n } from '../../i18n';
import { toHospitalAiChatWireBody } from '@saas-builder/hospital-api-client';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';

const tr = (key: string): string => String((i18n.global as { t: (k: string) => string }).t(key));

const VITE_PERF_ENABLED = import.meta.env.VITE_PERF_ENABLED === 'true';

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

function shouldSkipSessionSummaryForAxios(
  config: { baseURL?: string; url?: string },
  kind: 'api_call' | 'api_error' = 'api_call'
): boolean {
  return shouldSkipTelemetrySessionSummaryForApiUrl(axiosResolvedUrl(config), kind);
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

function resolvePayloadMessage(payload: unknown): string {
  const row = (payload ?? {}) as Record<string, unknown>;
  return normalizeAuthUserMessage(String(row.message ?? row.Message ?? '').trim());
}

/** Matches explicit please-login copy and close variants from APIs. */
function isPleaseLoginUserMessage(message: string): boolean {
  const normalized = normalizeAuthUserMessage(message.trim());
  const n = normalized.toLowerCase();
  return (
    n === PLEASE_LOGIN_MESSAGE.toLowerCase() ||
    (n.includes('not logged') && n.includes('login'))
  );
}

function clearAuthSessionUi(): void {
  clearHospitalAuthSessionLocally();
}

function navigateToLogin(): void {
  // Open a popup instead of navigating to a dedicated route.
  // We never want to redirect users to `/page/hospital/login-popup`.
  openHospitalLoginPopup();
}

function setLoginErrorMessage(message: string): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthForm', 'identity', '');
  appStore.setProperty('hospital', 'AuthForm', 'password', '');
  appStore.setProperty('hospital', 'AuthForm', 'emailError', '');
  appStore.setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
  appStore.setProperty('hospital', 'AuthForm', 'authError', message);
}

function performLocalLogoutAndRedirect(
  message = DEFAULT_AUTH_UNAUTHORIZED_MESSAGE,
  axiosConfig?: AxiosRequestConfig
): void {
  stashPendingHttpReplay(axiosConfig);
  clearAuthToken();
  clearAuthSessionUi();
  setLoginErrorMessage(message);
  navigateToLogin();
}

/**
 * When a native {@code fetch} hits HTTP 401 (after any refresh retry), match axios behaviour:
 * telemetry + clear session + login popup.
 */
export function triggerHospitalReLoginFromFetch(message?: string): void {
  const raw = String(message ?? '').trim();
  const msg = normalizeAuthUserMessage(raw) || PLEASE_LOGIN_MESSAGE;
  void emitSessionExpiredTelemetryAndFlush(401).finally(() => performLocalLogoutAndRedirect(msg, undefined));
}

async function emitSessionExpiredTelemetryAndFlush(httpStatus?: number): Promise<void> {
  const traceId = getOrCreateTraceId();
  const dedupeKey = `flexshell-auth-expired-telemetry:${traceId}`;
  try {
    if (sessionStorage.getItem(dedupeKey) === '1') {
      await flushSessionTelemetryQueue();
      return;
    }
    sessionStorage.setItem(dedupeKey, '1');
  } catch {
    // continue without dedupe if storage unavailable
  }
  await ingestSessionTelemetry({
    event_name: 'auth_session_expired',
    flow: 'auth',
    status: 'fail',
    reason_code: 'session_expired',
    http_status: httpStatus,
    trace_id: traceId
  });
  await flushSessionTelemetryQueue();
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
      const body: Record<string, string> = { DeviceId: 'browser' };
      const rt = getEphemeralRefreshToken();
      if (rt) {
        body.RefreshToken = rt;
      }
      const response = await apiClient.post(URLRegistry.paths.refresh, body);
      const root = response.data as Record<string, unknown> | undefined;
      const dataNode = (root?.data ?? root?.Data ?? root ?? {}) as Record<string, unknown>;
      applyAccessExpiryHintFromAuthPayload(dataNode);
      applyAccessExpiryHintFromAuthPayload(root);
      const newRt = String(dataNode.refreshToken ?? dataNode.RefreshToken ?? '').trim();
      if (newRt) {
        setEphemeralRefreshToken(newRt);
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

/**
 * Matches axios request interceptor behavior for cookie-only auth: refresh access cookies when the
 * TTL hint says the access JWT is expired or close to it. Call before native {@code fetch} to
 * hospital APIs (fetch does not run axios interceptors).
 */
export async function ensureAccessTokenFreshForFetch(): Promise<void> {
  if (isAuthTokenExpired()) {
    await refreshAccessToken();
  }
}

/**
 * Attempt a refresh even when the TTL hint is not stale (e.g. after HTTP 401 on fetch).
 */
export async function refreshHospitalAccessCookies(): Promise<boolean> {
  return refreshAccessToken();
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

function resolveAcceptLanguageHeader(): string {
  const globalLocale = i18n.global.locale as unknown;
  const code =
    typeof globalLocale === 'string'
      ? globalLocale
      : (globalLocale as { value?: string })?.value ?? 'en';
  return acceptLanguageHeaderValue(code);
}

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
  setHeader(config.headers, 'Accept-Language', resolveAcceptLanguageHeader());
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

  const isHospitalAiChat = requestUrl.includes(URLRegistry.paths.hospitalAiChat);
  if (isHospitalAiChat) {
    // RAG + large embeddings can exceed the default 15s client timeout.
    config.timeout = Math.max(config.timeout ?? 0, 180000);
    if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
      config.data = toHospitalAiChatWireBody(config.data as Record<string, unknown>);
    }
  }

  const isTriageAnalyze =
    requestUrl.includes(URLRegistry.paths.triageResultsAnalyze) ||
    requestUrl.includes(URLRegistry.paths.triageResultsAnalyzeStream);
  if (isTriageAnalyze) {
    config.timeout = Math.max(config.timeout ?? 0, 180000);
  }

    const isEducationPrescriptionTranscribe = requestUrl.includes(
    URLRegistry.paths.hospitalEducationPrescriptionTranscribe
  );
  if (isEducationPrescriptionTranscribe) {
    // Vision OCR + model can exceed ~15s; keep parity with multipart max and AI chat ceiling.
    config.timeout = Math.max(config.timeout ?? 0, 180000);
  }

  const isGrowthHistorySummary = requestUrl.includes('/growth-records/history-summary');
  if (isGrowthHistorySummary) {
    // HyDE + embeddings + LLM via pdf-rag often exceed the default 15s axios timeout.
    config.timeout = Math.max(config.timeout ?? 0, 120000);
  }

  // Access + refresh tokens are httpOnly cookies — no Authorization header. Refresh cookies when our TTL hint says we're close.
  if (!isRefresh && isAuthTokenExpired()) {
    await refreshAccessToken();
  }
  if (!shouldSkipSessionSummaryForAxios(config, 'api_call')) {
    (config as FlexshellTelemetryConfig).__flexshellTelemetryT0 = performance.now();
  }
  if (VITE_PERF_ENABLED) {
    (config as FlexshellTelemetryConfig & { __perfT0?: number }).__perfT0 = performance.now();
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (!shouldSkipSessionSummaryForAxios(response.config, 'api_call')) {
      const cfg = response.config as FlexshellTelemetryConfig;
      const t0 = cfg.__flexshellTelemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(performance.now() - t0) : undefined;
      void emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_CALL,
        api_path: axiosResolvedUrl(response.config),
        http_method: String(response.config.method ?? 'get').toUpperCase(),
        http_status: response.status,
        duration_ms: durationMs
      });
    }
    if (VITE_PERF_ENABLED) {
      const t0 = (response.config as FlexshellTelemetryConfig & { __perfT0?: number }).__perfT0;
      if (typeof t0 === 'number') {
        recordPerf({
          label: `${String(response.config.method ?? 'get').toUpperCase()} ${axiosResolvedUrl(response.config)}`,
          type: 'api',
          durationMs: performance.now() - t0,
          timestamp: Date.now()
        });
      }
    }
    const authPayload = readUnauthorizedPayload(response.data);
    const payloadMsgOk = resolvePayloadMessage(response.data);
    if (authPayload.isUnauthorized || isPleaseLoginUserMessage(payloadMsgOk)) {
      const msg = isPleaseLoginUserMessage(payloadMsgOk)
        ? payloadMsgOk || PLEASE_LOGIN_MESSAGE
        : authPayload.message;
      void emitSessionExpiredTelemetryAndFlush(401).finally(() =>
        performLocalLogoutAndRedirect(msg, response.config)
      );
      return Promise.reject(new Error(msg));
    }
    return response;
  },
  async (error) => {
    const requestUrl = String(error.config?.url ?? '');
    const status = error.response?.status as number | undefined;
    const isChatSupportOpenForbidden = requestUrl.includes(URLRegistry.paths.chatSupportOpen) && status === 403;
    if (isChatSupportOpenForbidden) {
      void logClient('INFO', 'Ignoring expected forbidden support-open request', {
        status,
        url: requestUrl
      });
      return Promise.reject(error);
    }
    const isRefreshRequest = requestUrl.includes(URLRegistry.paths.refresh);
    if (isRefreshRequest && (status === 401 || status === 403)) {
      return Promise.reject(error);
    }
    localizeTimeoutErrorMessageIfNeeded(error);
    void logClient('ERROR', 'HTTP request failed', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });
    if (error.config && !shouldSkipSessionSummaryForAxios(error.config, 'api_error')) {
      const cfg = error.config as FlexshellTelemetryConfig;
      const t0 = cfg.__flexshellTelemetryT0;
      const durationMs = typeof t0 === 'number' ? Math.round(performance.now() - t0) : undefined;
      const data = error.response?.data as { Message?: string; message?: string } | undefined;
      const errMsg =
        (data?.Message ?? data?.message ?? (error instanceof Error ? error.message : String(error))).toString();
      void emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_ERROR,
        api_path: axiosResolvedUrl(error.config),
        http_method: String(error.config.method ?? 'get').toUpperCase(),
        http_status: error.response?.status,
        duration_ms: durationMs,
        error_message: errMsg.slice(0, 2000)
      });
    }
    if (error.config && VITE_PERF_ENABLED) {
      const t0 = (error.config as FlexshellTelemetryConfig & { __perfT0?: number }).__perfT0;
      if (typeof t0 === 'number') {
        recordPerf({
          label: `${String(error.config.method ?? 'get').toUpperCase()} ${axiosResolvedUrl(error.config)}`,
          type: 'api',
          durationMs: performance.now() - t0,
          timestamp: Date.now(),
          meta: { error: true, status: error.response?.status }
        });
      }
    }
    const popupStore = usePopupStore(pinia);
    const toastStore = useToastStore(pinia);
    const isLoginRequest =
      requestUrl.includes(URLRegistry.paths.login) || requestUrl.includes(URLRegistry.paths.googleLogin);
    const isLogoutRequest = requestUrl.includes(URLRegistry.paths.logout);
    const isDoctorDirectoryRequest = requestUrl.includes(URLRegistry.paths.doctorGet);
    const isSmartAiRequest = requestUrl.includes(URLRegistry.paths.hospitalAiChat);
    const isChatSupportOpenRequest = requestUrl.includes(URLRegistry.paths.chatSupportOpen);
    const isMultipartUpload = typeof FormData !== 'undefined' && error.config?.data instanceof FormData;
    /** Proxied RAG catalog calls beside chat; timeouts/errors should not show a global toast. */
    const isHospitalEducationCatalogRequest =
      requestUrl.includes(URLRegistry.paths.hospitalEducationBooks) ||
      requestUrl.includes(URLRegistry.paths.hospitalEducationKeyTopics);
    /** Optional background enrichment — failures must not toast, popup, or force re-login. */
    const isGrowthHistorySummaryRequest = requestUrl.includes('/growth-records/history-summary');
    const isSilentBackgroundRequest = isHospitalEducationCatalogRequest || isGrowthHistorySummaryRequest;
    const authPayload = readUnauthorizedPayload(error.response?.data);
    const payloadMsgErr = resolvePayloadMessage(error.response?.data);

    // Network / transport failures (e.g. backend down) for non-critical background calls should not
    // interrupt the UI with a toast/popup. Callers can still handle the rejection if they want.
    const isNetworkFailure = !status;
    const isLogsBatchRequest = requestUrl.includes(URLRegistry.paths.logsBatch);
    const isTelemetryIngestRequest =
      requestUrl.includes(URLRegistry.paths.telemetrySessionEvent) ||
      requestUrl.includes(URLRegistry.paths.telemetrySessionEvents);
    const isHeroYoutubeRequest = requestUrl.includes(URLRegistry.paths.youtubeHeroVideo);
    if (
      isNetworkFailure &&
      (isLogsBatchRequest ||
        isTelemetryIngestRequest ||
        isHeroYoutubeRequest ||
        isSilentBackgroundRequest)
    ) {
      return Promise.reject(error);
    }

    if (authPayload.isUnauthorized || isPleaseLoginUserMessage(payloadMsgErr)) {
      const msg = isPleaseLoginUserMessage(payloadMsgErr)
        ? payloadMsgErr || PLEASE_LOGIN_MESSAGE
        : authPayload.message;
      void emitSessionExpiredTelemetryAndFlush(error.response?.status).finally(() =>
        performLocalLogoutAndRedirect(msg, error.config)
      );
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
      const bodyMsg401403 = normalizeAuthUserMessage(
        String(error.response?.data?.message ?? error.response?.data?.Message ?? '').trim()
      );
      const forceLoginPopup =
        isPleaseLoginUserMessage(bodyMsg401403) &&
        !isLoginRequest &&
        !isLogoutRequest &&
        !isRefreshRequest;

      if (forceLoginPopup) {
        void emitSessionExpiredTelemetryAndFlush(error.response?.status).finally(() =>
          performLocalLogoutAndRedirect(bodyMsg401403 || PLEASE_LOGIN_MESSAGE, error.config)
        );
        return Promise.reject(error);
      }

      if (
        isLoginRequest ||
        isLogoutRequest ||
        isRefreshRequest ||
        isDoctorDirectoryRequest ||
        isMultipartUpload ||
        isSmartAiRequest ||
        isChatSupportOpenRequest ||
        isSilentBackgroundRequest
      ) {
        if (isSmartAiRequest) {
          toastStore.show(tr('toast.healthAssistantUnavailable'), 'error');
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
        const message =
          normalizeAuthUserMessage(
            String(error.response?.data?.message ?? error.response?.data?.Message ?? '').trim()
          ) || DEFAULT_AUTH_UNAUTHORIZED_MESSAGE;
        void emitSessionExpiredTelemetryAndFlush(401).finally(() => {
          performLocalLogoutAndRedirect(message, originalRequest as AxiosRequestConfig);
        });
      } else {
        popupStore.openError(new Error('You do not have permission to perform this action.'));
      }
    } else if (error.response?.status >= 500) {
      if (isSmartAiRequest) {
        toastStore.show(tr('toast.healthAssistantUnavailable'), 'error');
        return Promise.reject(error);
      }
      if (isSilentBackgroundRequest) {
        return Promise.reject(error);
      }
      popupStore.openError(new Error('Server error. Please try again later.'));
    } else {
      const data = error.response?.data as { Message?: string; message?: string } | undefined;
      const rawToastMsg = String(data?.Message ?? data?.message ?? error.message ?? '');
      const normalizedToast = normalizeAuthUserMessage(rawToastMsg.trim());
      if (
        isPleaseLoginUserMessage(normalizedToast) &&
        error.config &&
        !isLoginRequest &&
        !isLogoutRequest &&
        !isRefreshRequest
      ) {
        void emitSessionExpiredTelemetryAndFlush(error.response?.status).finally(() =>
          performLocalLogoutAndRedirect(normalizedToast || PLEASE_LOGIN_MESSAGE, error.config)
        );
        return Promise.reject(error);
      }
      if (isSilentBackgroundRequest) {
        return Promise.reject(error);
      }
      toastStore.show(rawToastMsg || normalizedToast, 'error');
    }

    return Promise.reject(error);
  }
);
