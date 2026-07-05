import { resolveSpringApiUrl } from '@saas-builder/hospital-api-client';
import type { UploadResult } from 'expo-file-system';

import { getOrCreateTraceId } from '@/analytics/sessionTelemetry';
import { useSessionStore } from '@/auth/sessionStore';
import { fetchWithTimeout } from '@/api/fetchWithTimeout';
import { ensureFreshAccessToken, refreshAccessToken } from '@/api/client';
import { getMobileApiBaseUrl } from '@/api/config';
import { UPLOAD_API_TIMEOUT_MS } from '@/api/timeouts';
import { ensureUploadableFileUri } from '@/api/ensureUploadableUri';
import { normalizeUploadMimeType } from '@/api/multipart';
import { mapMultipartFetchError } from '@/api/multipartErrors';

async function loadExpoUploadFile(readableUri: string) {
  const { File } = await import('expo-file-system');
  return new File(readableUri);
}

export type MultipartFetchOptions = {
  timeoutMs?: number;
};

async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const top = String(j.message ?? j.Message ?? '').trim();
    if (top) return top;
  } catch {
    // use raw body
  }
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 500) || `HTTP ${res.status}`;
}

function parseUploadResultBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(body.replace(/\s+/g, ' ').trim().slice(0, 500) || 'Upload failed');
  }
}

function readUploadFailure(result: UploadResult): string {
  try {
    const j = JSON.parse(result.body) as Record<string, unknown>;
    const top = String(j.message ?? j.Message ?? '').trim();
    if (top) return top;
  } catch {
    // use raw body
  }
  const compact = result.body.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 500) || `HTTP ${result.status}`;
}

/**
 * Multipart file upload via expo-file-system `File.upload`.
 * Expo's fetch cannot serialize `{ uri, name, type }` FormData parts (winter fetch).
 */
export async function postMultipartLocalFile(
  path: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  options?: { fieldName?: string }
): Promise<unknown> {
  const fieldName = options?.fieldName ?? 'file';
  const name = fileName.trim() || `upload-${Date.now()}.jpg`;
  const type = normalizeUploadMimeType(name, mimeType);
  const readableUri = await ensureUploadableFileUri(fileUri, name);
  const file = await loadExpoUploadFile(readableUri);
  const url = resolveSpringApiUrl(getMobileApiBaseUrl(), path);

  const runUpload = async (): Promise<UploadResult> => {
    const { UploadType } = await import('expo-file-system');
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return file.upload(url, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName,
      mimeType: type,
      headers
    });
  };

  try {
    await ensureFreshAccessToken();

    let result = await runUpload();
    if (result.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        result = await runUpload();
      }
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(readUploadFailure(result));
    }

    return parseUploadResultBody(result.body);
  } catch (err) {
    throw mapMultipartFetchError(err);
  }
}

/**
 * Multipart POST via fetch for string fields only.
 */
export async function postMultipart(
  path: string,
  formData: FormData,
  options?: MultipartFetchOptions
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? UPLOAD_API_TIMEOUT_MS;
  const url = resolveSpringApiUrl(getMobileApiBaseUrl(), path);

  const runFetch = async (): Promise<Response> => {
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: formData
      },
      timeoutMs
    );
  };

  try {
    await ensureFreshAccessToken();

    let res = await runFetch();
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        res = await runFetch();
      }
    }

    if (!res.ok) {
      const detail = await readHttpErrorDetail(res);
      throw new Error(detail || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    throw mapMultipartFetchError(err);
  }
}
