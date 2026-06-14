import { SPIROFY_BLE_ADVERTISED_SERVICES, SPIROFY_VENDOR_SERVICES } from './spirofyBleServices';

export type DeviceType =
  | 'spirometer'
  | 'pulse_oximeter'
  | 'bp_monitor'
  | 'glucometer'
  | 'thermometer'
  | 'scale';

export const DEVICE_TYPES: DeviceType[] = [
  'spirometer',
  'pulse_oximeter',
  'bp_monitor',
  'glucometer',
  'thermometer',
  'scale'
];

export interface BluetoothDeviceProfile {
  type: DeviceType;
  label: string;
  /** vue-i18n key under devices.bluetooth.profiles.* */
  labelI18nKey?: string;
  requiresUserActionI18nKey?: string;
  icon: string;
  serviceUUIDs: string[];
  characteristicUUID: string;
  measurementKeys: string[];
  unit: string;
  requiresUserAction: string;
  /**
   * List every nearby BLE device in the browser picker (not only devices advertising
   * `serviceUUIDs`). Required for most consumer thermometers/oximeters that use vendor UUIDs.
   */
  acceptAllDevices?: boolean;
  /** GATT services to access after pairing when using `acceptAllDevices`. */
  optionalServiceUUIDs?: string[];
  /** Alternate characteristics to try per service UUID (e.g. Environmental Sensing temp). */
  alternateCharacteristics?: Record<string, string[]>;
  /** Shown in picker when set; use with `acceptAllDevices` for vendor hardware (e.g. Spirofy). */
  namePrefixes?: string[];
  /** Exact BLE names from bluetooth-internals (e.g. "LIVSMT-RO-EA2C"). */
  exactDeviceNames?: string[];
  /**
   * Pair by device name (not acceptAllDevices). Required for Spirofy: Chrome then grants
   * every service UUID advertised by that device.
   */
  preferNameBasedPairing?: boolean;
  /** Extra OR filters in the device picker (e.g. vendor service UUIDs). */
  pickerServiceFilters?: string[];
}

