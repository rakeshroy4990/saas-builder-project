import { getOrCreateTraceId } from '../logging/traceContext';
import { ensureAccessTokenFreshForFetch, refreshHospitalAccessCookies } from './apiClient';
import { resolveSpringApiUrl, SERVER_PATHS } from './apiPaths';
import { pickString } from '../domain/hospital/shared/strings';
import { activeAppLocale } from '../../i18n/activeLocale';
import { parseGrowthCharacteristics } from '../domain/hospital/growth/growthCharacteristics';

const GROWTH_SUMMARY_STREAM_TIMEOUT_MS = 120_000;

export type GrowthHistorySummaryStreamHandlers = {
  onDelta?: (chunk: string) => void;
  onComplete?: (summary: string, characteristics?: import('../domain/hospital/growth/growthCharacteristics').GrowthCharacteristics | null) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

function buildStreamSignal(external?: AbortSignal): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return external;
  }
  const timeoutSignal = AbortSignal.timeout(GROWTH_SUMMARY_STREAM_TIMEOUT_MS);
  if (external && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, external]);
  }
  return timeoutSignal;
}

function dispatchNdjsonLine(line: string, handlers: GrowthHistorySummaryStreamHandlers, sawComplete: { value: boolean }): void {
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

  if (t === 'delta' || t === 'token') {
    let chunk = '';
    if (typeof obj.text === 'string') chunk = obj.text;
    else if (typeof obj.Text === 'string') chunk = obj.Text;
    if (chunk) handlers.onDelta?.(chunk);
    return;
  }

  if (t === 'complete' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const row = payload as Record<string, unknown>;
    const summary = pickString(row, ['Summary', 'summary']);
    const characteristics = parseGrowthCharacteristics(row.Characteristics ?? row.characteristics);
    sawComplete.value = true;
    handlers.onComplete?.(summary, characteristics);
    return;
  }

  if (t === 'error') {
    const data = payload as { message?: string; Message?: string } | undefined;
    throw new Error(String(data?.Message ?? data?.message ?? 'growth_summary_stream_error'));
  }
}

export type GrowthHistorySummaryPayload = {
  ChildProfileExternalId: string;
  AgeMonthsAtRecording: number;
  WeightKg?: number | null;
  HeightCm?: number | null;
  HeadCircumferenceCm?: number | null;
  WeightPercentile?: number | null;
  HeightPercentile?: number | null;
  BmiPercentile?: number | null;
  HcPercentile?: number | null;
  ReplyLocale?: string;
  Sex?: string | null;
};

/** Always call Spring directly (same as triage stream) — avoid Vite `/api` proxy buffering NDJSON. */
export function resolveGrowthHistorySummaryStreamUrl(): string {
  const path = `${SERVER_PATHS.growthRecords}/history-summary/stream`;
  const configured = String(import.meta.env.VITE_SPRING_API_BASE_URL ?? '').trim();
  if (import.meta.env.DEV && configured && /:5173|:5174/.test(configured)) {
    console.warn(
      '[Flexshell] VITE_SPRING_API_BASE_URL targets the Vite dev server; using http://localhost:8080 for growth summary stream.'
    );
    return `http://localhost:8080${path}`;
  }
  return resolveSpringApiUrl(path);
}

export async function postGrowthHistorySummaryNdjson(
  body: GrowthHistorySummaryPayload,
  handlers: GrowthHistorySummaryStreamHandlers,
  signal?: AbortSignal
): Promise<string> {
  const url = resolveGrowthHistorySummaryStreamUrl();
  await ensureAccessTokenFreshForFetch();

  const opts: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'Accept-Language': activeAppLocale(),
      'X-Trace-Id': getOrCreateTraceId()
    },
    body: JSON.stringify(body),
    signal: buildStreamSignal(signal)
  };

  let res = await fetch(url, opts);
  if (res.status === 401) {
    const refreshed = await refreshHospitalAccessCookies();
    if (refreshed) {
      res = await fetch(url, opts);
    }
  }
  if (!res.ok || !res.body) {
    throw new Error(`growth_summary_stream_http_${res.status}`);
  }

  const sawComplete = { value: false };
  let summaryText = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchWrappedLine = (line: string): void => {
    dispatchNdjsonLine(line, {
      onDelta: (chunk) => {
        summaryText += chunk;
        handlers.onDelta?.(chunk);
      },
      onComplete: (summary) => {
        summaryText = summary || summaryText;
        handlers.onComplete?.(summaryText);
      }
    }, sawComplete);
  };

  const drainBufferedLines = (): void => {
    for (;;) {
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx < 0) break;
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      dispatchWrappedLine(line);
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
        dispatchWrappedLine(tail);
      }
      if (!sawComplete.value && !summaryText.trim()) {
        throw new Error('growth_summary_stream_incomplete');
      }
      break;
    }
  }

  return summaryText.trim();
}
