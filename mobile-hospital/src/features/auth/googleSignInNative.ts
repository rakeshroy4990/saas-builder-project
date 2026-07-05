import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';

let configured = false;

/** Cap silent sign-in so a stale Google session does not block the account picker for several seconds. */
const SILENT_SIGN_IN_TIMEOUT_MS = 2_000;

export type GoogleNativeCredential = {
  idToken: string | null;
  accessToken: string;
};

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

async function loadGoogleSignIn(): Promise<GoogleSignInModule> {
  return import('@react-native-google-signin/google-signin');
}

export function isNativeGoogleSignInAvailable(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** Native Google Sign-In does not run in Expo Go (requires a dev/production build). */
export function isExpoGoClient(): boolean {
  return Constants.appOwnership === 'expo';
}

export async function ensureGoogleSignInConfigured(): Promise<void> {
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

  const { GoogleSignin } = await loadGoogleSignIn();
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('silent_sign_in_timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('silent_sign_in_failed'));
      });
  });
}

/** Pre-warm Play Services (Android) and Google silent session while the login screen is visible. */
export async function warmGoogleSignInNative(): Promise<void> {
  if (!isNativeGoogleSignInAvailable() || isExpoGoClient()) return;
  try {
    await ensureGoogleSignInConfigured();
    const { GoogleSignin } = await loadGoogleSignIn();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    }
    void trySilentGoogleCredential();
  } catch {
    // Non-fatal; interactive sign-in may still work
  }
}

async function readCredentialAfterSignIn(
  GoogleSignin: GoogleSignInModule['GoogleSignin'],
  idTokenFromResponse?: string | null
): Promise<GoogleNativeCredential> {
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken?.trim();
  if (!accessToken) {
    throw new Error('Google sign-in did not return an access token');
  }
  const idToken = (idTokenFromResponse ?? tokens.idToken)?.trim() || null;
  return { idToken, accessToken };
}

async function trySilentGoogleCredential(): Promise<GoogleNativeCredential | null> {
  const { GoogleSignin } = await loadGoogleSignIn();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  try {
    const silent = await withTimeout(GoogleSignin.signInSilently(), SILENT_SIGN_IN_TIMEOUT_MS);
    if (silent.type !== 'success') return null;
    const idTokenFromResponse =
      typeof silent.data?.idToken === 'string' ? silent.data.idToken.trim() : null;
    return await readCredentialAfterSignIn(GoogleSignin, idTokenFromResponse);
  } catch {
    return null;
  }
}

export async function signInWithGoogleNative(): Promise<GoogleNativeCredential> {
  if (isExpoGoClient()) {
    throw new Error(
      'Google sign-in needs a development or preview build (EAS). It does not work in Expo Go.'
    );
  }

  await ensureGoogleSignInConfigured();
  const { GoogleSignin, isSuccessResponse } = await loadGoogleSignIn();

  const silentCredential = await trySilentGoogleCredential();
  if (silentCredential) return silentCredential;

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled');
  }

  const idTokenFromResponse =
    typeof response.data?.idToken === 'string' ? response.data.idToken.trim() : null;
  return readCredentialAfterSignIn(GoogleSignin, idTokenFromResponse);
}
