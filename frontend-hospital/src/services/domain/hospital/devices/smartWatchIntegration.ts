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
};

const STORAGE_KEY = 'agastya.smartWatchIntegration';

export function readSmartWatchIntegration(): SmartWatchIntegrationState {
  if (typeof localStorage === 'undefined') {
    return { platform: null, connectedAt: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { platform: null, connectedAt: null };
    const parsed = JSON.parse(raw) as Partial<SmartWatchIntegrationState>;
    const platform = SMART_WATCH_PLATFORMS.includes(parsed.platform as SmartWatchPlatform)
      ? (parsed.platform as SmartWatchPlatform)
      : null;
    const connectedAt =
      typeof parsed.connectedAt === 'string' && parsed.connectedAt.trim()
        ? parsed.connectedAt
        : null;
    return { platform, connectedAt };
  } catch {
    return { platform: null, connectedAt: null };
  }
}

export function saveSmartWatchIntegration(state: SmartWatchIntegrationState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private mode errors
  }
}

export function clearSmartWatchIntegration(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
