import { isAxiosError } from 'axios';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import {
  emitLoggedInSessionSummary,
  getOrCreateTraceId,
  ingestSessionTelemetry
} from '@/analytics/sessionTelemetry';

const GROWTH_HISTORY_SUMMARY_PATH = `${SERVER_PATHS.growthRecords}/history-summary/stream`;
const REASON_CODE = 'history_summary_failed';

function resolveErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { Message?: string; message?: string } | undefined;
    return String(data?.Message ?? data?.message ?? err.message ?? 'Request failed').slice(0, 500);
  }
  if (err instanceof Error) {
    return err.message.slice(0, 500);
  }
  return String(err ?? 'Request failed').slice(0, 500);
}

/** Non-blocking session telemetry when optional growth history summary enrichment fails. */
export function recordGrowthHistorySummaryFailure(
  recordExternalId: string,
  err: unknown,
  durationMs?: number
): void {
  const http_status = isAxiosError(err) ? err.response?.status : undefined;
  const error_message = resolveErrorMessage(err);
  const trace_id = getOrCreateTraceId();

  void emitLoggedInSessionSummary({
    kind: 'growth_history_summary',
    api_path: GROWTH_HISTORY_SUMMARY_PATH,
    http_method: 'POST',
    http_status,
    duration_ms: durationMs,
    reason_code: REASON_CODE,
    error_message,
    attributes: {
      growth_record_external_id: recordExternalId
    }
  });

  void ingestSessionTelemetry({
    event_name: 'growth_history_summary_failed',
    flow: 'growth',
    status: 'fail',
    reason_code: REASON_CODE,
    http_status,
    trace_id
  });
}
