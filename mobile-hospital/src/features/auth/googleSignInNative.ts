import { GoogleSignin, isSuccessResponse, type SignInSilentlyResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';

let configured = false;

export function isNativeGoogleSignInAvailable(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** Native Google Sign-In does not run in Expo Go (requires a dev/production build). */
export function isExpoGoClient(): boolean {
  return Constants.appOwnership === 'expo';
}

export function ensureGoogleSignInConfigured(): void {
  if (configured || !isNativeGoogleSignInAvailable()) return;

  const ids = getGoogleOAuthClientIds();
  if (!ids.webClientId) {
    throw new Error('Google Web client ID is required for native sign-in');
  }
  if (ids.androidClientId && ids.webClientId === ids.androidClientId) {
    throw new Error(
      'Misconfigured Google client IDs: webClientId must be the Web application client, not the Android client.'
    );
  }

  GoogleSignin.configure({
    webClientId: ids.webClientId,
    iosClientId: ids.iosClientId,
    offlineAccess: false,
    scopes: ['profile', 'email']
  });
  configured = true;

  if (Platform.OS === 'android') {
    void GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }).catch(() => undefined);
  }
}

/** Pre-warm Play Services (Android) while the login screen is visible. */
export async function warmGoogleSignInNative(): Promise<void> {
  if (!isNativeGoogleSignInAvailable() || isExpoGoClient()) return;
  try {
    ensureGoogleSignInConfigured();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    }
  } catch {
    // Non-fatal; interactive sign-in may still work
  }
}

async function readAccessTokenAfterSignIn(): Promise<string> {
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken?.trim();
  if (!accessToken) {
    throw new Error('Google sign-in did not return an access token');
  }
  return accessToken;
}

async function trySilentGoogleAccessToken(): Promise<string | null> {
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  try {
    const silent: SignInSilentlyResponse = await GoogleSignin.signInSilently();
    if (!isSuccessResponse(silent)) return null;
    return await readAccessTokenAfterSignIn();
  } catch {
    return null;
  }
}

export async function signInWithGoogleNative(): Promise<string> {
  if (isExpoGoClient()) {
    throw new Error(
      'Google sign-in needs a development or preview build (EAS). It does not work in Expo Go.'
    );
  }

  ensureGoogleSignInConfigured();

  const silentToken = await trySilentGoogleAccessToken();
  if (silentToken) return silentToken;

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled');
  }

  return readAccessTokenAfterSignIn();
}
