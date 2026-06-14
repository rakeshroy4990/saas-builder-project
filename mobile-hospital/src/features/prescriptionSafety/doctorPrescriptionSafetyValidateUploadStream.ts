import { resolveSpringApiUrl, SERVER_PATHS } from '@saas-builder/hospital-api-client';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';

import { getOrCreateTraceId } from '@/analytics/sessionTelemetry';
import { useSessionStore } from '@/auth/sessionStore';
import { fetchWithAuthRetry } from '@/api/client';
import { getMobileApiBaseUrl } from '@/api/config';
import { ensureUploadableFileUri } from '@/api/ensureUploadableUri';
import { normalizeUploadMimeType } from '@/api/multipart';
import { PRESCRIPTION_VALIDATE_STREAM_TIMEOUT_MS } from '@/api/timeouts';
import { activeMobileLocale } from '@/i18n/locale';
import type { PickedPrescriptionFile } from '@/features/prescriptions/pickPrescriptionImages';

import { parseDoctorValidation } from './prescriptionSafetyParse';
import type { DoctorChildContext, PrescriptionValidationResult } from './prescriptionSafetyTypes';

export type DoctorPrescriptionTranscribedPreview = {
  medicines: string[];
  childWeightKg: number | null;
  childAgeMonths: number | null;
  temperatureF: number | null;
  weightSource: string;
};

export type DoctorPrescriptionValidateUploadStreamHandlers = {
  onReady?: () => void;
  onStatus?: (phase: string) => void;
  onTranscribed?: (preview: DoctorPrescriptionTranscribedPreview) => void;
  onDelta?: (text: string) => void;
  onComplete?: (result: PrescriptionValidationResult) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (v == null || v === '') continue;
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function parseTranscribedPreview(payload: unknown): DoctorPrescriptionTranscribedPreview | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const medicinesRaw = row.Medicines ?? row.medicines;
  const medicines = Array.isArray(medicinesRaw)
    ? medicinesRaw.map((v) => String(v).trim()).filter(Boolean)
    : [];
  return {
    medicines,
    childWeightKg: pickNumber(row, 'ChildWeightKg', 'childWeightKg'),
    childAgeMonths: pickNumber(row, 'ChildAgeMonths', 'childAgeMonths'),
    temperatureF: pickNumber(row, 'TemperatureF', 'temperatureF'),
    weightSource: pickString(row, 'WeightSource', 'weightSource') || 'not_available'
  };
}

function isJsonEnvelope(obj: Record<string, unknown>): boolean {
  return 'Success' in obj || 'success' in obj || 'Data' in obj || 'data' in obj;
}

function dispatchNdjsonLine(
  line: string,
  handlers: DoctorPrescriptionValidateUploadStreamHandlers,
  sawComplete: { value: boolean },
  onResult: (result: PrescriptionValidationResult) => void
): void {
  if (!line) return;
  let obj: NdjsonEvent;
  try {
    obj = JSON.parse(line) as NdjsonEvent;
  } catch {
    return;
  }

  const t = String(obj.type ?? obj.Type ?? '').trim().toLowerCase();
  if (!t && isJsonEnvelope(obj)) {
    const envelopeData = (obj.data ?? obj.Data) as unknown;
    const result = parseDoctorValidation(envelopeData);
    if (result) {
      sawComplete.value = true;
      onResult(result);
      handlers.onComplete?.(result);
    }
    return;
  }

  const payload = obj.data !== undefined && obj.data !== null ? obj.data : obj.Data;

  if (t === 'ready') handlers.onReady?.();
  if (t === 'ping') {
    // keep-alive
  }
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) handlers.onStatus?.(phase);
  }
  if (t === 'transcribed') {
    const preview = parseTranscribedPreview(payload);
    if (preview) handlers.onTranscribed?.(preview);
  }
  if (t === 'delta' || t === 'token') {
    const text = String(obj.text ?? obj.Text ?? '').trim();
    if (text) handlers.onDelta?.(text);
  }
  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const result = parseDoctorValidation(payload);
    if (!result) {
      throw new Error('doctor_prescription_validate_stream_invalid_complete');
    }
    sawComplete.value = true;
    onResult(result);
    handlers.onComplete?.(result);
  }
  if (t === 'error') {
    const data = payload;
    const msg =
      data && typeof data === 'object' && data !== null
        ? String((data as { message?: string }).message ?? '').trim()
        : '';
    const code =
      data && typeof data === 'object' && data !== null
        ? String((data as { errorCode?: string }).errorCode ?? '').trim()
        : '';
    sawComplete.value = true;
    const err = new Error(msg || 'doctor_prescription_validate_stream_error');
    if (code) (err as Error & { code?: string }).code = code;
    throw err;
  }
}

