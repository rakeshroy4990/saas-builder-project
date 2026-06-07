import { isAxiosError } from 'axios';
import { pickString } from '@saas-builder/hospital-api-client';

import { useNetworkStore } from '@/network/networkStore';
import {
  humanizeServerValidationMessage,
  looksLikeServerFieldValidation
} from '@/utils/validationMessages';

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE =
  'You appear to be offline. Check your connection and try again.';
const TIMEOUT_MESSAGE =
  'The server is taking too long to respond. Please wait a moment and try again.';
const NETWORK_MESSAGE =
  'Unable to reach the server. Check your internet connection and try again.';

export function isLikelyOffline(): boolean {
  return useNetworkStore.getState().isOffline;
}

function isTimeoutError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout');
  }
  if (error instanceof Error) {
    return error.name === 'AbortError' || /timeout/i.test(error.message);
  }
  return false;
}

function isNetworkFailure(error: unknown): boolean {
  if (isLikelyOffline()) return true;
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.code === 'ERR_NETWORK' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      /network request failed/i.test(msg) ||
      /^network error$/i.test(msg) ||
      /failed to fetch/i.test(msg)
    );
  }
  return false;
}

/**
 * Maps API/transport failures to short, user-safe copy (no raw axios codes or stack traces).
 */
export function toUserFacingApiError(error: unknown, fallback: string = GENERIC_FALLBACK): string {
  if (isLikelyOffline()) {
    return OFFLINE_MESSAGE;
  }
  if (isTimeoutError(error)) {
    return TIMEOUT_MESSAGE;
  }

  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const serverMessage = pickString(payload, ['Message', 'message']);
    const errorCode = pickString(payload, ['ErrorCode', 'errorCode']);
    if (
      serverMessage &&
      (errorCode === 'AUTH_VALIDATION_FAILED' || looksLikeServerFieldValidation(serverMessage))
    ) {
      return humanizeServerValidationMessage(serverMessage);
    }
    if (serverMessage) return serverMessage;
    if (!error.response || isNetworkFailure(error)) {
      return NETWORK_MESSAGE;
    }
    const status = error.response.status;
    if (status >= 500) {
      return 'The server encountered an error. Please try again in a moment.';
    }
    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (status === 404) {
      return 'The requested resource was not found.';
    }
  }

  if (error instanceof Error) {
    const msg = error.message.trim();
    if (isNetworkFailure(error)) return NETWORK_MESSAGE;
    if (msg && !/^Request failed with status code \d+$/i.test(msg)) {
      return msg;
    }
  }

  return fallback;
}
