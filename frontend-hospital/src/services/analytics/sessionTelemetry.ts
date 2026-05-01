import { URLRegistry } from '../http/URLRegistry';

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

export async function ingestSessionTelemetry(payload: SessionTelemetryPayload): Promise<void> {
  try {
    const { user_id: explicitUserId, ...rest } = payload;
    const userId = (explicitUserId ?? readPersistedUserId()).trim() || undefined;
    await URLRegistry.request('telemetrySessionEvent', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...rest,
        ...(userId ? { user_id: userId } : {})
      })
    });
  } catch {
    // Keep analytics non-blocking; failures here must never affect UX flows.
  }
}
