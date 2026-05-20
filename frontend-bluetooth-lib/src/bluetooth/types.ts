import type { BluetoothDeviceProfile, DeviceType } from './deviceRegistry';

export interface BluetoothReading {
  deviceKey: string;
  deviceName: string;
  deviceType: DeviceType;
  measurements: Record<string, number | null>;
  rawBytes?: Uint8Array;
  timestamp: string;
  appointmentId?: string;
  patientId?: string;
}

export interface BluetoothSession {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  characteristic: BluetoothRemoteGATTCharacteristic;
  profile: BluetoothDeviceProfile;
  deviceKey: string;
}

export type BluetoothStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'error'
  | 'unsupported'
  | 'disconnected';
