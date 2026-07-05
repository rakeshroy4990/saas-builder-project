import { SERVER_PATHS, toTelemetryWire } from '@saas-builder/hospital-api-client';
import axios from 'axios';

import { refreshAccessToken } from '@/api/tokenRefresh';
import { getMobileApiBaseUrl } from '@/api/config';
import { DEFAULT_API_TIMEOUT_MS, TELEMETRY_BATCH_TIMEOUT_MS } from '@/api/timeouts';
import { getClientContext } from '@/analytics/clientContext';
import {
  enqueueTelemetryBody,
  readOutboxBodies,
  removeOutboxBodies
} from '@/analytics/sessionTelemetryOutbox';
import { useSessionStore } from '@/auth/sessionStore';

let traceId: string | null = null;
let lastKnownRoutePath = '';

export function setLastKnownRoutePath(path: string): void {
  lastKnownRoutePath = String(path ?? '').trim();
}

export function readLastKnownRoutePath(): string {
  return lastKnownRoutePath;
}

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
  return JSON.stringify(toTelemetryWire({
    ...ctx,
    ...restWithoutLs,
    ...(userId ? { user_id: userId } : {}),
    ...(ls ? { login_session_id: ls } : {})
  }));
}

export async function ingestSessionTelemetry(payload: SessionTelemetryPayload): Promise<void> {
  try {
    const body = await buildBody(payload);
    queue.push(body);
    await enqueueTelemetryBody(body);
  } catch {
    // Non-blocking
  }
}

async function postBodiesOnce(bodies: string[]): Promise<void> {
  const base = getMobileApiBaseUrl();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Trace-Id': getOrCreateTraceId()
  };
  const token = useSessionStore.getState().accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (bodies.length === 1) {
    await axios.post(`${base}${SERVER_PATHS.telemetrySessionEvent}`, JSON.parse(bodies[0]), {
      headers,
      timeout: DEFAULT_API_TIMEOUT_MS
    });
    return;
  }
  await axios.post(
    `${base}${SERVER_PATHS.telemetrySessionEvents}`,
    toTelemetryWire({ events: bodies.map((b) => JSON.parse(b)) }),
    { headers, timeout: TELEMETRY_BATCH_TIMEOUT_MS }
  );
}

async function postBodies(bodies: string[]): Promise<void> {
  if (bodies.length === 0) return;
  // Telemetry ingest is permitAll — avoid blocking on token refresh (especially pre-login crashes).
  try {
    await postBodiesOnce(bodies);
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw error;
    }
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      await postBodiesOnce(bodies);
      return;
    }
    await postBodiesOnce(bodies);
  }
}

