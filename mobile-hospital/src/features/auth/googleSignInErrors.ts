import { isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { isGoogleDeveloperConfigError } from './googleDeveloperError';

const DEVELOPER_ERROR_HEADLINE =
  'DEVELOPER_ERROR: Google Cloud Console SHA-1 / package mismatch.';

export function mapNativeGoogleSignInError(err: unknown): Error {
  if (isErrorWithCode(err)) {
    const code = String(err.code ?? '');
    const message = String(err.message ?? '').trim();

    if (code === '10' || isGoogleDeveloperConfigError(message)) {
      return new Error(DEVELOPER_ERROR_HEADLINE);
    }

    switch (err.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return new Error('Google sign-in was cancelled');
      case statusCodes.IN_PROGRESS:
        return new Error('Google sign-in is already in progress');
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return new Error('Google Play Services is missing or outdated on this device');
      default:
        break;
    }
  }

  if (err instanceof Error && isGoogleDeveloperConfigError(err.message)) {
    return new Error(DEVELOPER_ERROR_HEADLINE);
  }

  return err instanceof Error ? err : new Error('Google sign-in failed');
}
