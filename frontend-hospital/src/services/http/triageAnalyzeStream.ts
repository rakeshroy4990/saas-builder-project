import { recordPerf } from '@/composables/usePerf';
import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies, triggerHospitalReLoginFromFetch } from './apiClient';
import { getApiBaseUrl, URLRegistry } from './URLRegistry';
import { parseTriageRow, type TriageAnalyzePayload, type TriageResultRow } from './triageApi';

const TRIAGE_STREAM_TIMEOUT_MS = 180_000;
const VITE_PERF_ENABLED = import.meta.env.VITE_PERF_ENABLED === 'true';

export type TriageAnalyzeStreamHandlers = {
  onReady?: (data: unknown) => void;
  onStatus?: (phase: string) => void;
  onDelta?: (chunk: string) => void;
  onComplete?: (row: TriageResultRow) => void;
};

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

function isJsonEnvelope(obj: Record<string, unknown>): boolean {
  return 'Success' in obj || 'success' in obj || 'Data' in obj || 'data' in obj;
}

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

function dispatchNdjsonLine(
  line: string,
  handlers: TriageAnalyzeStreamHandlers,
  sawComplete: { value: boolean },
  onRow: (row: TriageResultRow) => void,
  streamTiming?: { t0: number; firstDeltaLogged: boolean; firstStatusLogged: boolean; firstReadyLogged: boolean }
): void {
  if (!line) return;
  let obj: NdjsonEvent;
  try {
    obj = JSON.parse(line) as NdjsonEvent;
  } catch {
    return;
  }
  const t = String(obj.type ?? obj.Type ?? '')
    .trim()
    .toLowerCase();
  if (streamTiming && t && t !== 'delta' && t !== 'token' && t !== 'ping') {
    console.log(`[TRIAGE][UI][EVENT] type=${t} ms=${Date.now() - (streamTiming?.t0 ?? Date.now())}`);
  }

  if (!t && isJsonEnvelope(obj)) {
    const row = parseTriageRow(obj);
    if (row) {
      sawComplete.value = true;
      onRow(row);
      handlers.onComplete?.(row);
    }
    return;
  }

  const payload = obj.data !== undefined && obj.data !== null ? obj.data : obj.Data;

  if (t === 'ready') {
    if (streamTiming && !streamTiming.firstReadyLogged) {
      console.log(`[TRIAGE][UI][TIMING] ready_ms=${Date.now() - streamTiming.t0}`);
      streamTiming.firstReadyLogged = true;
    }
    handlers.onReady?.(payload);
  }
  if (t === 'ping' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String(
      (payload as Record<string, unknown>).phase ?? (payload as Record<string, unknown>).Phase ?? ''
    ).trim();
    if (phase && phase !== 'processing') {
      handlers.onStatus?.(phase);
    }
  }
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String(
      (payload as Record<string, unknown>).phase ?? (payload as Record<string, unknown>).Phase ?? ''
    ).trim();
    if (phase && phase !== 'processing') {
      if (streamTiming && !streamTiming.firstStatusLogged) {
        console.log(`[TRIAGE][UI][TIMING] status_ms=${Date.now() - streamTiming.t0} phase=${phase}`);
        streamTiming.firstStatusLogged = true;
      }
      handlers.onStatus?.(phase);
    }
  }
  if (t === 'delta' || t === 'token') {
    let chunk = '';
    if (typeof obj.text === 'string') {
      chunk = obj.text;
    } else if (typeof obj.Text === 'string') {
      chunk = obj.Text;
    } else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const p = payload as Record<string, unknown>;
      chunk = String(p.token ?? p.Token ?? '').trim();
    }
    if (chunk) {
      if (streamTiming && !streamTiming.firstDeltaLogged) {
        console.log(`[TRIAGE][UI][TIMING] first_delta_ms=${Date.now() - streamTiming.t0}`);
        streamTiming.firstDeltaLogged = true;
      }
      handlers.onDelta?.(chunk);
    }
  }
  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (streamTiming) {
      console.log(`[TRIAGE][UI][TIMING] complete_ms=${Date.now() - streamTiming.t0}`);
    }
    const row = parseTriageRow({ Data: payload });
    if (!row) {
      throw new Error('triage_stream_invalid_complete');
    }
    sawComplete.value = true;
    onRow(row);
    handlers.onComplete?.(row);
  }
  if (t === 'error') {
    const data = payload;
    const msg =
      data && typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: string }).message ?? '').trim()
        : '';
    throw new Error(msg || 'triage_stream_error');
  }
}

