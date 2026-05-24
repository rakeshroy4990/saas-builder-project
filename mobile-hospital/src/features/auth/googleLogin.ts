import { parseAuthLoginPayload, SERVER_PATHS } from '@saas-builder/hospital-api-client';
import { Platform } from 'react-native';

import { recordSuccessfulLoginTelemetry } from '@/analytics/sessionTelemetry';
import { apiClient } from '@/api/client';
import { persistSessionSecrets } from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from '@/auth/tokenTtl';
import { getGoogleOAuthClientIds, isGoogleOAuthConfigured } from '@/config/env';

import { mapNativeGoogleSignInError } from './googleSignInErrors';
import { isExpoGoClient, isNativeGoogleSignInAvailable, signInWithGoogleNative } from './googleSignInNative';

export { ensureGoogleSignInConfigured, isExpoGoClient, isNativeGoogleSignInAvailable } from './googleSignInNative';
export { isGoogleWebAuthAvailable, useGoogleWebAuthRequest } from './googleSignInWeb';

export async function completeGoogleSignIn(googleAccessToken: string, identityFallback: string): Promise<void> {
  const response = await apiClient.post(SERVER_PATHS.googleLogin, {
    AccessToken: googleAccessToken
  });
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
  persistSessionSecrets(parsed.refreshToken, user);
  recordSuccessfulLoginTelemetry('google');
  const { connectRealtimeAfterAuth } = await import('@/features/video/connectOnAuth');
  void connectRealtimeAfterAuth();
}

/** Preferred sign-in path on Android/iOS (native SDK, no browser redirect). */
export async function signInWithGoogle(): Promise<string> {
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
