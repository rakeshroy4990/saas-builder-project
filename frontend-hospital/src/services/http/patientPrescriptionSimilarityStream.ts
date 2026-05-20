import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies, triggerHospitalReLoginFromFetch } from './apiClient';
import { getApiBaseUrl, SERVER_PATHS } from './apiPaths';
import {
  mapPatientPrescriptionSimilarityHit,
  readPatientPrescriptionSimilarityEnvelope,
  type PatientPrescriptionSimilarityHit
} from './patientPrescriptionSimilarityMapping';

const SIMILARITY_STREAM_PATH = SERVER_PATHS.patientPrescriptionsSimilaritySearchStream;

export type PatientPrescriptionSimilarityStreamHandlers = {
  onReady?: () => void;
  onStatus?: (phase: string) => void;
  onHit?: (hit: PatientPrescriptionSimilarityHit) => void;
  onComplete?: (data: { hitCount: number }) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  hitCount?: number;
  hit_count?: number;
};

/** Absolute Spring URL — same pattern as {@link postHospitalAiChatNdjson}. */
function buildSimilarityStreamUrl(): string {
  const url = `${getApiBaseUrl()}${SIMILARITY_STREAM_PATH}`;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `prescription_similarity_stream_bad_url: expected absolute Spring URL, got ${JSON.stringify(url)}`
    );
  }
  if (url.includes('/src/') || url.endsWith('.ts')) {
    throw new Error(
      `prescription_similarity_stream_bad_url: must not target a Vite module (${url}). ` +
        'Use Spring at http://localhost:8080.'
    );
  }
  if (!url.includes(SIMILARITY_STREAM_PATH)) {
    throw new Error(
      `prescription_similarity_stream_bad_url: expected path ${SIMILARITY_STREAM_PATH}, got ${url}`
    );
  }
  return url;
}

function isViteModuleSource(text: string): boolean {
  const sample = text.trimStart().slice(0, 400);
  return (
    sample.startsWith('import ') ||
    sample.includes('patientPrescriptionSimilarityStream') ||
    sample.includes('sourceMappingURL')
  );
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

function markComplete(
  obj: NdjsonEvent,
  payload: unknown,
  handlers: PatientPrescriptionSimilarityStreamHandlers,
  sawComplete: { value: boolean }
): void {
  sawComplete.value = true;
  let hitCount = 0;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    hitCount = Number(record.hitCount ?? record.hit_count ?? 0) || 0;
  } else if (obj.hitCount != null || obj.hit_count != null) {
    hitCount = Number(obj.hitCount ?? obj.hit_count ?? 0) || 0;
  }
  handlers.onComplete?.({ hitCount });
}

function tryParseLegacyEnvelopeLine(
  obj: NdjsonEvent,
  handlers: PatientPrescriptionSimilarityStreamHandlers,
  sawComplete: { value: boolean },
  hits: PatientPrescriptionSimilarityHit[]
): boolean {
  if (obj.success === undefined && obj.Success === undefined) {
    return false;
  }
  const envelopeHits = readPatientPrescriptionSimilarityEnvelope(obj);
  for (const hit of envelopeHits) {
    hits.push(hit);
    handlers.onHit?.(hit);
  }
  sawComplete.value = true;
  handlers.onComplete?.({ hitCount: envelopeHits.length });
  return true;
}

function dispatchNdjsonLine(
  line: string,
  handlers: PatientPrescriptionSimilarityStreamHandlers,
  sawComplete: { value: boolean },
  hits: PatientPrescriptionSimilarityHit[]
): void {
  if (!line) return;
  let obj: NdjsonEvent;
  try {
    obj = JSON.parse(line) as NdjsonEvent;
  } catch {
    return;
  }
  if (tryParseLegacyEnvelopeLine(obj, handlers, sawComplete, hits)) {
    return;
  }
  const t = String(obj.type ?? obj.Type ?? '')
    .trim()
    .toLowerCase();
  const payload = obj.data !== undefined && obj.data !== null ? obj.data : obj.Data;

  if (t === 'ready') handlers.onReady?.();
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) handlers.onStatus?.(phase);
  }
  if (t === 'hit' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const hit = mapPatientPrescriptionSimilarityHit(payload as Record<string, unknown>);
    hits.push(hit);
    handlers.onHit?.(hit);
  }
  if (t === 'complete') {
    markComplete(obj, payload, handlers, sawComplete);
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
    const err = new Error(msg || 'prescription_similarity_stream_error');
    if (code) (err as Error & { code?: string }).code = code;
    sawComplete.value = true;
    throw err;
  }
}