function buildStreamSignal(external?: AbortSignal): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return external;
  }
  const timeoutSignal = AbortSignal.timeout(TRIAGE_STREAM_TIMEOUT_MS);
  if (external && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, external]);
  }
  return timeoutSignal;
}

/**
 * POST `/api/v1/triage-results/analyze` with `Accept: application/x-ndjson`.
 */
export async function postTriageAnalyzeNdjson(
  body: TriageAnalyzePayload,
  handlers: TriageAnalyzeStreamHandlers,
  signal?: AbortSignal
): Promise<TriageResultRow> {
  const perfStart = VITE_PERF_ENABLED ? performance.now() : null;
  const url = `${getApiBaseUrl()}${URLRegistry.paths.triageResultsAnalyze}`;

  const recordTriagePerf = (meta?: Record<string, unknown>): void => {
    if (perfStart == null) {
      return;
    }
    recordPerf({
      label: `POST ${url}`,
      type: 'api',
      durationMs: performance.now() - perfStart,
      timestamp: Date.now(),
      meta: { stream: 'ndjson', ...meta }
    });
  };

  try {
    const requestT0 = Date.now();
    console.log('[TRIAGE][UI][TIMING] request_start');
    await ensureAccessTokenFreshForFetch();
    const opts: RequestInit = {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        'X-Trace-Id': getOrCreateTraceId()
      },
      body: JSON.stringify(body),
      signal: buildStreamSignal(signal)
    };
    let res = await fetch(url, opts);
    if (res.status === 401) {
      await refreshHospitalAccessCookies();
      res = await fetch(url, opts);
    }
    console.log(`[TRIAGE][UI][TIMING] response_headers_ms=${Date.now() - requestT0} status=${res.status}`);
    if (!res.ok) {
      const detail = await readHttpErrorDetail(res);
      if (res.status === 401) {
        triggerHospitalReLoginFromFetch(detail);
      }
      throw Object.assign(new Error(`triage_stream_${res.status}: ${detail}`), {
        status: res.status,
        body: detail
      });
    }

    const contentType = String(res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
      const envelope = (await res.json()) as Record<string, unknown>;
      const row = parseTriageRow(envelope);
      if (!row) {
        throw new Error(String(envelope.Message ?? envelope.message ?? 'triage_analyze_failed'));
      }
      handlers.onComplete?.(row);
      recordTriagePerf({ mode: 'json_fallback' });
      return row;
    }

    if (!res.body) {
      throw new Error('triage_stream_no_body');
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const sawComplete = { value: false };
    let result: TriageResultRow | null = null;
    const streamTiming = {
      t0: requestT0,
      firstDeltaLogged: false,
      firstStatusLogged: false,
      firstReadyLogged: false
    };
    let firstChunkLogged = false;

    const onRow = (row: TriageResultRow): void => {
      result = row;
    };

    const drainBufferedLines = (): void => {
      for (;;) {
        const nl = buf.indexOf('\n');
        if (nl < 0) break;
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        dispatchNdjsonLine(line, handlers, sawComplete, onRow, streamTiming);
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (value && value.byteLength > 0) {
        if (!firstChunkLogged) {
          console.log(`[TRIAGE][UI][TIMING] first_chunk_ms=${Date.now() - streamTiming.t0}`);
          firstChunkLogged = true;
        }
        buf += dec.decode(value, { stream: !done });
      }
      drainBufferedLines();
      if (done) {
        buf += dec.decode(new Uint8Array(), { stream: false });
        drainBufferedLines();
        const tail = buf.trim();
        buf = '';
        if (tail) {
          dispatchNdjsonLine(tail, handlers, sawComplete, onRow, streamTiming);
        }
        if (!sawComplete.value || !result) {
          console.log(
            `[TRIAGE][UI][TIMING] stream_incomplete total_ms=${Date.now() - streamTiming.t0} tail=${tail.slice(0, 400)}`
          );
          throw new Error(
            'triage_stream_incomplete: stream ended before complete (check server NDJSON complete event)'
          );
        }
        console.log(`[TRIAGE][UI][TIMING] stream_done total_ms=${Date.now() - streamTiming.t0}`);
        recordTriagePerf();
        return result;
      }
    }
  } catch (err) {
    recordTriagePerf({
      error: true,
      status: err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined
    });
    throw err;
  }
}
