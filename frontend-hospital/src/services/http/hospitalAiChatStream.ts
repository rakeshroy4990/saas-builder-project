import { recordPerf } from '@/composables/usePerf';
import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies, triggerHospitalReLoginFromFetch } from './apiClient';
import { getApiBaseUrl, URLRegistry } from './URLRegistry';

const VITE_PERF_ENABLED = import.meta.env.VITE_PERF_ENABLED === 'true';

export type HospitalAiChatStreamHandlers = {
  onReady?: (data: unknown) => void;
  onStatus?: (phase: string) => void;
  onDelta?: (chunk: string) => void;
  onComplete?: (data: Record<string, unknown>) => void;
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
  handlers: HospitalAiChatStreamHandlers,
  sawComplete: { value: boolean },
  streamTiming?: { t0: number; firstDeltaLogged: boolean }
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
  const payload = obj.data !== undefined && obj.data !== null ? obj.data : obj.Data;

  if (t === 'ready') handlers.onReady?.(payload);
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) handlers.onStatus?.(phase);
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
        console.log(`UI_FIRST_DELTA_MS=${Date.now() - streamTiming.t0}`);
        streamTiming.firstDeltaLogged = true;
      }
      handlers.onDelta?.(chunk);
    }
  }
  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    sawComplete.value = true;
    handlers.onComplete?.(payload as Record<string, unknown>);
  }
  if (t === 'error') {
    const data = payload;
    const msg =
      data && typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: string }).message ?? '').trim()
        : '';
    throw new Error(msg || 'hospital_ai_chat_stream_error');
  }
}

/**
 * POST `/api/hospital/ai/chat` with `Accept: application/x-ndjson` and consume newline-delimited JSON events.
 */
export async function postHospitalAiChatNdjson(
  body: Record<string, unknown>,
  handlers: HospitalAiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const perfStart = VITE_PERF_ENABLED ? performance.now() : null;
  const url = `${getApiBaseUrl()}${URLRegistry.paths.hospitalAiChat}`;

  const recordChatPerf = (meta?: Record<string, unknown>): void => {
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
      signal
    };
    let res = await fetch(url, opts);
    if (res.status === 401) {
      await refreshHospitalAccessCookies();
      res = await fetch(url, opts);
    }
    if (!res.ok) {
      const detail = await readHttpErrorDetail(res);
      if (res.status === 401) {
        triggerHospitalReLoginFromFetch(detail);
      }
      throw Object.assign(new Error(`hospital_ai_chat_stream_${res.status}: ${detail}`), {
        status: res.status,
        body: detail
      });
    }
    if (!res.body) {
      throw new Error('hospital_ai_chat_stream_no_body');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const sawComplete = { value: false };
    const streamTiming = { t0: Date.now(), firstDeltaLogged: false };
    let firstChunkLogged = false;

    const drainBufferedLines = (): void => {
      for (;;) {
        const nl = buf.indexOf('\n');
        if (nl < 0) break;
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        dispatchNdjsonLine(line, handlers, sawComplete, streamTiming);
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (value && value.byteLength > 0) {
        if (!firstChunkLogged) {
          console.log(`UI_FIRST_CHUNK_MS=${Date.now() - streamTiming.t0}`);
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
          dispatchNdjsonLine(tail, handlers, sawComplete, streamTiming);
        }
        if (!sawComplete.value) {
          throw new Error(
            'hospital_ai_chat_stream_incomplete: stream ended before a complete event (check NDJSON framing and proxies)'
          );
        }
        break;
      }
    }
    recordChatPerf();
  } catch (err) {
    recordChatPerf({ error: true, status: err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined });
    throw err;
  }
}
