import { toUserFacingApiError } from '@/api/apiErrors';

/** Prefer server envelope message over generic axios status text. */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  return toUserFacingApiError(error, fallback);
}
