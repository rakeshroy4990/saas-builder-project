import { isAxiosError } from 'axios';

import { toUserFacingApiError } from '@/api/apiErrors';
import { getMobileApiBaseUrl } from '@/api/config';

import { getGoogleSignInSetupLines } from './googleSetupHint';

function apiHostForDiagnostics(): string | null {
  try {
    return new URL(getMobileApiBaseUrl()).host;
  } catch {
    return null;
  }
}

/** Backend `/api/auth/*` failure after Google returned a token (or password login). */
export function formatBackendAuthFailure(error: unknown, fallback: string): string {
  const message = toUserFacingApiError(error, fallback);
  const transportFailure = isAxiosError(error) ? !error.response : /unable to reach|offline|too long/i.test(message);

  if (!transportFailure) {
    return message;
  }

  const host = apiHostForDiagnostics();
  const lines = [message];
  if (host) {
    lines.push('', `API host in this build: ${host}`);
    lines.push('If that host is wrong, set EXPO_PUBLIC_API_URL in eas.json and rebuild the APK.');
  }
  lines.push('Password sign-in uses the same API — try it to confirm connectivity.');
  return lines.join('\n');
}

/** Google SDK / Console configuration failures only. */
export function formatGoogleSdkFailure(error: unknown, fallback: string): string {
  const base =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : toUserFacingApiError(error, fallback);
  return `${base}\n\n${getGoogleSignInSetupLines(base).join('\n')}`;
}
