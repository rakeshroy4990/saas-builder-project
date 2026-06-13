import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { getOrCreateTraceId } from '@/analytics/sessionTelemetry';
import { useSessionStore } from '@/auth/sessionStore';
import { fetchWithAuthRetry } from '@/api/client';
import { getMobileApiBaseUrl } from '@/api/config';
import { fetchWithTimeout } from '@/api/fetchWithTimeout';
import { DEFAULT_API_TIMEOUT_MS } from '@/api/timeouts';
import { api } from '@/api/client';

export interface TriageResultRow {
  externalId: string;
  urgencyLevel: string;
  urgencyReasoning: string;
  doctorNote: string;
  redFlags: string[];
  createdAt?: string | null;
}

export type TriageAnalyzeStreamHandlers = {
  onStatus?: (phase: string) => void;
  onDelta?: (chunk: string) => void;
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function parseRow(body: unknown): TriageResultRow | null {
  const envelope = body as { Data?: Record<string, unknown> };
  const row = (envelope?.Data ?? body) as Record<string, unknown> | undefined;
  if (!row || typeof row !== 'object') return null;
  const externalId = pickString(row, ['ExternalId', 'externalId']);
  if (!externalId) return null;
  const redRaw = row.RedFlags ?? row.redFlags;
  const redFlags = Array.isArray(redRaw)
    ? redRaw.map((f) => String(f ?? '').trim()).filter(Boolean)
    : [];
  return {
    externalId,
    urgencyLevel: pickString(row, ['UrgencyLevel', 'urgencyLevel']),
    urgencyReasoning: pickString(row, ['UrgencyReasoning', 'urgencyReasoning']),
    doctorNote: pickString(row, ['DoctorNote', 'doctorNote']),
    redFlags,
    createdAt: pickString(row, ['CreatedAt', 'createdAt']) || null
  };
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
  onComplete: (row: TriageResultRow) => void,
  streamTiming?: { t0: number; firstDeltaLogged: boolean; firstStatusLogged: boolean }
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

  if (t === 'status' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const phase = String((payload as Record<string, unknown>).phase ?? '').trim();
    if (phase) {
      if (streamTiming && !streamTiming.firstStatusLogged) {
        console.log(`[TRIAGE][MOBILE][TIMING] status_ms=${Date.now() - streamTiming.t0} phase=${phase}`);
        streamTiming.firstStatusLogged = true;
      }
      handlers.onStatus?.(phase);
    }
  }
  if (t === 'delta' || t === 'token') {
    let chunk = '';
    if (typeof obj.text === 'string') chunk = obj.text;
    else if (typeof obj.Text === 'string') chunk = obj.Text;
    if (chunk) {
      if (streamTiming && !streamTiming.firstDeltaLogged) {
        console.log(`[TRIAGE][MOBILE][TIMING] first_delta_ms=${Date.now() - streamTiming.t0}`);
        streamTiming.firstDeltaLogged = true;
      }
      handlers.onDelta?.(chunk);
    }
  }
  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (streamTiming) {
      console.log(`[TRIAGE][MOBILE][TIMING] complete_ms=${Date.now() - streamTiming.t0}`);
    }
    const row = parseRow({ Data: payload });
    if (!row) throw new Error('Triage stream complete invalid');
    sawComplete.value = true;
    onComplete(row);
  }
  if (t === 'error') {
    const msg =
      payload && typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: string }).message ?? '').trim()
        : '';
    throw new Error(msg || 'Triage stream error');
  }
}

export async function analyzeTriageStream(
  payload: Record<string, unknown>,
  handlers: TriageAnalyzeStreamHandlers = {}
): Promise<TriageResultRow> {
  const requestT0 = Date.now();
  console.log('[TRIAGE][MOBILE][TIMING] request_start');
  const url = `${getMobileApiBaseUrl()}${SERVER_PATHS.triageResultsAnalyze}`;
  const buildRequest = async (): Promise<Response> => {
    const token = useSessionStore.getState().accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/x-ndjson',
      'Content-Type': 'application/json',
      'X-Trace-Id': getOrCreateTraceId()
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchWithTimeout(
      url,
      { method: 'POST', headers, body: JSON.stringify(payload) },
      DEFAULT_API_TIMEOUT_MS * 4
    );
  };

  const res = await fetchWithAuthRetry(buildRequest);
  console.log(`[TRIAGE][MOBILE][TIMING] response_headers_ms=${Date.now() - requestT0} status=${res.status}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Triage stream HTTP ${res.status}`);
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    throw new Error('Triage stream body unavailable');
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const sawComplete = { value: false };
  let result: TriageResultRow | null = null;
  const streamTiming = { t0: requestT0, firstDeltaLogged: false, firstStatusLogged: false };
  let firstChunkLogged = false;

  const drain = (): void => {
    for (;;) {
      const nl = buf.indexOf('\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      dispatchNdjsonLine(line, handlers, sawComplete, (row) => {
        result = row;
      }, streamTiming);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value?.byteLength) {
      if (!firstChunkLogged) {
        console.log(`[TRIAGE][MOBILE][TIMING] first_chunk_ms=${Date.now() - streamTiming.t0}`);
        firstChunkLogged = true;
      }
      buf += dec.decode(value, { stream: !done });
    }
    drain();
    if (done) {
      buf += dec.decode(new Uint8Array(), { stream: false });
      drain();
      const tail = buf.trim();
      if (tail) dispatchNdjsonLine(tail, handlers, sawComplete, (row) => { result = row; }, streamTiming);
      if (!result) {
        console.log(`[TRIAGE][MOBILE][TIMING] stream_incomplete total_ms=${Date.now() - streamTiming.t0}`);
        throw new Error('Triage stream incomplete');
      }
      console.log(`[TRIAGE][MOBILE][TIMING] stream_done total_ms=${Date.now() - streamTiming.t0}`);
      return result;
    }
  }
}

export async function analyzeTriage(
  payload: Record<string, unknown>,
  handlers: TriageAnalyzeStreamHandlers = {}
): Promise<TriageResultRow> {
  return analyzeTriageStream(payload, handlers);
}

export async function fetchTriageForAppointmentId(appointmentId: string): Promise<TriageResultRow | null> {
  try {
    const path = `${SERVER_PATHS.triageResults}/appointment-id/${encodeURIComponent(appointmentId)}`;
    const res = await api.get(path);
    return parseRow(res.data);
  } catch {
    return null;
  }
}

export function isTriageFresh(createdAt?: string | null, hours = 24): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < hours * 60 * 60 * 1000;
}
