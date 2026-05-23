import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TELEMETRY_DEVICE_ID_KEY = 'telemetry_device_id';

export type ClientContextPayload = {
  os?: string;
  device_id?: string;
  browser_or_app?: string;
};

async function getStoredTelemetryDeviceId(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(TELEMETRY_DEVICE_ID_KEY))?.trim() ?? '';
  } catch {
    return '';
  }
}

async function setStoredTelemetryDeviceId(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TELEMETRY_DEVICE_ID_KEY, value);
  } catch {
    // Non-fatal
  }
}

function buildOsLabel(): string {
  const osName = Device.osName?.trim();
  const osVersion = Device.osVersion?.trim();
  if (osName && osVersion) return `${osName} ${osVersion}`;
  if (osName) return osName;
  return Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
}

async function resolveDeviceId(): Promise<string> {
  const stored = await getStoredTelemetryDeviceId();
  if (stored) return stored;

  let nativeId = '';
  try {
    if (Platform.OS === 'android') {
      nativeId = Application.getAndroidId?.() ?? '';
    } else if (Platform.OS === 'ios') {
      nativeId = (await Application.getIosIdForVendorAsync?.()) ?? '';
    }
  } catch {
    nativeId = '';
  }

  const next =
    nativeId.trim() ||
    `mobile-${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  await setStoredTelemetryDeviceId(next);
  return next;
}

let cachedContext: ClientContextPayload | null = null;

/** Client environment sent on every session_telemetry ingest (mobile). */
export async function getClientContext(): Promise<ClientContextPayload> {
  if (cachedContext) return cachedContext;
  const deviceId = await resolveDeviceId();
  const model = Device.modelName?.trim();
  const appVersion = Application.nativeApplicationVersion?.trim();
  const build = Application.nativeBuildVersion?.trim();
  const versionSuffix = appVersion ? (build ? ` v${appVersion} (${build})` : ` v${appVersion}`) : '';
  cachedContext = {
    os: buildOsLabel(),
    device_id: deviceId,
    browser_or_app: `mobile-hospital/${Platform.OS}${model ? `/${model}` : ''}${versionSuffix}`
  };
  return cachedContext;
}
