/** Normalize to lowercase path without query (works for absolute and relative URLs). */
export function normalizeTelemetryApiPath(url: string): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname.toLowerCase();
    }
  } catch {
    // fall through
  }
  const q = raw.indexOf('?');
  const path = q >= 0 ? raw.slice(0, q) : raw;
  return path.toLowerCase();
}

/** Never record session_summary rows for telemetry ingest (feedback loop). */
const SKIP_ALL_SUMMARY_PATHS = ['/api/logs/', '/api/telemetry/'] as const;

/** Background token rotation — omit successes and transport failures. */
const SKIP_AUTH_REFRESH_PATHS = ['/api/auth/refresh'] as const;

/** Omit successful calls for auth + background catalog/hero fetches. */
const SKIP_API_CALL_ONLY_PATHS = [
  '/api/auth/login',
  '/api/auth/google-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/user/youtube-queries',
  '/api/hospital/education/books',
  '/api/hospital/education/key-topics',
  '/api/hospital/education/prescription-transcribe'
] as const;

function pathMatches(path: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => path.includes(fragment));
}

export type SessionSummaryApiKind = 'api_call' | 'api_error';

/**
 * Returns true when an HTTP round trip should not append a {@code session_summary} row.
 * Infrastructure and background calls are excluded; user-facing education errors (e.g. key-topics timeout) are kept.
 */
export function shouldSkipTelemetrySessionSummaryForApiUrl(
  url: string,
  kind: SessionSummaryApiKind = 'api_call'
): boolean {
  const path = normalizeTelemetryApiPath(url);
  if (!path) return false;
  if (pathMatches(path, SKIP_ALL_SUMMARY_PATHS)) return true;
  if (pathMatches(path, SKIP_AUTH_REFRESH_PATHS)) return true;
  if (kind === 'api_error' && path.includes('/api/auth/logout')) {
    return true;
  }
  if (kind === 'api_call' && pathMatches(path, SKIP_API_CALL_ONLY_PATHS)) {
    return true;
  }
  return false;
}
