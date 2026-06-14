import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { getOrCreateTraceId } from '@/analytics/sessionTelemetry';
import { fetchWithAuthRetry } from '@/api/client';
import { getMobileApiBaseUrl } from '@/api/config';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';
import { activeMobileLocale } from '@/i18n/locale';

import { parseGrowthCharacteristics, type GrowthCharacteristics } from '@/features/growth/growthCharacteristics';

const GROWTH_SUMMARY_STREAM_TIMEOUT_MS = 120_000;

export type GrowthHistorySummaryStreamHandlers = {
  onDelta?: (chunk: string) => void;
  onComplete?: (summary: string, characteristics?: GrowthCharacteristics | null) => void;
};

type NdjsonEvent = Record<string, unknown> & {
  type?: string;
  Type?: string;
  data?: unknown;
  Data?: unknown;
  text?: string;
  Text?: string;
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function dispatchNdjsonLine(
  line: string,
  handlers: GrowthHistorySummaryStreamHandlers,
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

export async function postGrowthHistorySummaryNdjson(
  body: Record<string, unknown>,
  handlers: GrowthHistorySummaryStreamHandlers
): Promise<string> {
  const url = `${getMobileApiBaseUrl()}${SERVER_PATHS.growthRecords}/history-summary/stream`;
  const payload = JSON.stringify({ ...body, ReplyLocale: activeMobileLocale() });

  const res = await fetchWithAuthRetry(async () =>
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        'Accept-Language': acceptLanguageHeaderValue(activeMobileLocale()),
        'X-Trace-Id': getOrCreateTraceId()
      },
      body: payload,
      signal: AbortSignal.timeout(GROWTH_SUMMARY_STREAM_TIMEOUT_MS)
    })
  );

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
      break;
    }
  }

  return summaryText.trim();
}
