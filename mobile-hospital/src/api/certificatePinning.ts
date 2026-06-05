import { pickConfigValue } from '@/config/env';

import { parseSslPinJson, type SslPinHostConfig } from '@/api/sslPinConfigParse';

export type { SslPinHostConfig };

/**
 * Optional SPKI pins for the API host (Cloud Run). Set at build time:
 *
 * EXPO_PUBLIC_SSL_PIN_JSON={"backend-hospital-yspwmymsgq-el.a.run.app":["<sha256-spki-base64>","<backup>"]}
 *
 * Requires a native EAS build (`react-native-ssl-public-key-pinning`). No-op in Expo Go.
 */
export function parseSslPinConfigFromEnv(): Record<string, SslPinHostConfig> | null {
  const raw = pickConfigValue(process.env.EXPO_PUBLIC_SSL_PIN_JSON, undefined);
  return parseSslPinJson(raw);
}

export async function initCertificatePinningIfConfigured(): Promise<void> {
  const hosts = parseSslPinConfigFromEnv();
  if (!hosts) return;

  try {
    const { isSslPinningAvailable, initializeSslPinning } = await import(
      'react-native-ssl-public-key-pinning'
    );
    if (!isSslPinningAvailable()) {
      return;
    }
    await initializeSslPinning(hosts);
  } catch {
    // Native module absent (Expo Go) or invalid pins — API calls still use HTTPS.
  }
}
