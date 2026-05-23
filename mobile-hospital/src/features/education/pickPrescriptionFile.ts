import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@/features/education/prescriptionTranscribe';

function fromImageAsset(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const uri = asset.uri;
  const name = asset.fileName?.trim() || `prescription-${Date.now()}.jpg`;
  const mimeType = asset.mimeType?.trim() || 'image/jpeg';
  return { uri, name, mimeType };
}

export async function pickPrescriptionFromDocuments(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name?.trim() || `prescription-${Date.now()}`,
    mimeType: asset.mimeType?.trim() || 'application/octet-stream'
  };
}

export async function pickPrescriptionFromGallery(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImageAsset(result.assets[0]);
}

export async function pickPrescriptionFromCamera(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImageAsset(result.assets[0]);
}
