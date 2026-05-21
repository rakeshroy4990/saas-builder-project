import { isAxiosError } from 'axios';
import type { Composer } from 'vue-i18n';
import { i18n } from '../../i18n';

/** Axios uses this message shape when `timeout` is exceeded. */
const AXIOS_TIMEOUT_MS_RE = /timeout\s+of\s+\d+\s*ms\s+exceeded/i;

export function isRequestTimeoutError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'TimeoutError') return true;
    if (error.name === 'AbortError') return messageLooksLikeRequestTimeout(String(error.message ?? ''));
  }
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return true;
    return messageLooksLikeRequestTimeout(String(error.message ?? ''));
  }
  if (error instanceof Error) {
    return messageLooksLikeRequestTimeout(error.message);
  }
  return messageLooksLikeRequestTimeout(String(error ?? ''));
}

export function messageLooksLikeRequestTimeout(text: string): boolean {
  const m = String(text ?? '').trim();
  if (!m) return false;
  if (AXIOS_TIMEOUT_MS_RE.test(m)) return true;
  const lower = m.toLowerCase();
  return lower.includes('timeout') && lower.includes('exceeded');
}

export function requestTimeoutMessage(): string {
  const composer = i18n.global as Composer;
  return composer.t('popup.error.requestTimeout');
}

/** Mutates axios error message when needed so downstream handlers show localized copy. */
export function localizeTimeoutErrorMessageIfNeeded(error: unknown): void {
  if (!isRequestTimeoutError(error)) return;
  const friendly = requestTimeoutMessage();
  if (isAxiosError(error)) {
    error.message = friendly;
  } else if (error instanceof Error) {
    error.message = friendly;
  }
}

const TECHNICAL_STREAM_CODE_RE =
  /^(hospital_ai_chat|prescription_similarity)_stream_[a-z0-9_]+/i;
const STREAM_HTTP_STATUS_RE =
  /^(hospital_ai_chat|prescription_similarity)_stream_(\d{3})\b/i;

/** Internal stream/transport codes → i18n keys (never shown raw on UI). */
const STREAM_ERROR_I18N: Record<string, string> = {
  hospital_ai_chat_stream_incomplete: 'popup.error.streamInterrupted',
  prescription_similarity_stream_incomplete: 'popup.error.streamInterrupted',
  hospital_ai_chat_stream_no_body: 'popup.error.streamNoBody',
  prescription_similarity_stream_no_body: 'popup.error.streamNoBody',
  hospital_ai_chat_stream_error: 'popup.error.unavailable',
  prescription_similarity_stream_error: 'popup.error.unavailable',
  prescription_similarity_stream_vite_module: 'popup.error.unavailable',
  prescription_similarity_stream_bad_url: 'popup.error.unavailable',
  prescription_similarity_stream_invalid_json: 'popup.error.unavailable'
};

function tKey(key: string): string {
  const composer = i18n.global as Composer;
  return composer.t(key);
}

function messageFromHttpStatus(status: number | undefined): string | null {
  if (status == null || Number.isNaN(status)) return null;
  if (status === 401 || status === 403) return tKey('popup.error.sessionExpired');
  if (status === 429) return tKey('popup.error.rateLimited');
  if (status >= 500) return tKey('popup.error.unavailable');
  if (status >= 400) return tKey('popup.error.generic');
  return null;
}

function extractLeadingErrorCode(message: string): string | null {
  const m = String(message ?? '').trim();
  if (!m) return null;
  const colon = m.indexOf(':');
  const head = (colon >= 0 ? m.slice(0, colon) : m).trim().toLowerCase();
  if (!head || !/^[a-z][a-z0-9_]*$/.test(head)) return null;
  return head;
}

/** True when the string is an internal code or debug text, not safe for end users. */
export function isTechnicalErrorMessage(message: string): boolean {
  const m = String(message ?? '').trim();
  if (!m) return false;
  const lower = m.toLowerCase();
  if (TECHNICAL_STREAM_CODE_RE.test(lower)) return true;
  if (STREAM_HTTP_STATUS_RE.test(lower)) return true;
  if (lower.includes('ndjson')) return true;
  if (lower.includes('framing and proxies')) return true;
  if (lower.includes('vite_module') || lower.includes('vite dev server')) return true;
  const code = extractLeadingErrorCode(m);
  if (code && STREAM_ERROR_I18N[code]) return true;
  return false;
}

function mapStreamOrStatusMessage(message: string, httpStatus?: number): string | null {
  const fromStatus = messageFromHttpStatus(httpStatus);
  if (fromStatus) return fromStatus;

  const m = String(message ?? '').trim();
  if (!m) return null;

  const statusMatch = m.match(STREAM_HTTP_STATUS_RE);
  if (statusMatch) {
    const parsed = Number(statusMatch[2]);
    return messageFromHttpStatus(parsed);
  }

  const code = extractLeadingErrorCode(m);
  if (code) {
    const key = STREAM_ERROR_I18N[code];
    if (key) return tKey(key);
  }

  return null;
}

/**
 * Maps transport, stream, and API errors to localized user-facing copy.
 * Technical codes (e.g. hospital_ai_chat_stream_incomplete) are never returned.
 */
export function resolveUserFacingErrorMessage(
  error: unknown,
  fallbackKey = 'popup.error.generic'
): string {
  const fallback = tKey(fallbackKey);

  if (isRequestTimeoutError(error)) {
    return requestTimeoutMessage();
  }

  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const apiCode = String(payload.errorCode ?? payload.ErrorCode ?? '').trim();
    if (apiCode && isTechnicalErrorMessage(apiCode)) {
      const mapped = mapStreamOrStatusMessage(apiCode, error.response?.status);
      if (mapped) return mapped;
    }
    const apiMsg = String(payload.Message ?? payload.message ?? '').trim();
    if (apiMsg) {
      const mapped = mapStreamOrStatusMessage(apiMsg, error.response?.status);
      if (mapped) return mapped;
      if (!isTechnicalErrorMessage(apiMsg)) return apiMsg;
    }
    const fromStatus = messageFromHttpStatus(error.response?.status);
    if (fromStatus) return fromStatus;
    return fallback;
  }

  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status)
      : undefined;

  const msg =
    error instanceof Error
      ? String(error.message ?? '').trim()
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message ?? '').trim()
        : '';

  if (msg) {
    const mapped = mapStreamOrStatusMessage(msg, status);
    if (mapped) return mapped;
    if (!isTechnicalErrorMessage(msg)) return msg;
  }

  const fromStatusOnly = messageFromHttpStatus(status);
  if (fromStatusOnly) return fromStatusOnly;

  return fallback;
}
