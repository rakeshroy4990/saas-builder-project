import type { Router } from 'vue-router';
import { getOrCreateTraceId } from '../../logging/traceContext';
import { ingestSessionTelemetry, type SessionSummaryEntryPayload } from '../sessionTelemetry';
import { SessionSummaryKind, type SessionSummaryKindValue } from './sessionSummaryKinds';

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

function readPersistedUserEmail(): string {
  try {
    const raw = sessionStorage.getItem('flexshell_auth_session_profile');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return String(parsed.email ?? '').trim();
  } catch {
    return '';
  }
}

export function isLoggedInForSessionSummary(): boolean {
  return readPersistedUserId().length > 0;
}

export function newSessionSummaryEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sse-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type SessionSummaryRowInput = Omit<SessionSummaryEntryPayload, 'entry_id' | 'occurred_at'> & {
  kind: SessionSummaryKindValue | string;
};

/**
 * Appends one row to Mongo `sessionSummary` for the current user + trace (no-op when anonymous).
 */
export function emitLoggedInSessionSummary(row: SessionSummaryRowInput): void {
  if (!isLoggedInForSessionSummary()) return;
  const trace_id = getOrCreateTraceId();
  const email = readPersistedUserEmail();
  const session_summary_entry: SessionSummaryEntryPayload = {
    entry_id: newSessionSummaryEntryId(),
    occurred_at: new Date().toISOString(),
    ...row,
    ...(email ? { user_email: email } : {})
  };
  void ingestSessionTelemetry({
    event_name: 'session_summary_row',
    flow: 'session',
    status: 'ok',
    trace_id,
    session_summary_entry
  });
}

export function emitSessionSummaryAuthLogin(authMethod: 'password' | 'google'): void {
  emitLoggedInSessionSummary({
    kind: SessionSummaryKind.AUTH_LOGIN,
    attributes: { auth_method: authMethod }
  });
}

export function emitSessionSummaryAuthLogout(attributes?: Record<string, unknown>): void {
  emitLoggedInSessionSummary({
    kind: SessionSummaryKind.AUTH_LOGOUT,
    attributes: attributes ?? { reason: 'user_initiated' }
  });
}

/** Coalesce rapid `afterEach` navigations into one queued summary row (fewer rows / faster logout flush). */
const NAVIGATE_DEBOUNCE_MS = 400;
let navigateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingNavigateRow: SessionSummaryRowInput | null = null;

/**
 * Flushes a debounced navigation summary immediately (call before logout / deactivate so the last route is captured).
 */
export function flushPendingSessionSummaryNavigate(): void {
  if (navigateDebounceTimer != null) {
    clearTimeout(navigateDebounceTimer);
    navigateDebounceTimer = null;
  }
  if (pendingNavigateRow) {
    emitLoggedInSessionSummary(pendingNavigateRow);
    pendingNavigateRow = null;
  }
}

/** Router hook: record page navigations for the logged-in session. */
export function initSessionSummaryNavigation(router: Router): void {
  router.afterEach((to) => {
    const pageId =
      String(to.params.pageId ?? '').trim() || String(to.path.replace(/^\//, '').split('/')[0] ?? '').trim();
    pendingNavigateRow = {
      kind: SessionSummaryKind.NAVIGATE,
      page_id: pageId || undefined,
      package_name: 'hospital',
      route_path: to.fullPath
    };
    if (navigateDebounceTimer != null) {
      clearTimeout(navigateDebounceTimer);
    }
    navigateDebounceTimer = setTimeout(() => {
      navigateDebounceTimer = null;
      if (pendingNavigateRow) {
        emitLoggedInSessionSummary(pendingNavigateRow);
        pendingNavigateRow = null;
      }
    }, NAVIGATE_DEBOUNCE_MS);
  });
}
