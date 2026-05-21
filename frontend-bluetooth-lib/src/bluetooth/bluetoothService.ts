import { DEVICE_REGISTRY, type BluetoothDeviceProfile } from './deviceRegistry';
import { isWebBluetoothSupported } from './bluetoothSupport';
import { withTimeout } from './bluetoothTimeout';
import {
  connectGattServer,
  profileServiceUuids,
  requestBluetoothDevice
} from './deviceSelection';
import {
  countAccessibleGattServices,
  discoverBestDataCharacteristic,
  formatGattInspection,
  formatOsPairingConflictHint,
  formatSpirofyGattBlockedHint,
  mergeOptionalServiceUuids
} from './gattDiscovery';
import type { BluetoothReading, BluetoothSession } from './types';

async function resolveDataCharacteristic(
  server: BluetoothRemoteGATTServer,
  profile: BluetoothDeviceProfile,
  deviceName?: string,
  accessCounts?: { fromOptionalList: number; fromAdvertisement: number }
): Promise<BluetoothRemoteGATTCharacteristic> {
  const serviceIds = mergeOptionalServiceUuids(profileServiceUuids(profile));

  if (
    accessCounts &&
    accessCounts.fromOptionalList === 0 &&
    accessCounts.fromAdvertisement === 0
  ) {
    const deviceLabel = deviceName?.trim() || profile.label;
    const isLivsmt =
      profile.namePrefixes?.some((p) => p.startsWith('LIVSMT')) ||
      profile.exactDeviceNames?.some((n) => n.startsWith('LIVSMT'));
    throw new Error(
      isLivsmt ? formatSpirofyGattBlockedHint(deviceLabel) : formatOsPairingConflictHint()
    );
  }

  for (const serviceUuid of serviceIds) {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(serviceUuid);
    } catch {
      continue;
    }

    const charIds = [
      profile.characteristicUUID,
      ...(profile.alternateCharacteristics?.[serviceUuid] ?? [])
    ];

    for (const charUuid of charIds) {
      try {
        return await service.getCharacteristic(charUuid);
      } catch {
        // try next characteristic / service
      }
    }
  }

  const discovered = await discoverBestDataCharacteristic(server, serviceIds);
  if (discovered) {
    return discovered;
  }

  const gattHint = await formatGattInspection(server, serviceIds);
  const deviceLabel = deviceName?.trim() || profile.label;

  if (profile.type === 'spirometer') {
    throw new Error(
      `Connected to "${deviceLabel}", but no data channel was found that this browser may use. ` +
        'Spirofy often only streams full tests through the official Spirofy app (close the mobile app and retry). ' +
        `GATT scan: ${gattHint}`
    );
  }
  if (profile.type === 'thermometer') {
    throw new Error(
      `Connected to "${deviceLabel}", but no temperature characteristic was found. GATT scan: ${gattHint}`
    );
  }
  throw new Error(
    `Connected to "${deviceLabel}", but no measurement characteristic was found. GATT scan: ${gattHint}`
  );
}

let activeSession: BluetoothSession | null = null;

const CONNECT_FLOW_TIMEOUT_MS = 22_000;

async function connectDeviceInner(deviceKey: string): Promise<BluetoothSession> {
  const profile = DEVICE_REGISTRY[deviceKey];
  if (!profile) throw new Error(`Unknown device key: ${deviceKey}`);

  if (activeSession) await disconnectDevice();

  const device = await requestBluetoothDevice(profile);
  const server = await connectGattServer(device);
  const serviceIds = mergeOptionalServiceUuids(profileServiceUuids(profile));
  let access = await countAccessibleGattServices(server, serviceIds);
  if (access.fromOptionalList === 0 && access.fromAdvertisement === 0) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    access = await countAccessibleGattServices(server, serviceIds);
  }

  const characteristic = await resolveDataCharacteristic(
    server,
    profile,
    device.name ?? undefined,
    access
  );

  activeSession = { device, server, characteristic, profile, deviceKey };

  device.addEventListener('gattserverdisconnected', () => {
    activeSession = null;
  });

  return activeSession;
}

export async function connectDevice(deviceKey: string): Promise<BluetoothSession> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported in this browser.');
  }

  try {
    return await withTimeout(
      connectDeviceInner(deviceKey),
      CONNECT_FLOW_TIMEOUT_MS,
      'Connection timed out. Forget LIVSMT devices in chrome://bluetooth-internals, then use Connect device to pick the spirometer again.'
    );
  } catch (err) {
    await disconnectDevice();
    throw err;
  }
}

export async function readMeasurement(
  session: BluetoothSession,
  context?: { appointmentId?: string; patientId?: string }
): Promise<BluetoothReading> {
  const value = await session.characteristic.readValue();
  const rawBytes = new Uint8Array(value.buffer);
  const measurements = parseDeviceData(session.deviceKey, value);

  return {
    deviceKey: session.deviceKey,
    deviceName: session.device.name ?? session.profile.label,
    deviceType: session.profile.type,
    measurements,
    rawBytes,
    timestamp: new Date().toISOString(),
    appointmentId: context?.appointmentId,
    patientId: context?.patientId
  };
}