export const DEVICE_REGISTRY: Record<string, BluetoothDeviceProfile> = {
  SPIROFY_CIPLA: {
    type: 'spirometer',
    label: 'Spirofy (Cipla)',
    icon: '🫁',
    serviceUUIDs: [...SPIROFY_VENDOR_SERVICES, '0000fff0-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef', 'fev1_fvc_ratio'],
    unit: 'L / L/min',
    acceptAllDevices: false,
    preferNameBasedPairing: true,
    namePrefixes: ['LIVSMT', 'LIVSMT-RO', 'Spirofy', 'SPIROFY', 'spirofy', 'Cipla', 'Dr Swati'],
    exactDeviceNames: ['LIVSMT-RO-EA2C', 'LIVSMT-RO-36BC', 'Dr Swati Pandey'],
    pickerServiceFilters: [...SPIROFY_VENDOR_SERVICES],
    optionalServiceUUIDs: [
      ...SPIROFY_BLE_ADVERTISED_SERVICES,
      '0000fff0-0000-1000-8000-00805f9b34fb',
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      '00001800-0000-1000-8000-00805f9b34fb',
      '0000180a-0000-1000-8000-00805f9b34fb',
      '0000180f-0000-1000-8000-00805f9b34fb'
    ],
    alternateCharacteristics: {
      '0000fff0-0000-1000-8000-00805f9b34fb': [
        '0000fff2-0000-1000-8000-00805f9b34fb',
        '0000fff3-0000-1000-8000-00805f9b34fb'
      ],
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e': [
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
      ]
    },
    requiresUserAction:
      'Quit the Spirofy phone app. "Paired" in Chrome means this site used the device before — Forget each LIVSMT-RO-… in chrome://bluetooth-internals (not finding it in macOS Settings is normal). Power on the spirometer, connect here, pick LIVSMT-RO-36BC or EA2C, then start a test blow.'
  },
  SPIROFY_SCAN_ALL: {
    type: 'spirometer',
    label: 'Spirofy (scan all — fallback)',
    icon: '🫁',
    serviceUUIDs: [...SPIROFY_VENDOR_SERVICES],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef', 'fev1_fvc_ratio'],
    unit: 'L / L/min',
    acceptAllDevices: true,
    optionalServiceUUIDs: [
      ...SPIROFY_BLE_ADVERTISED_SERVICES,
      '0000fff0-0000-1000-8000-00805f9b34fb',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
    ],
    requiresUserAction:
      'Fallback only if "Spirofy (Cipla)" does not list your device. Pick LIVSMT-RO-… from the full BLE list. Prefer "Spirofy (Cipla)" when possible.'
  },
  MIR_SPIROBANK: {
    type: 'spirometer',
    label: 'MIR Spirobank',
    labelI18nKey: 'devices.bluetooth.profiles.MIR_SPIROBANK.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.MIR_SPIROBANK.action',
    icon: '🫁',
    serviceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef', 'fev1_fvc_ratio'],
    unit: 'L / L/min',
    acceptAllDevices: true,
    optionalServiceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    requiresUserAction: 'Blow steadily into the mouthpiece when prompted.'
  },
  NUVOAIR_AIR_NEXT: {
    type: 'spirometer',
    label: 'NuvoAir Air Next',
    labelI18nKey: 'devices.bluetooth.profiles.NUVOAIR_AIR_NEXT.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.NUVOAIR_AIR_NEXT.action',
    icon: '🫁',
    serviceUUIDs: ['00001800-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a00-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef'],
    unit: 'L / L/min',
    acceptAllDevices: true,
    optionalServiceUUIDs: ['00001800-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb'],
    requiresUserAction: 'Breathe in fully, then blow out as hard and fast as possible.'
  },
  GENERIC_SPIROMETER: {
    type: 'spirometer',
    label: 'Generic Spirometer',
    labelI18nKey: 'devices.bluetooth.profiles.GENERIC_SPIROMETER.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.GENERIC_SPIROMETER.action',
    icon: '🫁',
    serviceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef'],
    unit: 'L / L/min',
    acceptAllDevices: true,
    optionalServiceUUIDs: [
      '0000fff0-0000-1000-8000-00805f9b34fb',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      '00001800-0000-1000-8000-00805f9b34fb'
    ],
    alternateCharacteristics: {
      '0000fff0-0000-1000-8000-00805f9b34fb': ['0000fff2-0000-1000-8000-00805f9b34fb'],
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e': [
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
      ]
    },
    requiresUserAction:
      'Turn the spirometer on. In the browser list, pick your device by name — generic filters often hide BLE spirometers until you use this broad scan.'
  },
  GENERIC_OXIMETER: {
    type: 'pulse_oximeter',
    label: 'Pulse Oximeter',
    labelI18nKey: 'devices.bluetooth.profiles.GENERIC_OXIMETER.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.GENERIC_OXIMETER.action',
    icon: '❤️',
    serviceUUIDs: ['00001822-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a5f-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['spo2', 'pulse_rate'],
    unit: '% / BPM',
    requiresUserAction: 'Place your finger inside the oximeter clip.',
    acceptAllDevices: true,
    optionalServiceUUIDs: ['00001822-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb']
  },
  GENERIC_BP_MONITOR: {
    type: 'bp_monitor',
    label: 'Blood Pressure Monitor',
    labelI18nKey: 'devices.bluetooth.profiles.GENERIC_BP_MONITOR.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.GENERIC_BP_MONITOR.action',
    icon: '🩺',
    serviceUUIDs: ['00001810-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a35-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['systolic', 'diastolic', 'pulse'],
    unit: 'mmHg / BPM',
    requiresUserAction: 'Wrap the cuff around your upper arm and stay still.',
    acceptAllDevices: true,
    optionalServiceUUIDs: ['00001810-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb']
  },
  GENERIC_GLUCOMETER: {
    type: 'glucometer',
    label: 'Glucometer',
    labelI18nKey: 'devices.bluetooth.profiles.GENERIC_GLUCOMETER.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.GENERIC_GLUCOMETER.action',
    icon: '🩸',
    serviceUUIDs: ['00001808-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a18-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['glucose_level'],
    unit: 'mg/dL',
    requiresUserAction: 'Insert a test strip and apply a blood sample.',
    acceptAllDevices: true,
    optionalServiceUUIDs: ['00001808-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb']
  },
  GENERIC_THERMOMETER: {
    type: 'thermometer',
    label: 'Thermometer',
    labelI18nKey: 'devices.bluetooth.profiles.GENERIC_THERMOMETER.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.GENERIC_THERMOMETER.action',
    icon: '🌡️',
    serviceUUIDs: ['00001809-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a1c-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['temperature_celsius'],
    unit: '°C',
    acceptAllDevices: true,
    optionalServiceUUIDs: [
      '00001809-0000-1000-8000-00805f9b34fb',
      '0000181a-0000-1000-8000-00805f9b34fb',
      '0000fff0-0000-1000-8000-00805f9b34fb'
    ],
    alternateCharacteristics: {
      '0000181a-0000-1000-8000-00805f9b34fb': ['00002a6e-0000-1000-8000-00805f9b34fb']
    },
    requiresUserAction:
      'Turn the thermometer on and enable pairing mode if required. In the browser list, select your thermometer by name — most devices do not advertise a standard health service until connected.'
  },
  XIAOMI_MI_SCALE: {
    type: 'scale',
    label: 'Smart Scale (Mi / body composition)',
    labelI18nKey: 'devices.bluetooth.profiles.XIAOMI_MI_SCALE.label',
    requiresUserActionI18nKey: 'devices.bluetooth.profiles.XIAOMI_MI_SCALE.action',
    icon: '⚖️',
    serviceUUIDs: ['0000181b-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a9c-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['weight_kg'],
    unit: 'kg',
    acceptAllDevices: true,
    namePrefixes: ['MI_SCALE', 'MIBCS', 'XMTZC', 'Mi Scale'],
    optionalServiceUUIDs: ['0000181b-0000-1000-8000-00805f9b34fb'],
    requiresUserAction: 'Step on the scale barefoot and wait until the reading stabilizes.'
  }
};

export const DEVICE_TYPE_LABEL_I18N: Record<DeviceType, string> = {
  spirometer: 'devices.bluetooth.types.spirometer',
  pulse_oximeter: 'devices.bluetooth.types.pulse_oximeter',
  bp_monitor: 'devices.bluetooth.types.bp_monitor',
  glucometer: 'devices.bluetooth.types.glucometer',
  thermometer: 'devices.bluetooth.types.thermometer',
  scale: 'devices.bluetooth.types.scale'
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  spirometer: 'Spirometer',
  pulse_oximeter: 'Pulse Oximeter',
  bp_monitor: 'Blood Pressure Monitor',
  glucometer: 'Glucometer',
  thermometer: 'Thermometer',
  scale: 'Smart Scale'
};

export const DEVICE_TYPE_ICONS: Record<DeviceType, string> = {
  spirometer: '🫁',
  pulse_oximeter: '❤️',
  bp_monitor: '🩺',
  glucometer: '🩸',
  thermometer: '🌡️',
  scale: '⚖️'
};

export function devicesForType(type: DeviceType): Array<{ key: string; profile: BluetoothDeviceProfile }> {
  return Object.entries(DEVICE_REGISTRY)
    .filter(([, profile]) => profile.type === type)
    .sort(([keyA], [keyB]) => {
      if (type === 'spirometer') {
        if (keyA === 'SPIROFY_CIPLA') return -1;
        if (keyB === 'SPIROFY_CIPLA') return 1;
        if (keyA === 'SPIROFY_SCAN_ALL') return 1;
        if (keyB === 'SPIROFY_SCAN_ALL') return -1;
      }
      return keyA.localeCompare(keyB);
    })
    .map(([key, profile]) => ({ key, profile }));
}