export function flushSessionTelemetryQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const memoryBatch = queue.splice(0, queue.length);
    let diskBodies: string[] = [];
    try {
      diskBodies = await readOutboxBodies();
    } catch {
      diskBodies = [];
    }
    const batch = [...memoryBatch, ...diskBodies];
    if (batch.length === 0) return;

    try {
      await postBodies(batch);
      if (diskBodies.length > 0) {
        await removeOutboxBodies(diskBodies.length);
      }
    } catch {
      queue.unshift(...memoryBatch);
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

export type AuthLoginTelemetryMeta = {
  duration_ms?: number;
  http_status?: number;
  api_path?: string;
  http_method?: string;
};

export type AppCrashTelemetryMeta = {
  reason_code: string;
  error_message: string;
  error_name?: string;
  component_stack?: string;
  route_path?: string;
  attributes?: Record<string, unknown>;
};

/**
 * Records a client crash in session_telemetry:
 * - event {@code app_crash} with {@code flow=crash} (searchable counters / last_flow)
 * - summary row {@code kind=crash} with {@code attributes.category=crash} when logged in
 */
export function recordAppCrashTelemetry(meta: AppCrashTelemetryMeta): void {
  void (async () => {
    try {
      const trace = getOrCreateTraceId();
      const message = String(meta.error_message ?? 'Unknown error').slice(0, 500);
      const routePath = (meta.route_path ?? readLastKnownRoutePath()).trim();
      const email = readUserEmail();

      const crashBody = await buildBody({
        event_name: 'app_crash',
        flow: 'crash',
        status: 'fail',
        reason_code: meta.reason_code,
        trace_id: trace
      });
      queue.push(crashBody);
      await enqueueTelemetryBody(crashBody);

      if (readUserId()) {
        const summaryBody = await buildBody({
          event_name: 'session_summary_row',
          flow: 'session',
          status: 'fail',
          reason_code: meta.reason_code,
          trace_id: trace,
          session_summary_entry: {
            entry_id: newSessionSummaryEntryId(),
            occurred_at: new Date().toISOString(),
            kind: 'crash',
            reason_code: meta.reason_code,
            error_message: message,
            ...(routePath ? { route_path: routePath } : {}),
            ...(email ? { user_email: email } : {}),
            attributes: {
              category: 'crash',
              ...(meta.error_name ? { error_name: meta.error_name } : {}),
              ...(meta.component_stack
                ? { component_stack: meta.component_stack.slice(0, 2000) }
                : {}),
              ...(meta.attributes ?? {})
            }
          }
        });
        queue.push(summaryBody);
        await enqueueTelemetryBody(summaryBody);
      }

      await flushSessionTelemetryQueue();
    } catch {
      // Non-blocking
    }
  })();
}

export type AiChatStreamTelemetryMeta = {
  api_path: string;
  http_method?: string;
  http_status?: number;
  duration_ms: number;
  stream_mode: 'ndjson' | 'json_fallback' | 'buffered_fallback';
  context?: string;
  time_to_first_byte_ms?: number;
  time_to_ready_ms?: number;
  time_to_first_status_ms?: number;
  time_to_first_delta_ms?: number;
  error?: boolean;
  error_message?: string;
};

/** Records NDJSON AI chat timing milestones into session_telemetry (non-blocking). */
export function recordAiChatStreamTelemetry(meta: AiChatStreamTelemetryMeta): void {
  void (async () => {
    try {
      await emitLoggedInSessionSummary({
        kind: 'ai_chat_stream',
        api_path: meta.api_path,
        http_method: meta.http_method ?? 'POST',
        http_status: meta.http_status,
        duration_ms: meta.duration_ms,
        reason_code: meta.error ? 'stream_error' : 'stream_complete',
        attributes: {
          stream_mode: meta.stream_mode,
          ...(meta.context ? { context: meta.context } : {}),
          ...(meta.time_to_first_byte_ms != null
            ? { time_to_first_byte_ms: meta.time_to_first_byte_ms }
            : {}),
          ...(meta.time_to_ready_ms != null ? { time_to_ready_ms: meta.time_to_ready_ms } : {}),
          ...(meta.time_to_first_status_ms != null
            ? { time_to_first_status_ms: meta.time_to_first_status_ms }
            : {}),
          ...(meta.time_to_first_delta_ms != null
            ? { time_to_first_delta_ms: meta.time_to_first_delta_ms }
            : {}),
          ...(meta.error ? { error: true } : {})
        },
        ...(meta.error_message ? { error_message: meta.error_message.slice(0, 500) } : {})
      });
      scheduleFlushSessionTelemetry();
    } catch {
      // Non-blocking
    }
  })();
}

type AuthMethod = 'password' | 'google' | 'token_refresh';

function emitAuthLoginSummary(authMethod: AuthMethod, meta?: AuthLoginTelemetryMeta): Promise<void> {
  return emitLoggedInSessionSummary({
    kind: 'auth_login',
    http_method: meta?.http_method,
    http_status: meta?.http_status,
    duration_ms: meta?.duration_ms,
    api_path: meta?.api_path,
    attributes: { auth_method: authMethod }
  });
}

/** @deprecated Use {@link recordSuccessfulLoginTelemetry} with meta from the auth HTTP call. */
export async function emitSessionSummaryAuthLogin(
  authMethod: 'password' | 'google',
  meta?: AuthLoginTelemetryMeta
): Promise<void> {
  await emitAuthLoginSummary(authMethod, meta);
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

/** Queue login/session rows and POST to session_telemetry without blocking UI. */
export function recordSuccessfulLoginTelemetry(
  authMethod: AuthMethod,
  meta?: AuthLoginTelemetryMeta
): void {
  if (authMethod !== 'token_refresh') {
    mintLoginSessionId();
  } else if (!readLoginSessionId()) {
    mintLoginSessionId();
  }
  void (async () => {
    try {
      await emitAuthLoginSummary(authMethod, meta);
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
