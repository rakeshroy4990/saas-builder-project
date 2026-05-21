import type { BluetoothDeviceProfile } from './deviceRegistry';
import { mergeOptionalServiceUuids } from './gattDiscovery';
import { withTimeout } from './bluetoothTimeout';

const GATT_CONNECT_TIMEOUT_MS = 12_000;

function profileUsesLivsmtNames(profile: BluetoothDeviceProfile): boolean {
  return (
    profile.namePrefixes?.some((p) => p.startsWith('LIVSMT')) === true ||
    profile.exactDeviceNames?.some((n) => n.startsWith('LIVSMT')) === true
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function deviceNameMatchesProfile(
  deviceName: string | undefined,
  profile: BluetoothDeviceProfile
): boolean {
  const name = (deviceName ?? '').trim();
  if (!name) return false;
  for (const exact of profile.exactDeviceNames ?? []) {
    if (name === exact) return true;
  }
  for (const prefix of profile.namePrefixes ?? []) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

/** Reconnect to a device this origin already allowed (skips the picker when unambiguous). */
export async function findPreviouslyAllowedDevice(
  profile: BluetoothDeviceProfile
): Promise<BluetoothDevice | null> {
  if (typeof navigator.bluetooth.getDevices !== 'function') {
    return null;
  }
  const allowed = await navigator.bluetooth.getDevices();
  const matches = allowed.filter((d) => deviceNameMatchesProfile(d.name ?? undefined, profile));
  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}

export function buildNameFilters(profile: BluetoothDeviceProfile): BluetoothLEScanFilter[] {
  const filters: BluetoothLEScanFilter[] = [];
  for (const name of profile.exactDeviceNames ?? []) {
    const trimmed = name.trim();
    if (trimmed) filters.push({ name: trimmed });
  }
  for (const namePrefix of profile.namePrefixes ?? []) {
    const trimmed = namePrefix.trim();
    if (trimmed) filters.push({ namePrefix: trimmed });
  }
  return filters;
}

export function buildPickerFilters(profile: BluetoothDeviceProfile): BluetoothLEScanFilter[] {
  const filters = buildNameFilters(profile);
  for (const serviceUuid of profile.pickerServiceFilters ?? []) {
    filters.push({ services: [serviceUuid] });
  }
  return filters;
}

export function profileServiceUuids(profile: BluetoothDeviceProfile): string[] {
  return [...profile.serviceUUIDs, ...(profile.optionalServiceUUIDs ?? [])];
}

export function buildRequestDeviceOptions(profile: BluetoothDeviceProfile): RequestDeviceOptions {
  const optionalServices = mergeOptionalServiceUuids(profileServiceUuids(profile));
  const pickerFilters = buildPickerFilters(profile);
  const useNamePairing =
    pickerFilters.length > 0 &&
    (profile.preferNameBasedPairing === true ||
      (profile.preferNameBasedPairing !== false && !profile.acceptAllDevices));

  if (useNamePairing) {
    return { filters: pickerFilters, optionalServices };
  }

  if (profile.acceptAllDevices) {
    return { acceptAllDevices: true, optionalServices };
  }

  return {
    filters: [{ services: profile.serviceUUIDs }],
    optionalServices
  };
}

export async function requestBluetoothDevice(
  profile: BluetoothDeviceProfile
): Promise<BluetoothDevice> {
  const bluetooth = navigator.bluetooth;
  if (!bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser.');
  }
  // Stale getDevices() entries make gatt.connect() hang on macOS Chrome for LIVSMT.
  if (!profileUsesLivsmtNames(profile)) {
    const previous = await findPreviouslyAllowedDevice(profile);
    if (previous) {
      return previous;
    }
  }
  return bluetooth.requestDevice(buildRequestDeviceOptions(profile));
}

const GATT_CONNECT_TIMEOUT_MESSAGE =
  'Bluetooth connection timed out. Forget each LIVSMT-RO-… in chrome://bluetooth-internals, quit the Spirofy app, power-cycle the spirometer, reload, then click Connect device and pick it in the list.';

/** Open GATT once with a hard timeout (avoids infinite "Connecting…"). */
export async function connectGattServer(device: BluetoothDevice): Promise<BluetoothRemoteGATTServer> {
  const gatt = device.gatt;
  if (!gatt) {
    throw new Error(
      'This device has no BLE GATT interface in the browser. The Spirofy may only work with the official mobile app.'
    );
  }

  if (gatt.connected) {
    try {
      gatt.disconnect();
    } catch {
      /* ignore */
    }
    await delay(300);
  }

  const server = await withTimeout(
    gatt.connect(),
    GATT_CONNECT_TIMEOUT_MS,
    GATT_CONNECT_TIMEOUT_MESSAGE
  );
  await delay(400);
  return server;
}
