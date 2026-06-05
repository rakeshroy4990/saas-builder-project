import * as SecureStore from 'expo-secure-store';

/** Refresh tokens and profile — device-bound, available only while device is unlocked. */
export const AUTH_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};
