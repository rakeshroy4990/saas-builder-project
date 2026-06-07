import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { AUTH_SECURE_STORE_OPTIONS } from '@/auth/secureStorageOptions';

const BIOMETRIC_LOCK_KEY = 'agastya.biometricLock.v1';

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY, AUTH_SECURE_STORE_OPTIONS);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  try {
    if (!enabled) {
      await SecureStore.deleteItemAsync(BIOMETRIC_LOCK_KEY, AUTH_SECURE_STORE_OPTIONS);
      return;
    }
    await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, '1', AUTH_SECURE_STORE_OPTIONS);
  } catch {
    // SecureStore unavailable on web — ignore
  }
}

/** Native prompt can hang if the app sleeps mid-auth (Android / Samsung). */
const AUTH_PROMPT_TIMEOUT_MS = 45_000;

export async function cancelBiometricPrompt(): Promise<void> {
  try {
    const cancel = (
      LocalAuthentication as typeof LocalAuthentication & {
        cancelAuthenticate?: () => Promise<void>;
      }
    ).cancelAuthenticate;
    if (typeof cancel === 'function') {
      await cancel();
    }
  } catch {
    // Non-fatal
  }
}

export async function authenticateForAppUnlock(): Promise<boolean> {
  try {
    const result = await Promise.race([
      LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Agastya Healthcare',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      }),
      new Promise<LocalAuthentication.LocalAuthenticationResult>((resolve) => {
        setTimeout(() => {
          void cancelBiometricPrompt();
          resolve({ success: false, error: 'timeout' });
        }, AUTH_PROMPT_TIMEOUT_MS);
      })
    ]);
    return result.success;
  } catch {
    return false;
  }
}
