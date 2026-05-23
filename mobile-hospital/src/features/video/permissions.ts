import { PermissionsAndroid, Platform } from 'react-native';

export async function ensureCallPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permissions = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  ];
  const bluetoothConnect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  if (bluetoothConnect && Number(Platform.Version) >= 31) {
    permissions.push(bluetoothConnect);
  }
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}
