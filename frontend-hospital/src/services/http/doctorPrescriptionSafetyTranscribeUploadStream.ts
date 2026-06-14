import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies, triggerHospitalReLoginFromFetch } from './apiClient';
import { getApiBaseUrl, SERVER_PATHS } from './apiPaths';

const STREAM_PATH = SERVER_PATHS.hospitalEducationPrescriptionSafetyTranscribeUploadStream;
const STREAM_TIMEOUT_MS = 300_000;

export type DoctorPrescriptionTranscribeResult = {
  summary: string;
  medicines: string[];
  childWeightKg: number | null;
  childAgeMonths: number | null;
  temperatureF: number | null;
  weightSource: string;
};

export type DoctorPrescriptionTranscribeUploadStreamHandlers = {
  onReady?: () => void;
  onStatus?: (phase: string) => void;
  onTranscribed?: (preview: DoctorPrescriptionTranscribeResult) => void;
  onComplete?: (result: DoctorPrescriptionTranscribeResult) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
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

function parseTranscribePayload(payload: unknown): DoctorPrescriptionTranscribeResult | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const medicinesRaw = row.Medicines ?? row.medicines;
  const medicines = Array.isArray(medicinesRaw)
    ? medicinesRaw.map((v) => String(v).trim()).filter(Boolean)
    : [];
  return {
    summary: pickString(row, 'Summary', 'summary'),
    medicines,
    childWeightKg: pickNumber(row, 'ChildWeightKg', 'childWeightKg'),
    childAgeMonths: pickNumber(row, 'ChildAgeMonths', 'childAgeMonths'),
    temperatureF: pickNumber(row, 'TemperatureF', 'temperatureF'),
    weightSource: pickString(row, 'WeightSource', 'weightSource') || 'not_available'
  };
}

function buildStreamUrl(): string {
  const url = `${getApiBaseUrl()}${STREAM_PATH}`;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`doctor_prescription_transcribe_stream_bad_url: ${JSON.stringify(url)}`);
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

async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const top = String(j.message ?? j.Message ?? '').trim();
    if (top) return top;
  } catch {
    // use raw text
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 800) || `HTTP ${res.status}`;
}

function dispatchNdjsonLine(
  line: string,
  handlers: DoctorPrescriptionTranscribeUploadStreamHandlers,
  sawComplete: { value: boolean },
  onResult: (result: DoctorPrescriptionTranscribeResult) => void
): void {
  if (!line) return;
  let obj: NdjsonEvent;
  try {
    obj = JSON.parse(line) as NdjsonEvent;
  } catch {
    return;
  }

  const t = String(obj.type ?? obj.Type ?? '').trim().toLowerCase();
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
    const preview = parseTranscribePayload(payload);
    if (preview) handlers.onTranscribed?.(preview);
  }
  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const result = parseTranscribePayload(payload);
    if (!result) {
      throw new Error('doctor_prescription_transcribe_stream_invalid_complete');
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
    sawComplete.value = true;
    throw new Error(msg || 'doctor_prescription_transcribe_stream_error');
  }
}

export async function postDoctorPrescriptionTranscribeUploadStream(
  file: File,
  handlers: DoctorPrescriptionTranscribeUploadStreamHandlers,
  signal?: AbortSignal
): Promise<DoctorPrescriptionTranscribeResult | null> {
  const url = buildStreamUrl();
  const formData = new FormData();
  formData.append('file', file);

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
    throw Object.assign(new Error(`doctor_prescription_transcribe_stream_${res.status}: ${detail}`), {
      status: res.status,
      body: detail
    });
  }

  if (!res.body) {
    throw new Error('doctor_prescription_transcribe_stream_no_body');
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const sawComplete = { value: false };
  let result: DoctorPrescriptionTranscribeResult | null = null;

  const onResult = (row: DoctorPrescriptionTranscribeResult): void => {
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
          `doctor_prescription_transcribe_stream_incomplete: stream ended before complete (tail=${tail.slice(0, 400)})`
        );
      }
      break;
    }
  }

  return result;
}
