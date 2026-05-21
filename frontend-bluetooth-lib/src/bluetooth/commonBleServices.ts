/**
 * GATT service UUIDs commonly used by medical / vendor BLE devices.
 * Listed in `optionalServices` so Web Bluetooth grants access after pairing.
 * @see https://webbluetoothcg.github.io/web-bluetooth/#dom-requestdeviceoptions-optionalservices
 */
export const COMMON_BLE_OPTIONAL_SERVICES: string[] = [
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
  '0000180a-0000-1000-8000-00805f9b34fb',
  '0000180f-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000fff2-0000-1000-8000-00805f9b34fb',
  '0000fff3-0000-1000-8000-00805f9b34fb',
  '0000fff4-0000-1000-8000-00805f9b34fb',
  '0000fff5-0000-1000-8000-00805f9b34fb',
  '0000fff6-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ffe2-0000-1000-8000-00805f9b34fb',
  '0000fe95-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  'e494e4b4-fee4-4f28-9f2f-aeb2cddfb69e',
  '00001822-0000-1000-8000-00805f9b34fb',
  '00001810-0000-1000-8000-00805f9b34fb'
];
