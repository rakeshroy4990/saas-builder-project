export type DeviceType =
  | 'spirometer'
  | 'pulse_oximeter'
  | 'bp_monitor'
  | 'glucometer'
  | 'thermometer';

export const DEVICE_TYPES: DeviceType[] = [
  'spirometer',
  'pulse_oximeter',
  'bp_monitor',
  'glucometer',
  'thermometer'
];

export interface BluetoothDeviceProfile {
  type: DeviceType;
  label: string;
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
}

export const DEVICE_REGISTRY: Record<string, BluetoothDeviceProfile> = {
  MIR_SPIROBANK: {
    type: 'spirometer',
    label: 'MIR Spirobank',
    icon: '🫁',
    serviceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef', 'fev1_fvc_ratio'],
    unit: 'L / L/min',
    requiresUserAction: 'Blow steadily into the mouthpiece when prompted.'
  },
  NUVOAIR_AIR_NEXT: {
    type: 'spirometer',
    label: 'NuvoAir Air Next',
    icon: '🫁',
    serviceUUIDs: ['00001800-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '00002a00-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef'],
    unit: 'L / L/min',
    requiresUserAction: 'Breathe in fully, then blow out as hard and fast as possible.'
  },
  GENERIC_SPIROMETER: {
    type: 'spirometer',
    label: 'Generic Spirometer',
    icon: '🫁',
    serviceUUIDs: ['0000fff0-0000-1000-8000-00805f9b34fb'],
    characteristicUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    measurementKeys: ['fev1', 'fvc', 'pef'],
    unit: 'L / L/min',
    requiresUserAction: 'Follow instructions on your spirometer device.'
  },
  GENERIC_OXIMETER: {
    type: 'pulse_oximeter',
    label: 'Pulse Oximeter',
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
  }
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  spirometer: 'Spirometer',
  pulse_oximeter: 'Pulse Oximeter',
  bp_monitor: 'Blood Pressure Monitor',
  glucometer: 'Glucometer',
  thermometer: 'Thermometer'
};

export const DEVICE_TYPE_ICONS: Record<DeviceType, string> = {
  spirometer: '🫁',
  pulse_oximeter: '❤️',
  bp_monitor: '🩺',
  glucometer: '🩸',
  thermometer: '🌡️'
};

export function devicesForType(type: DeviceType): Array<{ key: string; profile: BluetoothDeviceProfile }> {
  return Object.entries(DEVICE_REGISTRY)
    .filter(([, profile]) => profile.type === type)
    .map(([key, profile]) => ({ key, profile }));
}
