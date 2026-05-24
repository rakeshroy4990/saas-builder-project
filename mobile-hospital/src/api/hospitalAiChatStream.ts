import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { getOrCreateTraceId } from '@/analytics/sessionTelemetry';
import { clearSecureAuth } from '@/auth/secureTokens';
import { isAccessTokenExpired, useSessionStore } from '@/auth/sessionStore';
import { getMobileApiBaseUrl } from '@/api/config';
import { refreshAccessToken } from '@/api/client';

export type HospitalAiChatStreamHandlers = {
  onReady?: () => void;
  onStatus?: (phase: string) => void;
  onDelta?: (chunk: string) => void;
  onComplete?: (data: Record<string, unknown>) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

export function pickReplyFromChatPayload(data: Record<string, unknown>): string {
  return String(data.reply ?? data.Reply ?? data.message ?? data.Message ?? '').trim();
}

function dispatchNdjsonLine(
  line: string,
  handlers: HospitalAiChatStreamHandlers,
  sawComplete: { value: boolean }
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

  if (t === 'ready') handlers.onReady?.();
  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) handlers.onStatus?.(phase);
  }
  if (t === 'delta' || t === 'token') {
    let chunk = '';
    if (typeof obj.text === 'string') chunk = obj.text;
    else if (typeof obj.Text === 'string') chunk = obj.Text;
    else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const p = payload as Record<string, unknown>;
      chunk = String(p.token ?? p.Token ?? '');
    }
    if (chunk) handlers.onDelta?.(chunk);
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

/**
 * POST `/api/hospital/ai/chat` with NDJSON streaming (matches web `postHospitalAiChatNdjson`).
 * Returns the final reply text (from `complete` event or accumulated deltas).
 */
export async function postHospitalAiChatNdjson(
  body: Record<string, unknown>,
  handlers: HospitalAiChatStreamHandlers = {},
  signal?: AbortSignal
): Promise<string> {
  const url = `${getMobileApiBaseUrl()}${SERVER_PATHS.hospitalAiChat}`;
  let accumulated = '';

  if (isAccessTokenExpired()) {
    await refreshAccessToken();
  }

  const runFetch = async (): Promise<Response> => {
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/x-ndjson',
      'Content-Type': 'application/json',
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
  };

  let res = await runFetch();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await runFetch();
    } else {
      useSessionStore.getState().clearSession();
      await clearSecureAuth();
    }
  }
  if (!res.ok) {
    const detail = await readHttpErrorDetail(res);
    throw new Error(detail || `HTTP ${res.status}`);
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
    const json = (await res.json()) as Record<string, unknown>;
    const root = json;
    const inner = (root.data ?? root.Data) as Record<string, unknown> | undefined;
    const reply = pickReplyFromChatPayload((inner ?? root) as Record<string, unknown>);
    if (reply) return reply;
    throw new Error('Empty AI response');
  }

  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    const sawComplete = { value: false };
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) dispatchNdjsonLine(trimmed, wrappedHandlers, sawComplete);
    }
    if (!accumulated.trim() && !sawComplete.value) {
      throw new Error('AI stream ended without a reply');
    }
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
      dispatchNdjsonLine(line, wrappedHandlers, sawComplete);
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
      if (tail) dispatchNdjsonLine(tail, wrappedHandlers, sawComplete);
      break;
    }
  }

  if (!accumulated.trim() && !sawComplete.value) {
    throw new Error('AI stream ended without a reply');
  }
  return accumulated.trim();
}
