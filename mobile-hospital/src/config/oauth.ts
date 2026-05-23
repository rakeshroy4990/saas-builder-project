import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';

const ANDROID_PACKAGE = 'com.agastya.healthcare';

/**
 * Redirect URI for Google OAuth.
 * Android/iOS standalone builds use the app package id (Expo default) — register this on the *Web* OAuth client.
 */
export function getGoogleOAuthRedirectUri(): string {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    const appId = Application.applicationId?.trim() || ANDROID_PACKAGE;
    return `${appId}:/oauthredirect`;
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
    if (!clientId) continue;
    const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/i, '');
    hints.add(`com.googleusercontent.apps.${prefix}:/oauthredirect`);
  }
  return [...hints];
}
