import { isAxiosError } from 'axios';
import type { Composer } from 'vue-i18n';
import { i18n } from '../../i18n';

/** Axios uses this message shape when `timeout` is exceeded. */
const AXIOS_TIMEOUT_MS_RE = /timeout\s+of\s+\d+\s*ms\s+exceeded/i;

export function isRequestTimeoutError(error: unknown): boolean {
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
