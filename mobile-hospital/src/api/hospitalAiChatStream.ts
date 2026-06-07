import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import {
  getOrCreateTraceId,
  recordAiChatStreamTelemetry,
  type AiChatStreamTelemetryMeta
} from '@/analytics/sessionTelemetry';
import { useSessionStore } from '@/auth/sessionStore';
import { getMobileApiBaseUrl } from '@/api/config';
import { fetchWithAuthRetry } from '@/api/client';
import { fetchWithTimeout } from '@/api/fetchWithTimeout';
import { UPLOAD_API_TIMEOUT_MS } from '@/api/timeouts';
import { toUserFacingApiError } from '@/api/apiErrors';

export type HospitalAiChatStreamHandlers = {
  onReady?: () => void;
  onStatus?: (phase: string) => void;
  onDelta?: (chunk: string) => void;
  onComplete?: (data: Record<string, unknown>) => void;
};

export type AiChatStreamContext = 'education' | 'chat';

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

type StreamTiming = {
  t0: number;
  firstByteMs?: number;
  readyMs?: number;
  firstStatusMs?: number;
  firstDeltaMs?: number;
};

export function pickReplyFromChatPayload(data: Record<string, unknown>): string {
  return String(data.reply ?? data.Reply ?? data.message ?? data.Message ?? '').trim();
}

function markFirstBodyByte(timing: StreamTiming): void {
  if (timing.firstByteMs == null) timing.firstByteMs = Date.now() - timing.t0;
}

function dispatchNdjsonLine(
  line: string,
  handlers: HospitalAiChatStreamHandlers,
  sawComplete: { value: boolean },
  timing: StreamTiming
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

  if (t === 'ready') {
    if (timing.readyMs == null) timing.readyMs = Date.now() - timing.t0;
    handlers.onReady?.();
  }
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) {
      if (timing.firstStatusMs == null) timing.firstStatusMs = Date.now() - timing.t0;
      handlers.onStatus?.(phase);
    }
  }
  if (t === 'delta' || t === 'token') {
    let chunk = '';
    if (typeof obj.text === 'string') chunk = obj.text;
    else if (typeof obj.Text === 'string') chunk = obj.Text;
    else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const p = payload as Record<string, unknown>;
      chunk = String(p.token ?? p.Token ?? '');
    }
    if (chunk) {
      if (timing.firstDeltaMs == null) timing.firstDeltaMs = Date.now() - timing.t0;
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
    throw new Error(msg || 'AI stream error');
  }
}

async function readHttpErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const top = String(j.message ?? j.Message ?? '').trim();
    if (top) return top;
  } catch {
    // use raw
  }
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 500) || `HTTP ${res.status}`;
}

function emitStreamTelemetry(
  timing: StreamTiming,
  streamMode: AiChatStreamTelemetryMeta['stream_mode'],
  context: AiChatStreamContext | undefined,
  httpStatus: number,
  error?: { message: string }
): void {
  recordAiChatStreamTelemetry({
    api_path: SERVER_PATHS.hospitalAiChat,
    http_method: 'POST',
    http_status: httpStatus,
    duration_ms: Date.now() - timing.t0,
    stream_mode: streamMode,
    context,
    time_to_first_byte_ms: timing.firstByteMs,
    time_to_ready_ms: timing.readyMs,
    time_to_first_status_ms: timing.firstStatusMs,
    time_to_first_delta_ms: timing.firstDeltaMs,
    error: Boolean(error),
    error_message: error?.message
  });
}

/**
 * POST `/api/hospital/ai/chat` with NDJSON streaming (matches web `postHospitalAiChatNdjson`).
 * Returns the final reply text (from `complete` event or accumulated deltas).
 */
export async function postHospitalAiChatNdjson(
  body: Record<string, unknown>,
  handlers: HospitalAiChatStreamHandlers = {},
  options?: { signal?: AbortSignal; context?: AiChatStreamContext }
): Promise<string> {
  const url = `${getMobileApiBaseUrl()}${SERVER_PATHS.hospitalAiChat}`;
  const timing: StreamTiming = { t0: Date.now() };
  const context = options?.context;
  let accumulated = '';
  let streamMode: AiChatStreamTelemetryMeta['stream_mode'] = 'ndjson';
  let telemetrySent = false;

  const finishTelemetry = (
    httpStatus: number,
    error?: { message: string }
  ): void => {
    if (telemetrySent) return;
    telemetrySent = true;
    emitStreamTelemetry(timing, streamMode, context, httpStatus, error);
  };

  const runFetch = async (): Promise<Response> => {
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/x-ndjson',
      'Content-Type': 'application/json',
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal
      },
      UPLOAD_API_TIMEOUT_MS
    );
  };

  try {
    const res = await fetchWithAuthRetry(runFetch);

    if (!res.ok) {
      const detail = await readHttpErrorDetail(res);
      const err = new Error(
        toUserFacingApiError(new Error(detail || `HTTP ${res.status}`), 'AI chat is unavailable right now.')
      );
      finishTelemetry(res.status, { message: err.message });
      throw err;
    }

    const wrappedHandlers: HospitalAiChatStreamHandlers = {
      ...handlers,
      onDelta: (chunk) => {
        accumulated += chunk;
        handlers.onDelta?.(chunk);
      },
      onComplete: (data) => {
        const finalReply = pickReplyFromChatPayload(data);
        if (finalReply) accumulated = finalReply;
        handlers.onComplete?.(data);
      }
    };

    const contentType = String(res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
      streamMode = 'json_fallback';
      markFirstBodyByte(timing);
      const json = (await res.json()) as Record<string, unknown>;
      const root = json;
      const inner = (root.data ?? root.Data) as Record<string, unknown> | undefined;
      const reply = pickReplyFromChatPayload((inner ?? root) as Record<string, unknown>);
      if (reply) {
        finishTelemetry(res.status);
        return reply;
      }
      const err = new Error('Empty AI response');
      finishTelemetry(res.status, { message: err.message });
      throw err;
    }

    if (!res.body || typeof res.body.getReader !== 'function') {
      streamMode = 'buffered_fallback';
      const text = await res.text();
      markFirstBodyByte(timing);
      const sawComplete = { value: false };
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) dispatchNdjsonLine(trimmed, wrappedHandlers, sawComplete, timing);
      }
      if (!accumulated.trim() && !sawComplete.value) {
        const err = new Error('AI stream ended without a reply');
        finishTelemetry(res.status, { message: err.message });
        throw err;
      }
      finishTelemetry(res.status);
      return accumulated.trim();
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const sawComplete = { value: false };

    const drainBufferedLines = (): void => {
      for (;;) {
        const nl = buf.indexOf('\n');
        if (nl < 0) break;
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        dispatchNdjsonLine(line, wrappedHandlers, sawComplete, timing);
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (value && value.byteLength > 0) {
        markFirstBodyByte(timing);
        buf += dec.decode(value, { stream: !done });
      }
      drainBufferedLines();
      if (done) {
        buf += dec.decode(new Uint8Array(), { stream: false });
        drainBufferedLines();
        const tail = buf.trim();
        if (tail) dispatchNdjsonLine(tail, wrappedHandlers, sawComplete, timing);
        break;
      }
    }

    if (!accumulated.trim() && !sawComplete.value) {
      const err = new Error('AI stream ended without a reply');
      finishTelemetry(res.status, { message: err.message });
      throw err;
    }
    finishTelemetry(res.status);
    return accumulated.trim();
  } catch (err) {
    if (!telemetrySent) {
      finishTelemetry(0, {
        message: err instanceof Error ? err.message : 'AI stream failed'
      });
    }
    throw err;
  }
}
