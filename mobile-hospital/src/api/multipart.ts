import type { InternalAxiosRequestConfig } from 'axios';

/** Infer image/PDF mime when the picker returns application/octet-stream. */
export function normalizeUploadMimeType(fileName: string, mimeType: string): string {
  const declared = mimeType.trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') {
    return declared;
  }
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

export function isFormDataBody(data: unknown): data is FormData {
  return typeof FormData !== 'undefined' && data instanceof FormData;
}

/**
 * Axios defaults to application/json; Spring multipart endpoints return 415 unless
 * Content-Type is removed so the client can send multipart/form-data with a boundary.
 */
export function applyMultipartHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (!isFormDataBody(config.data)) return config;

  const headers = config.headers ?? {};
  if (typeof (headers as { delete?: (name: string) => void }).delete === 'function') {
    (headers as { delete: (name: string) => void }).delete('Content-Type');
    (headers as { delete: (name: string) => void }).delete('content-type');
  } else {
    const record = headers as Record<string, unknown>;
    delete record['Content-Type'];
    delete record['content-type'];
  }
  config.headers = headers;
  return config;
}
