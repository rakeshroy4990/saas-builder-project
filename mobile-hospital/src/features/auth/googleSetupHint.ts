import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getGoogleOAuthRedirectUri, getGoogleOAuthRedirectUriHints } from '@/config/oauth';

/** Non-secret setup lines shown when Google sign-in fails (helps fix Cloud Console). */
export function getGoogleSignInSetupLines(): string[] {
  const redirect = getGoogleOAuthRedirectUri();
  const packageName =
    Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.agastya.healthcare';
  const lines = [
    `App package: ${packageName}`,
    `Redirect URI (add to Web OAuth client): ${redirect}`,
    'Android OAuth client: package + SHA-1 must match the APK signing key (run: eas credentials -p android).'
  ];
  if (__DEV__) {
    lines.push(`All redirect URIs: ${getGoogleOAuthRedirectUriHints().join(', ')}`);
  }
  if (Platform.OS === 'android') {
    lines.push('Consent screen may show "oshucare" — that is the GCP project name, not the package name.');
  }
  return lines;
}
