import { isAxiosError } from 'axios';
import { pickString } from '@saas-builder/hospital-api-client';

/** Prefer server envelope message over generic axios status text. */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const message = pickString(payload, ['Message', 'message']);
    if (message) return message;
  }
  if (error instanceof Error) {
    const msg = error.message.trim();
    if (msg && !/^Request failed with status code \d+$/i.test(msg)) {
      return msg;
    }
  }
  return fallback;
}
