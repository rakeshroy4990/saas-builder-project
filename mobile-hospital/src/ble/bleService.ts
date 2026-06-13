import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Characteristic, type Device } from 'react-native-ble-plx';

import { base64ToBytes, parseScaleWeightKg } from '@/ble/scaleParser';

const SCALE_SERVICE = '0000181b-0000-1000-8000-00805f9b34fb';
const SCALE_CHAR = '00002a9c-0000-1000-8000-00805f9b34fb';
const SCALE_NAME_PREFIXES = ['MI_SCALE', 'MIBCS', 'XMTZC', 'MI SCALE', 'Mi Scale'];

export type ScaleReading = {
  weightKg: number;
  recordedAt: string;
};

let manager: BleManager | null = null;

function bleManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

function matchesScaleName(name: string | null | undefined): boolean {
  const normalized = String(name ?? '').trim().toUpperCase();
  if (!normalized) return false;
  return SCALE_NAME_PREFIXES.some((prefix) => normalized.includes(prefix.toUpperCase()));
}

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const sdk = Number(Platform.Version);
  if (sdk < 31) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  ]);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

function parseCharacteristicValue(characteristic: Characteristic): number | null {
  const value = characteristic.value;
  if (!value) return null;
  return parseScaleWeightKg(base64ToBytes(value));
}

export async function startScaleMonitoring(
  onReading: (reading: ScaleReading) => void,
  onStatus: (status: string) => void
): Promise<() => Promise<void>> {
  const allowed = await ensureBlePermissions();
  if (!allowed) {
    onStatus('Bluetooth permission denied');
    throw new Error('BLUETOOTH_PERMISSION_DENIED');
  }

  const ble = bleManager();
  onStatus('Scanning for scale…');

  return new Promise((resolve, reject) => {
    let connectedDevice: Device | null = null;
    let subscription: { remove: () => void } | null = null;
    const timeout = setTimeout(() => {
      void ble.stopDeviceScan();
      onStatus('No scale found. Step on the scale and try again.');
      reject(new Error('SCALE_NOT_FOUND'));
    }, 20000);

    ble.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        clearTimeout(timeout);
        onStatus(error.message || 'Scan failed');
        reject(error);
        return;
      }
      if (!device || (!matchesScaleName(device.name) && !device.serviceUUIDs?.includes(SCALE_SERVICE))) {
        return;
      }

      clearTimeout(timeout);
      await ble.stopDeviceScan();
      onStatus(`Connecting to ${device.name ?? 'scale'}…`);

      try {
        connectedDevice = await device.connect();
        await connectedDevice.discoverAllServicesAndCharacteristics();
        subscription = connectedDevice.monitorCharacteristicForService(
          SCALE_SERVICE,
          SCALE_CHAR,
          (monitorError, characteristic) => {
            if (monitorError || !characteristic) {
              onStatus(monitorError?.message ?? 'Read failed');
              return;
            }
            const weightKg = parseCharacteristicValue(characteristic);
            if (weightKg == null) {
              onStatus('Waiting for stable weight…');
              return;
            }
            onStatus(`Weight: ${weightKg.toFixed(2)} kg`);
            onReading({ weightKg, recordedAt: new Date().toISOString() });
          }
        );
        onStatus('Connected. Step on the scale.');
        resolve(async () => {
          subscription?.remove();
          if (connectedDevice) {
            try {
              await connectedDevice.cancelConnection();
            } catch {
              // ignore disconnect errors
            }
          }
        });
      } catch (connectError) {
        onStatus(connectError instanceof Error ? connectError.message : 'Connection failed');
        reject(connectError);
      }
    });
  });
}

export async function destroyBleManager(): Promise<void> {
  if (manager) {
    await manager.destroy();
    manager = null;
  }
}
