import Constants from 'expo-constants';

const PLACEHOLDER_MARKERS = [
  'your-android-client-id',
  'your-web-client-id',
  'your-ios-client-id',
  'replace_me',
  'changeme',
  'placeholder',
  'todo',
  'fixme'
] as const;

/** True when a config value is present and not a documented placeholder. */
export function isUsableConfigValue(value: unknown): boolean {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return false;
  if (lower.startsWith('your-')) return false;
  return !PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/** Pick the first usable value from env, Expo extra, or fallbacks. */
export function pickConfigValue(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (isUsableConfigValue(candidate)) {
      return String(candidate).trim();
    }
  }
  return undefined;
}

function getExpoExtra(): Record<string, string | undefined> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
}

export function getGoogleOAuthClientIds(): {
  webClientId?: string;
  androidClientId?: string;
  iosClientId?: string;
} {
  const extra = getExpoExtra();
  const webFallback = pickConfigValue(
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    extra.googleOAuthClientId
  );
  return {
    webClientId: webFallback,
    androidClientId: pickConfigValue(
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      extra.googleAndroidClientId
    ),
    iosClientId: pickConfigValue(
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      extra.googleIosClientId,
      webFallback
    )
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const ids = getGoogleOAuthClientIds();
  return Boolean(ids.webClientId || ids.androidClientId || ids.iosClientId);
}
