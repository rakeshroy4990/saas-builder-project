import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies, triggerHospitalReLoginFromFetch } from './apiClient';
import { getApiBaseUrl, SERVER_PATHS } from './apiPaths';
import {
  parseDoctorValidation,
  type DoctorChildContext
} from './doctorPrescriptionSafetyApi';
import type { PrescriptionValidationResult } from './patientPrescriptionValidationApi';

const STREAM_PATH = SERVER_PATHS.hospitalEducationPrescriptionSafetyValidateUploadStream;
const STREAM_TIMEOUT_MS = 300_000;

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

function buildStreamUrl(): string {
  const url = `${getApiBaseUrl()}${STREAM_PATH}`;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`doctor_prescription_validate_stream_bad_url: ${JSON.stringify(url)}`);
  }
  return url;
}

function buildStreamSignal(external?: AbortSignal): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return external;
  }
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
  if (external && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, external]);
  }
  return timeoutSignal;
}

function isJsonEnvelope(obj: Record<string, unknown>): boolean {
  return 'Success' in obj || 'success' in obj || 'Data' in obj || 'data' in obj;
}

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

async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const top = String(j.message ?? j.Message ?? '').trim();
    if (top) return top;
    const data = (j.data ?? j.Data) as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
      const nested = String(data.message ?? data.Message ?? '').trim();
      if (nested) return nested;
    }
  } catch {
    // use raw text
  }
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 800) || `HTTP ${res.status}`;
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
    // keep-alive during long vision / validation work
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

function isStreamTimeout(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'TimeoutError') return true;
  if (err instanceof Error && err.name === 'TimeoutError') return true;
  const msg = err instanceof Error ? err.message : '';
  return msg.includes('doctor_prescription_validate_stream_incomplete');
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

/**
 * POST `/api/hospital/education/prescription-safety/validate-upload/stream`
 * with `Accept: application/x-ndjson`.
 * Pattern: {@link postTriageAnalyzeNdjson} in `triageAnalyzeStream.ts`.
 */
export async function postDoctorPrescriptionValidateUploadStream(
  file: File,
  ctx: DoctorChildContext,
  handlers: DoctorPrescriptionValidateUploadStreamHandlers,
  signal?: AbortSignal
): Promise<PrescriptionValidationResult | null> {
  const url = buildStreamUrl();
  const formData = new FormData();
  formData.append('file', file);
  appendChildContext(formData, ctx);

  await ensureAccessTokenFreshForFetch();
  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/x-ndjson',
      'X-Trace-Id': getOrCreateTraceId()
    },
    body: formData,
    signal: buildStreamSignal(signal)
  };

  let res = await fetch(url, requestInit);
  if (res.status === 401) {
    await refreshHospitalAccessCookies();
    res = await fetch(url, requestInit);
  }
  if (!res.ok) {
    const detail = await readHttpErrorDetail(res);
    if (res.status === 401) {
      triggerHospitalReLoginFromFetch(detail);
    }
    throw Object.assign(new Error(`doctor_prescription_validate_stream_${res.status}: ${detail}`), {
      status: res.status,
      body: detail
    });
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
  const dec = new TextDecoder();
  let buf = '';
  const sawComplete = { value: false };
  let result: PrescriptionValidationResult | null = null;

  const onResult = (row: PrescriptionValidationResult): void => {
    result = row;
  };

  const drainBufferedLines = (): void => {
    for (;;) {
      const nl = buf.indexOf('\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      dispatchNdjsonLine(line, handlers, sawComplete, onResult);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value && value.byteLength > 0) {
      buf += dec.decode(value, { stream: !done });
    }
    drainBufferedLines();
    if (done) {
      buf += dec.decode(new Uint8Array(), { stream: false });
      drainBufferedLines();
      const tail = buf.trim();
      buf = '';
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