async function readJsonEnvelopeResponse(
  res: Response,
  handlers: PatientPrescriptionSimilarityStreamHandlers
): Promise<PatientPrescriptionSimilarityHit[]> {
  const text = await res.text();
  if (isViteModuleSource(text)) {
    throw new Error(
      'prescription_similarity_stream_vite_module: request hit the Vite dev server instead of Spring.'
    );
  }
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('prescription_similarity_stream_invalid_json');
  }
  const hits = readPatientPrescriptionSimilarityEnvelope(root);
  handlers.onReady?.();
  handlers.onStatus?.('searching');
  for (const hit of hits) {
    handlers.onHit?.(hit);
  }
  handlers.onComplete?.({ hitCount: hits.length });
  return hits;
}

function rejectIfViteModuleLeak(preview: string): void {
  if (isViteModuleSource(preview)) {
    throw new Error(
      'prescription_similarity_stream_vite_module: received frontend JavaScript instead of NDJSON from Spring.'
    );
  }
}

/**
 * POST `/api/v1/patient-prescriptions/similarity-search/stream` with `Accept: application/x-ndjson`.
 */
export async function postPatientPrescriptionSimilarityStream(
  opts: {
    query?: string;
    file?: File;
    limit?: number;
  },
  handlers: PatientPrescriptionSimilarityStreamHandlers,
  signal?: AbortSignal
): Promise<PatientPrescriptionSimilarityHit[]> {
  const url = buildSimilarityStreamUrl();

  const formData = new FormData();
  const query = String(opts.query ?? '').trim();
  if (query) formData.append('query', query);
  if (opts.file) formData.append('file', opts.file);
  if (opts.limit != null && opts.limit > 0) {
    formData.append('limit', String(opts.limit));
  }

  await ensureAccessTokenFreshForFetch();
  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/x-ndjson',
      'X-Trace-Id': getOrCreateTraceId()
    },
    body: formData,
    signal
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
    throw Object.assign(new Error(`prescription_similarity_stream_${res.status}: ${detail}`), {
      status: res.status,
      body: detail
    });
  }

  const contentType = String(res.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
    return readJsonEnvelopeResponse(res, handlers);
  }
  if (!res.body) {
    throw new Error('prescription_similarity_stream_no_body');
  }

  const hits: PatientPrescriptionSimilarityHit[] = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const sawComplete = { value: false };
  let checkedPreview = false;

  const drainBufferedLines = (): void => {
    for (;;) {
      const nl = buf.indexOf('\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      dispatchNdjsonLine(line, handlers, sawComplete, hits);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value && value.byteLength > 0) {
      const chunk = dec.decode(value, { stream: !done });
      if (!checkedPreview) {
        checkedPreview = true;
        rejectIfViteModuleLeak(chunk);
      }
      buf += chunk;
    }
    drainBufferedLines();
    if (done) {
      buf += dec.decode(new Uint8Array(), { stream: false });
      drainBufferedLines();
      const tail = buf.trim();
      buf = '';
      if (tail) {
        rejectIfViteModuleLeak(tail);
        dispatchNdjsonLine(tail, handlers, sawComplete, hits);
      }
      if (!sawComplete.value) {
        throw new Error(
          'prescription_similarity_stream_incomplete: stream ended before a complete event'
        );
      }
      break;
    }
  }
  return hits;
}
