import { parseAuthLoginPayload, SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';
import { Platform } from 'react-native';

import { authLoginTelemetryFromResponse, AUTH_TELEMETRY_PATHS } from '@/analytics/authTelemetry';
import { recordSuccessfulLoginTelemetry } from '@/analytics/sessionTelemetry';
import { apiClient } from '@/api/client';
import { AUTH_API_TIMEOUT_MS } from '@/api/timeouts';
import { useBiometricLockStore } from '@/auth/biometricLockStore';
import { persistSessionSecrets } from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from '@/auth/tokenTtl';
import { getGoogleOAuthClientIds, isGoogleOAuthConfigured } from '@/config/env';

import { finalizeMobileLoginLocale } from '@/features/auth/localeSync';
import { mapNativeGoogleSignInError } from './googleSignInErrors';
import {
  isExpoGoClient,
  isNativeGoogleSignInAvailable,
  signInWithGoogleNative,
  warmGoogleSignInNative,
  type GoogleNativeCredential
} from './googleSignInNative';
import { warmAuthBackend } from './warmAuthBackend';

export {
  ensureGoogleSignInConfigured,
  isExpoGoClient,
  isNativeGoogleSignInAvailable,
  warmGoogleSignInNative
} from './googleSignInNative';
export { warmAuthBackend } from './warmAuthBackend';
export { isGoogleWebAuthAvailable, useGoogleWebAuthRequest } from './googleSignInWeb';

export type GoogleSignInCredential = GoogleNativeCredential | { idToken: null; accessToken: string };

function googleLoginRequestBody(credential: GoogleSignInCredential): Record<string, string> {
  if (credential.idToken) {
    return { IdToken: credential.idToken };
  }
  return { AccessToken: credential.accessToken };
}

export async function completeGoogleSignIn(
  credential: GoogleSignInCredential,
  identityFallback: string
): Promise<void> {
  const startedAtMs = Date.now();
  const response = await apiClient.post(
    SERVER_PATHS.googleLogin,
    googleLoginRequestBody(credential),
    { timeout: AUTH_API_TIMEOUT_MS }
  );
  const userData = unwrapEnvelope<Record<string, unknown>>(response.data) ?? {};
  const parsed = parseAuthLoginPayload(response.data, identityFallback);
  if (!parsed.accessToken) {
    throw new Error('Google sign-in did not return an access token');
  }
  const user: SessionUser = {
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
  useBiometricLockStore.getState().grantUnlockGrace();
  persistSessionSecrets(parsed.refreshToken, user);
  await finalizeMobileLoginLocale(userData, parsed.userId);
  recordSuccessfulLoginTelemetry(
    'google',
    authLoginTelemetryFromResponse(AUTH_TELEMETRY_PATHS.googleLogin, startedAtMs, response.status)
  );
  const { connectRealtimeAfterAuth } = await import('@/features/video/connectOnAuth');
  void connectRealtimeAfterAuth();
}

/** Preferred sign-in path on Android/iOS (native SDK, no browser redirect). */
export async function signInWithGoogle(): Promise<GoogleSignInCredential> {
  if (isNativeGoogleSignInAvailable()) {
    try {
      return await signInWithGoogleNative();
    } catch (err) {
      throw mapNativeGoogleSignInError(err);
    }
  }
  throw new Error('Google sign-in is only supported on Android and iOS in the mobile app');
}

export function isGoogleSignInConfigured(): boolean {
  if (!isGoogleOAuthConfigured()) return false;
  if (Platform.OS === 'web') return true;
  const ids = getGoogleOAuthClientIds();
  return Boolean(ids.webClientId);
}

/** Pre-warm Cloud Run and native Google SDK while the login form is visible. */
export function warmGoogleLogin(): void {
  warmAuthBackend();
  void warmGoogleSignInNative();
}
