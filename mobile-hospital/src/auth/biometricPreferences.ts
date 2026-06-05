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

export async function authenticateForAppUnlock(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Agastya Healthcare',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false
    });
    return result.success;
  } catch {
    return false;
  }
}
