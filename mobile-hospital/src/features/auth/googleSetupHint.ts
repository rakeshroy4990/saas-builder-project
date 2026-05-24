import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { getGoogleOAuthClientIds } from '@/config/env';

import { isExpoGoClient } from './googleSignInNative';
import { isGoogleDeveloperConfigError } from './googleDeveloperError';

function getGoogleRuntimeDiagnostics(): string[] {
  const ids = getGoogleOAuthClientIds();
  const appId = Application.applicationId?.trim() || '(unknown)';
  const webSuffix = ids.webClientId?.split('-')[1]?.slice(0, 12) ?? 'missing';
  return [
    `Installed APK package: ${appId}`,
    `webClientId baked into APK (…${webSuffix}…): must be Web application type in Console`
  ];
}

/** Steps when native Google Sign-In returns DEVELOPER_ERROR (SHA-1 / package mismatch). */
export function getGoogleDeveloperErrorLines(): string[] {
  const packageName =
    Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.agastya.healthcare';
  const ids = getGoogleOAuthClientIds();

  return [
    'DEVELOPER_ERROR: Google Cloud Console does not match this installed APK.',
    ...getGoogleRuntimeDiagnostics(),
    `Expected package on Android OAuth client: ${packageName}`,
    'If SHA-1 already matches EAS (oshucare-android), also verify in Google Cloud Console:',
    '• Web client …k1e8jsn96… exists and type is Web application (not Android).',
    '• OAuth consent screen → Test users includes your Google account (if Testing).',
    '• Only one Android OAuth client for com.agastya.healthcare (remove duplicates).',
    '• Installed APK is from EAS (preview/production), not a local debug build.',
    `Android OAuth client ID in Console: ${ids.androidClientId ?? '(not set)'}`,
    `Web OAuth client ID in GoogleSignin.configure: ${ids.webClientId ?? '(not set)'}`,
    'Get SHA-1: cd mobile-hospital && npm run credentials:android → Keystore',
    'Firebase is not required — Google Cloud Console OAuth clients are enough.'
  ];
}

/** Non-secret setup lines shown when Google sign-in fails (helps fix Cloud Console). */
export function getGoogleSignInSetupLines(errorMessage = ''): string[] {
  if (isGoogleDeveloperConfigError(errorMessage)) {
    return getGoogleDeveloperErrorLines();
  }

  const packageName =
    Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.agastya.healthcare';
  const ids = getGoogleOAuthClientIds();

  const lines = [
    `App package: ${packageName}`,
    'Use a development or preview EAS build — Google sign-in does not work in Expo Go.',
    'Android OAuth client: package name + SHA-1 from the APK signing key (eas credentials -p android).',
    `Web OAuth client ID (required in GoogleSignin.configure): ${ids.webClientId ?? '(not set)'}`,
    `Android OAuth client ID (Console only — not passed to configure): ${ids.androidClientId ?? '(not set)'}`
  ];

  if (isExpoGoClient()) {
    lines.unshift('You are on Expo Go — build with: eas build --profile preview --platform android');
  }

  if (Platform.OS === 'ios') {
    lines.push(`iOS OAuth client ID: ${ids.iosClientId ?? '(optional — uses web client if missing)'}`);
  }

  if (Platform.OS === 'android') {
    lines.push('Consent screen may show "oshucare" — that is the GCP project name, not the package name.');
    lines.push('After changing SHA-1 in Console, wait a few minutes — no rebuild required unless client IDs changed.');
  }

  return lines;
}
