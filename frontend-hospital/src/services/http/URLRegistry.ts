import { emitLoggedInSessionSummary } from '../analytics/sessionSummary/emitSessionSummary';
import { SessionSummaryKind } from '../analytics/sessionSummary/sessionSummaryKinds';
import { getOrCreateTraceId } from '../logging/traceContext';
import { getApiBaseUrl, SERVER_PATHS } from './apiPaths';
import type { ServerPathKey } from './apiPaths';
import { shouldSkipTelemetrySessionSummaryForApiUrl } from './telemetryUrlSkip';

export { getApiBaseUrl, SERVER_PATHS } from './apiPaths';
export type { ServerPathKey } from './apiPaths';

/**
 * Single entry for Spring API base URL, path constants, and low-level HTTP to the server.
 * Do not call `fetch()` against the API elsewhere—use {@link URLRegistry.request},
 * {@link URLRegistry.requestResolvedUrl}, or axios {@link apiClient} with {@link URLRegistry.paths}.
 */

/** GET single teaser by URL slug (same pool as {@link SERVER_PATHS.hospitalBlogPreviews}). */
export function hospitalBlogPreviewBySlugPath(slug: string): string {
  return `${getApiBaseUrl()}${SERVER_PATHS.hospitalBlogPreviews}/slug/${encodeURIComponent(slug)}`;
}

function emitFetchSessionSummary(
  apiPath: string,
  method: string,
  startedAt: number,
  outcome: { type: 'response'; response: Response } | { type: 'network'; error: unknown }
): void {
  if (shouldSkipTelemetrySessionSummaryForApiUrl(apiPath)) {
    return;
  }
  const durationMs = Math.round(performance.now() - startedAt);
  try {
    if (outcome.type === 'response') {
      emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_CALL,
        api_path: apiPath,
        http_method: method,
        http_status: outcome.response.status,
        duration_ms: durationMs
      });
    } else {
      const err = outcome.error;
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : err == null
              ? 'Network error'
              : String(err);
      emitLoggedInSessionSummary({
        kind: SessionSummaryKind.API_ERROR,
        api_path: apiPath,
        http_method: method,
        duration_ms: durationMs,
        error_message: msg.slice(0, 2000)
      });
    }
  } catch {
    // Session summary must never affect fetch
  }
}

function assertUnderApiBase(resolvedUrl: string): void {
  const base = getApiBaseUrl();
  if (!resolvedUrl.startsWith(base)) {
    throw new Error(`requestResolvedUrl: URL must start with API base (${base})`);
  }
}

/**
 * `fetch` to the hospital API with the same credentials/headers as {@link URLRegistry.request},
 * plus a {@link SessionSummaryKind.API_CALL} / {@link SessionSummaryKind.API_ERROR} row (when logged in)
 * with {@code duration_ms} matching axios-backed calls.
 */
async function trackedFetch(resolvedUrl: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('X-Trace-Id')) {
    headers.set('X-Trace-Id', getOrCreateTraceId());
  }
  const method = String(init?.method ?? 'GET').toUpperCase();
  const t0 = performance.now();
  try {
    const response = await fetch(resolvedUrl, { ...init, headers, credentials: init?.credentials ?? 'include' });
    emitFetchSessionSummary(resolvedUrl, method, t0, { type: 'response', response });
    return response;
  } catch (error) {
    emitFetchSessionSummary(resolvedUrl, method, t0, { type: 'network', error });
    throw error;
  }
}

export const URLRegistry = {
  paths: SERVER_PATHS,
  getBaseUrl: getApiBaseUrl,

  resolve(pathKey: ServerPathKey): string {
    return `${getApiBaseUrl()}${SERVER_PATHS[pathKey]}`;
  },

  /**
   * Registered path keys only (no query string). Records session_summary for the round trip.
   */
  request(pathKey: ServerPathKey, init?: RequestInit): Promise<Response> {
    return trackedFetch(`${getApiBaseUrl()}${SERVER_PATHS[pathKey]}`, init);
  },

  /**
   * Full URL under {@link getApiBaseUrl} (e.g. path + `?query=`), for callers that need query params.
   */
  requestResolvedUrl(resolvedUrl: string, init?: RequestInit): Promise<Response> {
    assertUnderApiBase(resolvedUrl);
    return trackedFetch(resolvedUrl, init);
  }
} as const;