function appendChildContext(formData: FormData, ctx: DoctorChildContext): void {
  if (ctx.childProfileExternalId?.trim()) {
    formData.append('childProfileExternalId', ctx.childProfileExternalId.trim());
  }
  if (ctx.childAgeMonths != null && Number.isFinite(ctx.childAgeMonths)) {
    formData.append('childAgeMonths', String(ctx.childAgeMonths));
  }
  if (ctx.childWeightKg != null && Number.isFinite(ctx.childWeightKg)) {
    formData.append('childWeightKg', String(ctx.childWeightKg));
  }
}

async function buildMultipartForm(file: PickedPrescriptionFile, ctx: DoctorChildContext): Promise<FormData> {
  const name = file.name.trim() || `prescription-${Date.now()}.jpg`;
  const type = normalizeUploadMimeType(name, file.mimeType);
  const readableUri = await ensureUploadableFileUri(file.uri, name);
  const formData = new FormData();
  formData.append('file', {
    uri: readableUri,
    name,
    type
  } as unknown as Blob);
  appendChildContext(formData, ctx);
  return formData;
}

export async function postDoctorPrescriptionValidateUploadStream(
  file: PickedPrescriptionFile,
  ctx: DoctorChildContext,
  handlers: DoctorPrescriptionValidateUploadStreamHandlers,
  signal?: AbortSignal
): Promise<PrescriptionValidationResult | null> {
  const url = resolveSpringApiUrl(
    getMobileApiBaseUrl(),
    SERVER_PATHS.hospitalEducationPrescriptionSafetyValidateUploadStream
  );
  const formData = await buildMultipartForm(file, ctx);

  const runFetch = async (): Promise<Response> => {
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/x-ndjson',
      'Accept-Language': acceptLanguageHeaderValue(activeMobileLocale()),
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const signals: AbortSignal[] = [];
    if (typeof AbortSignal.timeout === 'function') {
      signals.push(AbortSignal.timeout(PRESCRIPTION_VALIDATE_STREAM_TIMEOUT_MS));
    }
    if (signal) {
      signals.push(signal);
    }
    const combinedSignal =
      signals.length > 1 && typeof AbortSignal.any === 'function'
        ? AbortSignal.any(signals)
        : signals[0];

    return fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: combinedSignal
    });
  };

  const res = await fetchWithAuthRetry(runFetch);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail.replace(/\s+/g, ' ').trim().slice(0, 500) || `HTTP ${res.status}`);
  }

  const contentType = String(res.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
    const envelope = (await res.json()) as Record<string, unknown>;
    const result = parseDoctorValidation(envelope.data ?? envelope.Data);
    if (!result) {
      throw new Error(String(envelope.Message ?? envelope.message ?? 'doctor_prescription_validate_failed'));
    }
    handlers.onComplete?.(result);
    return result;
  }

  if (!res.body) {
    throw new Error('doctor_prescription_validate_stream_no_body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const sawComplete = { value: false };
  let result: PrescriptionValidationResult | null = null;

  const onResult = (row: PrescriptionValidationResult): void => {
    result = row;
  };

  const drainBufferedLines = (): void => {
    for (;;) {
      const nl = buffer.indexOf('\n');
      if (nl < 0) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      dispatchNdjsonLine(line, handlers, sawComplete, onResult);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value && value.byteLength > 0) {
      buffer += decoder.decode(value, { stream: !done });
    }
    drainBufferedLines();
    if (done) {
      buffer += decoder.decode(new Uint8Array(), { stream: false });
      drainBufferedLines();
      const tail = buffer.trim();
      buffer = '';
      if (tail) {
        dispatchNdjsonLine(tail, handlers, sawComplete, onResult);
      }
      if (!sawComplete.value || !result) {
        throw new Error(
          `doctor_prescription_validate_stream_incomplete: stream ended before complete (tail=${tail.slice(0, 400)})`
        );
      }
      break;
    }
  }

  return result;
}
