import { SERVER_PATHS } from '@saas-builder/hospital-api-client';
import axios from 'axios';

import { getMobileApiBaseUrl } from '@/api/config';
import { getClientContext } from '@/analytics/clientContext';
import { useSessionStore } from '@/auth/sessionStore';

let traceId: string | null = null;

export function getOrCreateTraceId(): string {
  if (traceId?.trim()) return traceId;
  traceId = `trace-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  return traceId;
}

export function resetTraceId(): void {
  traceId = null;
}

export type SessionSummaryEntryPayload = {
  entry_id: string;
  occurred_at?: string;
  kind: string;
  page_id?: string;
  package_name?: string;
  route_path?: string;
  api_path?: string;
  http_method?: string;
  http_status?: number;
  duration_ms?: number;
  error_message?: string;
  reason_code?: string;
  action_alias?: string;
  action_id?: string;
  user_email?: string;
  attributes?: Record<string, unknown>;
};

export type SessionTelemetryPayload = {
  event_name: string;
  flow: string;
  status?: string;
  reason_code?: string;
  http_status?: number;
  trace_id: string;
  login_session_id?: string;
  user_id?: string;
  session_summary_entry?: SessionSummaryEntryPayload;
};

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

const queue: string[] = [];
let flushInFlight: Promise<void> | null = null;
let loginSessionId: string | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

/** Fire-and-forget network flush — never blocks UI callers. */
export function scheduleFlushSessionTelemetry(): void {
  void flushSessionTelemetryQueue().catch(() => undefined);
}

export function mintLoginSessionId(): string {
  loginSessionId = `mls-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  return loginSessionId;
}

export function clearLoginSessionId(): void {
  loginSessionId = null;
}

export function readLoginSessionId(): string {
  return loginSessionId?.trim() ?? '';
}

function readUserId(): string {
  return useSessionStore.getState().user?.userId?.trim() ?? '';
}

function readUserEmail(): string {
  return useSessionStore.getState().user?.email?.trim() ?? '';
}

async function buildBody(payload: SessionTelemetryPayload): Promise<string> {
  const { user_id: explicitUserId, ...rest } = payload;
  const userId = (explicitUserId ?? readUserId()).trim();
  const ls = (rest.login_session_id ?? readLoginSessionId()).trim();
  const { login_session_id: _ls, ...restWithoutLs } = rest;
  const ctx = await getClientContext();
  return JSON.stringify({
    ...ctx,
    ...restWithoutLs,
    ...(userId ? { user_id: userId } : {}),
    ...(ls ? { login_session_id: ls } : {})
  });
}

export async function ingestSessionTelemetry(payload: SessionTelemetryPayload): Promise<void> {
  try {
    queue.push(await buildBody(payload));
  } catch {
    // Non-blocking
  }
}

async function postBodies(bodies: string[]): Promise<void> {
  if (bodies.length === 0) return;
  const base = getMobileApiBaseUrl();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Trace-Id': getOrCreateTraceId()
  };
  const token = useSessionStore.getState().accessToken;
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  if (bodies.length === 1) {
    await axios.post(`${base}${SERVER_PATHS.telemetrySessionEvent}`, JSON.parse(bodies[0]), {
      headers,
      timeout: 30_000
    });
    return;
  }
  await axios.post(
    `${base}${SERVER_PATHS.telemetrySessionEvents}`,
    { events: bodies.map((b) => JSON.parse(b)) },
    { headers, timeout: 60_000 }
  );
}

export function flushSessionTelemetryQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (queue.length === 0) return Promise.resolve();

  flushInFlight = (async () => {
    const batch = queue.splice(0, queue.length);
    try {
      await postBodies(batch);
    } catch {
      queue.unshift(...batch);
    } finally {
      flushInFlight = null;
    }
  })();

  return flushInFlight;
}

export function newSessionSummaryEntryId(): string {
  return `mse-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function emitLoggedInSessionSummary(
  row: Omit<SessionSummaryEntryPayload, 'entry_id' | 'occurred_at'>
): Promise<void> {
  if (!readUserId()) return;
  const email = readUserEmail();
  await ingestSessionTelemetry({
    event_name: 'session_summary_row',
    flow: 'session',
    status: 'ok',
    trace_id: getOrCreateTraceId(),
    session_summary_entry: {
      entry_id: newSessionSummaryEntryId(),
      occurred_at: new Date().toISOString(),
      ...row,
      ...(email ? { user_email: email } : {})
    }
  });
}

export async function emitSessionSummaryAuthLogin(authMethod: 'password' | 'google'): Promise<void> {
  await emitLoggedInSessionSummary({
    kind: 'auth_login',
    attributes: { auth_method: authMethod }
  });
}

export function startSessionTelemetrySyncScheduler(): void {
  stopSessionTelemetrySyncScheduler();
  syncTimer = setInterval(() => {
    void runPeriodicSessionTelemetrySync();
  }, SYNC_INTERVAL_MS);
}

export function stopSessionTelemetrySyncScheduler(): void {
  if (syncTimer != null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function runPeriodicSessionTelemetrySync(): Promise<void> {
  if (!readUserId()) return;
  const loggedInAtMs = useSessionStore.getState().loggedInAtMs;
  if (!loggedInAtMs || Date.now() - loggedInAtMs < SYNC_INTERVAL_MS) return;
  try {
    await emitLoggedInSessionSummary({
      kind: 'session_sync',
      attributes: { interval_minutes: 15 }
    });
    await flushSessionTelemetryQueue();
  } catch {
    // Non-blocking
  }
}

type AuthMethod = 'password' | 'google' | 'token_refresh';

/** Queue login/session rows and POST to session_telemetry without blocking UI. */
export function recordSuccessfulLoginTelemetry(authMethod: AuthMethod): void {
  if (authMethod !== 'token_refresh') {
    mintLoginSessionId();
  } else if (!readLoginSessionId()) {
    mintLoginSessionId();
  }
  void (async () => {
    try {
      if (authMethod === 'token_refresh') {
        await emitLoggedInSessionSummary({
          kind: 'auth_login',
          attributes: { auth_method: 'token_refresh' }
        });
      } else {
        await emitSessionSummaryAuthLogin(authMethod);
      }
      await ingestSessionTelemetry({
        event_name: 'login_success',
        flow: 'auth',
        status: 'ok',
        reason_code:
          authMethod === 'google'
            ? 'google_login'
            : authMethod === 'token_refresh'
              ? 'token_refresh'
              : 'password_login',
        trace_id: getOrCreateTraceId()
      });
      await flushSessionTelemetryQueue();
      startSessionTelemetrySyncScheduler();
    } catch {
      // Non-blocking
    }
  })();
}

/** Queue logout row and POST asynchronously (call before clearing session). */
export function recordLogoutTelemetry(): void {
  void (async () => {
    try {
      await ingestUserInitiatedLogoutSessionTelemetry();
      await flushSessionTelemetryQueue();
    } catch {
      // Non-blocking
    } finally {
      stopSessionTelemetrySyncScheduler();
    }
  })();
}

export async function ingestUserInitiatedLogoutSessionTelemetry(): Promise<void> {
  if (!readUserId()) return;
  const email = readUserEmail();
  await ingestSessionTelemetry({
    event_name: 'logout',
    flow: 'auth',
    status: '',
    reason_code: '',
    trace_id: getOrCreateTraceId(),
    session_summary_entry: {
      entry_id: newSessionSummaryEntryId(),
      occurred_at: new Date().toISOString(),
      kind: 'auth_logout',
      attributes: { reason: 'user_initiated' },
      ...(email ? { user_email: email } : {})
    }
  });
}
