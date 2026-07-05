import * as SecureStore from 'expo-secure-store';

export type SmartWatchPlatform =
  | 'apple_watch'
  | 'wear_os'
  | 'samsung_galaxy'
  | 'fitbit'
  | 'fire_boltt';

export const SMART_WATCH_PLATFORMS: SmartWatchPlatform[] = [
  'fire_boltt',
  'apple_watch',
  'wear_os',
  'samsung_galaxy',
  'fitbit'
];

export type SmartWatchIntegrationState = {
  platform: SmartWatchPlatform | null;
  connectedAt: string | null;
  healthAccessGranted?: boolean;
  lastSyncAt?: string | null;
};

const STORAGE_KEY = 'agastya.smartWatchIntegration';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

export async function readSmartWatchIntegration(): Promise<SmartWatchIntegrationState> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY, STORE_OPTIONS);
    if (!raw) return { platform: null, connectedAt: null, healthAccessGranted: false, lastSyncAt: null };
    const parsed = JSON.parse(raw) as Partial<SmartWatchIntegrationState>;
    const platform = SMART_WATCH_PLATFORMS.includes(parsed.platform as SmartWatchPlatform)
      ? (parsed.platform as SmartWatchPlatform)
      : null;
    const connectedAt =
      typeof parsed.connectedAt === 'string' && parsed.connectedAt.trim()
        ? parsed.connectedAt
        : null;
    return {
      platform,
      connectedAt,
      healthAccessGranted: Boolean(parsed.healthAccessGranted),
      lastSyncAt:
        typeof parsed.lastSyncAt === 'string' && parsed.lastSyncAt.trim() ? parsed.lastSyncAt : null
    };
  } catch {
    return { platform: null, connectedAt: null, healthAccessGranted: false, lastSyncAt: null };
  }
}

export async function saveSmartWatchIntegration(state: SmartWatchIntegrationState): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state), STORE_OPTIONS);
  } catch {
    // SecureStore unavailable on web
  }
}

export async function clearSmartWatchIntegration(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY, STORE_OPTIONS);
  } catch {
    // ignore
  }
}
