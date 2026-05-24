import { cacheDirectory, copyAsync } from 'expo-file-system/legacy';

/** Copy content/ph URIs to a local file:// path so RN multipart upload can read the bytes. */
export async function ensureUploadableFileUri(uri: string, fileName: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Missing file URI');
  }
  if (trimmed.startsWith('file://')) {
    return trimmed;
  }

  const needsCopy =
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://');

  if (!needsCopy) {
    return trimmed.startsWith('/') ? `file://${trimmed}` : trimmed;
  }

  const safeName = (fileName.trim() || `prescription-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cacheDirectory) {
    throw new Error('Cannot prepare file for upload');
  }
  const dest = `${cacheDirectory}rx-upload-${Date.now()}-${safeName}`;
  await copyAsync({ from: trimmed, to: dest });
  return dest.startsWith('file://') ? dest : `file://${dest}`;
}
