import { URLRegistry } from '../http/URLRegistry';

export type SessionTelemetryPayload = {
  event_name: string;
  flow: string;
  status?: string;
  reason_code?: string;
  http_status?: number;
  trace_id: string;
  user_id?: string;
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
    const userId = readPersistedUserId();
    await URLRegistry.request('telemetrySessionEvent', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...payload,
        ...(userId ? { user_id: userId } : {})
      })
    });
  } catch {
    // Keep analytics non-blocking; failures here must never affect UX flows.
  }
}
