import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

const SKIP_PATHS = [
  SERVER_PATHS.telemetrySessionEvent,
  SERVER_PATHS.telemetrySessionEvents,
  SERVER_PATHS.telemetrySessionSnapshot,
  '/api/logs/'
] as const;

export function shouldSkipTelemetrySessionSummaryForUrl(url: string): boolean {
  const path = String(url ?? '');
  return SKIP_PATHS.some((p) => path.includes(p));
}