export async function subscribeToNotifications(
  session: BluetoothSession,
  onReading: (reading: BluetoothReading) => void,
  context?: { appointmentId?: string; patientId?: string }
): Promise<() => void> {
  const props = session.characteristic.properties;

  if (props.notify || props.indicate) {
    await session.characteristic.startNotifications();

    const handler = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value!;
      const measurements = parseDeviceData(session.deviceKey, value);
      onReading({
        deviceKey: session.deviceKey,
        deviceName: session.device.name ?? session.profile.label,
        deviceType: session.profile.type,
        measurements,
        rawBytes: new Uint8Array(value.buffer),
        timestamp: new Date().toISOString(),
        appointmentId: context?.appointmentId,
        patientId: context?.patientId
      });
    };

    session.characteristic.addEventListener('characteristicvaluechanged', handler);

    return () => {
      session.characteristic.removeEventListener('characteristicvaluechanged', handler);
      session.characteristic.stopNotifications().catch(() => {});
    };
  }

  if (props.read) {
    const poll = async () => {
      const reading = await readMeasurement(session, context);
      onReading(reading);
    };
    await poll();
    const intervalId = window.setInterval(() => {
      void poll().catch(() => {});
    }, 2000);
    return () => window.clearInterval(intervalId);
  }

  throw new Error(
    'Device connected but the data channel does not support notifications or read. Use the official Spirofy app for this hardware.'
  );
}

export async function disconnectDevice(): Promise<void> {
  if (activeSession?.server?.connected) {
    activeSession.server.disconnect();
  }
  activeSession = null;
}

export function getActiveSession(): BluetoothSession | null {
  return activeSession;
}

/** Exported for unit tests. */
export function parseDeviceData(deviceKey: string, value: DataView): Record<string, number | null> {
  switch (deviceKey) {
    case 'SPIROFY_CIPLA':
    case 'SPIROFY_SCAN_ALL':
    case 'MIR_SPIROBANK':
    case 'NUVOAIR_AIR_NEXT':
    case 'GENERIC_SPIROMETER':
      return parseSpirometerData(value);
    case 'GENERIC_OXIMETER':
      return parseOximeterData(value);
    case 'GENERIC_BP_MONITOR':
      return parseBPData(value);
    case 'GENERIC_GLUCOMETER':
      return parseGlucometerData(value);
    case 'GENERIC_THERMOMETER':
      return parseThermometerData(value);
    default:
      return { raw: value.byteLength > 0 ? value.getUint8(0) : null };
  }
}

function parseSpirometerData(value: DataView): Record<string, number | null> {
  try {
    const fev1 = value.byteLength >= 3 ? value.getInt16(1, true) / 100 : null;
    const fvc = value.byteLength >= 5 ? value.getInt16(3, true) / 100 : null;
    const pef = value.byteLength >= 7 ? value.getInt16(5, true) : null;
    const fev1_fvc_ratio =
      fev1 != null && fvc != null && fvc > 0 ? parseFloat(((fev1 / fvc) * 100).toFixed(1)) : null;
    return { fev1, fvc, pef, fev1_fvc_ratio };
  } catch {
    return { fev1: null, fvc: null, pef: null, fev1_fvc_ratio: null };
  }
}

function parseOximeterData(value: DataView): Record<string, number | null> {
  try {
    const spo2 = value.byteLength >= 2 ? value.getUint8(1) : null;
    const pulse_rate = value.byteLength >= 5 ? value.getUint16(2, true) : null;
    return { spo2, pulse_rate };
  } catch {
    return { spo2: null, pulse_rate: null };
  }
}

function parseBPData(value: DataView): Record<string, number | null> {
  try {
    const systolic = value.byteLength >= 3 ? value.getUint16(1, true) : null;
    const diastolic = value.byteLength >= 5 ? value.getUint16(3, true) : null;
    const pulse = value.byteLength >= 15 ? value.getUint16(14, true) : null;
    return { systolic, diastolic, pulse };
  } catch {
    return { systolic: null, diastolic: null, pulse: null };
  }
}

function parseGlucometerData(value: DataView): Record<string, number | null> {
  try {
    const glucose_level = value.byteLength >= 3 ? value.getUint16(1, true) : null;
    return { glucose_level };
  } catch {
    return { glucose_level: null };
  }
}

function parseThermometerData(value: DataView): Record<string, number | null> {
  try {
    const temperature_celsius =
      value.byteLength >= 3 ? value.getInt16(1, true) / 100 : null;
    return { temperature_celsius };
  } catch {
    return { temperature_celsius: null };
  }
}
