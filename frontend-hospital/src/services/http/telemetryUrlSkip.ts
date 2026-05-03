/** Avoid feedback loops: session_summary rows must not be recorded for telemetry ingest calls. */
export function shouldSkipTelemetrySessionSummaryForApiUrl(url: string): boolean {
  return url.includes('/api/telemetry/session-event') || url.includes('/api/telemetry/session-events');
}
