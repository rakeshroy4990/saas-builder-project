import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { parseAuthLoginPayload, SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { recordSuccessfulLoginTelemetry } from '@/analytics/sessionTelemetry';
import { apiClient } from '@/api/client';
import { setStoredRefreshToken, setStoredSessionProfile } from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';
import { getGoogleOAuthClientIds, isGoogleOAuthConfigured } from '@/config/env';
import { getGoogleOAuthRedirectUri } from '@/config/oauth';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuthRequest() {
  const ids = getGoogleOAuthClientIds();
  return Google.useAuthRequest({
    webClientId: ids.webClientId,
    androidClientId: ids.androidClientId,
    iosClientId: ids.iosClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: getGoogleOAuthRedirectUri()
  });
}

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
    expiresInSeconds: parsed.expiresInSeconds ?? 900
  });
  if (parsed.refreshToken) {
    await setStoredRefreshToken(parsed.refreshToken);
  }
  await setStoredSessionProfile(user);
  recordSuccessfulLoginTelemetry('google');
  const { connectRealtimeAfterAuth } = await import('@/features/video/connectOnAuth');
  void connectRealtimeAfterAuth();
}

export function isGoogleSignInConfigured(): boolean {
  return isGoogleOAuthConfigured();
}
