import { COMMON_BLE_OPTIONAL_SERVICES } from './commonBleServices';
import { withTimeout } from './bluetoothTimeout';

const GATT_ENUM_TIMEOUT_MS = 4_000;

function scoreCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): number {
  const p = characteristic.properties;
  if (p.notify) return 100;
  if (p.indicate) return 90;
  if (p.read) return 50;
  if (p.writeWithoutResponse) return 20;
  if (p.write) return 10;
  return 0;
}

async function characteristicsFromService(
  service: BluetoothRemoteGATTService
): Promise<BluetoothRemoteGATTCharacteristic[]> {
  try {
    return await service.getCharacteristics();
  } catch {
    return [];
  }
}

/**
 * Find the best notify/read (or write) characteristic across permitted service UUIDs.
 */
export async function discoverBestDataCharacteristic(
  server: BluetoothRemoteGATTServer,
  serviceUuids: string[]
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  let bestCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  let bestScore = 0;

  const consider = (characteristic: BluetoothRemoteGATTCharacteristic) => {
    const score = scoreCharacteristic(characteristic);
    if (score > bestScore) {
      bestScore = score;
      bestCharacteristic = characteristic;
    }
  };

  for (const serviceUuid of serviceUuids) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const characteristic of await characteristicsFromService(service)) {
        consider(characteristic);
      }
    } catch {
      // Service not permitted or not present
    }
  }

  try {
    for (const service of await server.getPrimaryServices()) {
      for (const characteristic of await characteristicsFromService(service)) {
        consider(characteristic);
      }
    }
  } catch {
    // ignore
  }

  return bestScore > 0 ? bestCharacteristic : null;
}

/** Services to request at pairing time (profile + common medical/vendor UUIDs). */
export function mergeOptionalServiceUuids(profileServiceUuids: string[]): string[] {
  return [...new Set([...COMMON_BLE_OPTIONAL_SERVICES, ...profileServiceUuids])];
}

/** Short GATT map for error messages (helps identify Spirofy proprietary UUIDs). */
export async function formatGattInspection(
  server: BluetoothRemoteGATTServer,
  serviceUuids: string[]
): Promise<string> {
  const lines: string[] = [];
  let any = false;

  for (const serviceUuid of serviceUuids) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      any = true;
      lines.push(`service ${service.uuid}`);
      for (const ch of await characteristicsFromService(service)) {
        const p = ch.properties;
        lines.push(
          `  char ${ch.uuid} (notify=${p.notify} read=${p.read} write=${p.write})`
        );
      }
    } catch {
      // not visible
    }
  }

  try {
    for (const service of await server.getPrimaryServices()) {
      any = true;
      lines.push(`service ${service.uuid} (advertised)`);
      for (const ch of await characteristicsFromService(service)) {
        const p = ch.properties;
        lines.push(
          `  char ${ch.uuid} (notify=${p.notify} read=${p.read} write=${p.write})`
        );
      }
    }
  } catch {
    lines.push('(could not enumerate advertised services)');
  }

  if (!any) {
    return formatOsPairingConflictHint();
  }

  return lines.slice(0, 12).join('; ');
}

export function formatOsPairingConflictHint(): string {
  return (
    'No GATT services visible. Forget the device in chrome://bluetooth-internals, reload this page, and pair again from Connect device only.'
  );
}

export function isSpirofyGattBlockedMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes('cannot see any BLE GATT services on the spirometer');
}

/** Shown when LIVSMT / Spirofy connects at the link layer but exposes zero GATT to the web. */
export function formatSpirofyGattBlockedHint(deviceLabel: string): string {
  return (
    `Connected to "${deviceLabel}", but this browser cannot see any BLE GATT services on the spirometer. ` +
    'In chrome://bluetooth-internals, empty Services and "GATT Connected: Not Connected" are normal until this page is actively connected—open internals in another tab while status here shows Connected, then Inspect the same LIVSMT device. ' +
    'If Services is still empty while connected here, Spirofy may only work with the official mobile app (quit Spirofy, power-cycle the device, retry). Enter spirometry results manually until vendor Web Bluetooth UUIDs are available.'
  );
}

export async function countAccessibleGattServices(
  server: BluetoothRemoteGATTServer,
  serviceUuids: string[]
): Promise<{ fromOptionalList: number; fromAdvertisement: number }> {
  let fromOptionalList = 0;
  for (const serviceUuid of serviceUuids) {
    try {
      await server.getPrimaryService(serviceUuid);
      fromOptionalList++;
    } catch {
      // not permitted or missing
    }
  }
  let fromAdvertisement = 0;
  try {
    const services = await withTimeout(
      server.getPrimaryServices(),
      GATT_ENUM_TIMEOUT_MS,
      'Timed out reading Bluetooth services'
    );
    fromAdvertisement = services.length;
  } catch {
    fromAdvertisement = 0;
  }
  return { fromOptionalList, fromAdvertisement };
}
