import * as ImagePicker from 'expo-image-picker';

import { normalizeUploadMimeType } from '@/api/multipart';

export type PickedPrescriptionFile = {
  uri: string;
  name: string;
  mimeType: string;
};

function fromAsset(asset: ImagePicker.ImagePickerAsset): PickedPrescriptionFile {
  const name = asset.fileName?.trim() || `prescription-${Date.now()}.jpg`;
  const mimeType = asset.mimeType?.trim() || 'image/jpeg';
  return {
    uri: asset.uri,
    name,
    mimeType: normalizeUploadMimeType(name, mimeType)
  };
}

export async function pickPrescriptionImagesFromLibrary(maxFiles: number): Promise<PickedPrescriptionFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to upload prescriptions');
  }
  const limit = Math.max(1, maxFiles);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map(fromAsset);
}

export async function capturePrescriptionPhoto(): Promise<PickedPrescriptionFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required to photograph prescriptions');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromAsset(result.assets[0]);
}
