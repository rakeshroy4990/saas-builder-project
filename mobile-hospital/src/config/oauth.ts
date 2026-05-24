import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';

const ANDROID_PACKAGE = 'com.agastya.healthcare';

/** Google native redirect scheme for Android/iOS OAuth clients (required by Google). */
export function googleNativeRedirectUri(clientId: string | undefined): string | null {
  const trimmed = String(clientId ?? '').trim();
  if (!trimmed) return null;
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/i, '');
  if (!prefix) return null;
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

/**
 * Redirect URI for Google OAuth.
 * Android/iOS must use the reversed Google client id scheme — package-based URIs cause
 * "Custom URI scheme is not enabled for your Android client" (400 invalid_request).
 */
export function getGoogleOAuthRedirectUri(): string {
  const ids = getGoogleOAuthClientIds();

  if (Platform.OS === 'android') {
    return (
      googleNativeRedirectUri(ids.androidClientId) ??
      googleNativeRedirectUri(ids.webClientId) ??
      `${ANDROID_PACKAGE}:/oauthredirect`
    );
  }

  if (Platform.OS === 'ios') {
    return (
      googleNativeRedirectUri(ids.iosClientId) ??
      googleNativeRedirectUri(ids.webClientId) ??
      AuthSession.makeRedirectUri({ scheme: 'mobilehospital', path: 'oauthredirect' })
    );
  }

  return AuthSession.makeRedirectUri({ scheme: 'mobilehospital', path: 'oauthredirect' });
}

/** URIs to add under Web OAuth client → Authorized redirect URIs. */
export function getGoogleOAuthRedirectUriHints(): string[] {
  const hints = new Set<string>();
  hints.add(getGoogleOAuthRedirectUri());
  hints.add(`${ANDROID_PACKAGE}:/oauthredirect`);
  hints.add(AuthSession.makeRedirectUri({ scheme: 'mobilehospital', path: 'oauthredirect' }));
  const ids = getGoogleOAuthClientIds();
  for (const clientId of [ids.androidClientId, ids.iosClientId, ids.webClientId]) {
    const native = googleNativeRedirectUri(clientId);
    if (native) hints.add(native);
  }
  return [...hints];
}

/** Expo `scheme` entries so the OS can open the app after Google OAuth. */
export function getGoogleOAuthAppSchemes(): string[] {
  const schemes = new Set<string>();
  const ids = getGoogleOAuthClientIds();
  for (const clientId of [ids.androidClientId, ids.iosClientId]) {
    const uri = googleNativeRedirectUri(clientId);
    if (!uri) continue;
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(uri);
    if (match?.[1]) schemes.add(match[1]);
  }
  return [...schemes];
}
