export { isWebBluetoothSupported, getBluetoothUnsupportedReason } from './bluetooth/bluetoothSupport';
export {
  DEVICE_REGISTRY,
  DEVICE_TYPES,
  DEVICE_TYPE_LABELS,
  DEVICE_TYPE_ICONS,
  devicesForType,
  type DeviceType,
  type BluetoothDeviceProfile
} from './bluetooth/deviceRegistry';
export {
  connectDevice,
  disconnectDevice,
  readMeasurement,
  subscribeToNotifications,
  getActiveSession,
  parseDeviceData
} from './bluetooth/bluetoothService';
export type { BluetoothReading, BluetoothSession, BluetoothStatus } from './bluetooth/types';
export { useBluetoothDevice, type UseBluetoothDeviceOptions, type UseBluetoothDeviceReturn } from './vue/useBluetoothDevice';
export { default as DynBluetoothDevices } from './vue/components/DynBluetoothDevices.vue';
export { default as BluetoothUnsupportedBanner } from './vue/components/BluetoothUnsupportedBanner.vue';
export { default as BluetoothReadingDisplay } from './vue/components/BluetoothReadingDisplay.vue';
