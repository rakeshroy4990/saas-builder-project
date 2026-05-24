import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';
import { getGoogleOAuthRedirectUri } from '@/config/oauth';

WebBrowser.maybeCompleteAuthSession();

/** Browser OAuth for web only — Android/iOS use native Google Sign-In. */
export function useGoogleWebAuthRequest() {
  const ids = getGoogleOAuthClientIds();
  return Google.useAuthRequest({
    webClientId: ids.webClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: getGoogleOAuthRedirectUri()
  });
}

export function isGoogleWebAuthAvailable(): boolean {
  return Platform.OS === 'web';
}
