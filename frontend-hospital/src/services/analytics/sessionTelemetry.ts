import { getApiBaseUrl, SERVER_PATHS } from '../http/apiPaths';
import { getOrCreateTraceId } from '../logging/traceContext';
import { readLoginSessionId } from '../logging/loginSessionContext';
import { enqueueTelemetryBody, flushTelemetryOutbox } from './sessionTelemetryQueue';

export type SessionSummaryEntryPayload = {
  entry_id: string;
  occurred_at?: string;
  kind: string;
  page_id?: string;
  package_name?: string;
  component_id?: string;
  popup_page_id?: string;
  route_path?: string;
  api_path?: string;
  http_method?: string;
  http_status?: number;
  duration_ms?: number;
  error_message?: string;
  reason_code?: string;
  action_alias?: string;
  action_id?: string;
  /** Logged-in user email from persisted session (attached to all rows after login). */
  user_email?: string;
  /** Open-ended extension point for new event types without API churn. */
  attributes?: Record<string, unknown>;
};

export type SessionTelemetryPayload = {
  event_name: string;
  flow: string;
  status?: string;
  reason_code?: string;
  http_status?: number;
  trace_id: string;
  /**
   * Set for authenticated flows after login; server groups session_summary into a new session_telemetry
   * document per login when present.
   */
  login_session_id?: string;
  /**
   * When set, overrides the user id read from session storage (e.g. last telemetry before clearing profile).
   * Prefer leaving unset so the client uses the persisted profile.
   */
  user_id?: string;
  session_summary_entry?: SessionSummaryEntryPayload;
};

function readPersistedUserId(): string {
  try {
    const raw = sessionStorage.getItem('flexshell_auth_session_profile');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return String(parsed.userId ?? '').trim();
  } catch {
    return '';
  }
}

function postSessionEventBody(body: string): Promise<Response> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Trace-Id': getOrCreateTraceId()
  });
  return fetch(`${getApiBaseUrl()}${SERVER_PATHS.telemetrySessionEvent}`, {
    method: 'POST',
    credentials: 'omit',
    headers,
    body
  });
}

/**
 * Buffers one telemetry payload for later {@link flushSessionTelemetryQueue} (logout / session expiry).
 * Does not hit the network immediately.
 */
export async function ingestSessionTelemetry(payload: SessionTelemetryPayload): Promise<void> {
  try {
    const { user_id: explicitUserId, ...rest } = payload;
    const userId = (explicitUserId ?? readPersistedUserId()).trim() || undefined;
    const loginSessionId = (rest.login_session_id ?? readLoginSessionId()).trim();
    const { login_session_id: _ls, ...restWithoutLs } = rest;
    const body = JSON.stringify({
      ...restWithoutLs,
      ...(userId ? { user_id: userId } : {}),
      ...(loginSessionId ? { login_session_id: loginSessionId } : {})
    });
    await enqueueTelemetryBody(body);
  } catch {
    // Keep analytics non-blocking; failures here must never affect UX flows.
  }
}

/** Sends all queued session-event rows (FIFO). Safe to call multiple times; work is serialized. */
export function flushSessionTelemetryQueue(): Promise<void> {
  return flushTelemetryOutbox(postSessionEventBody);
}
