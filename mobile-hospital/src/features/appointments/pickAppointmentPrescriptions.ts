import * as ImagePicker from 'expo-image-picker';

import { normalizeUploadMimeType } from '@/api/multipart';

import type { PickedPrescriptionImage } from './bookingTypes';

function fromAsset(asset: ImagePicker.ImagePickerAsset): PickedPrescriptionImage {
  const name = asset.fileName?.trim() || `prescription-${Date.now()}.jpg`;
  const mimeType = asset.mimeType?.trim() || 'image/jpeg';
  return {
    uri: asset.uri,
    name,
    mimeType: normalizeUploadMimeType(name, mimeType)
  };
}

export async function pickAppointmentPrescriptionImages(
  currentCount: number,
  maxFiles: number
): Promise<PickedPrescriptionImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to attach images');
  }
  const remaining = Math.max(0, maxFiles - currentCount);
  if (remaining === 0) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining
  });
  if (result.canceled || !result.assets?.length) {
    return [];
  }
  return result.assets.slice(0, remaining).map(fromAsset);
}
