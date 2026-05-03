import { getOrCreateTraceId } from '../logging/traceContext';
import { shouldSkipTelemetrySessionSummaryForApiUrl } from './telemetryUrlSkip';

/**
 * Single entry for Spring API base URL, path constants, and low-level HTTP to the server.
 * Do not call `fetch()` against the API elsewhere—use {@link URLRegistry.request},
 * {@link URLRegistry.requestResolvedUrl}, or axios {@link apiClient} with {@link URLRegistry.paths}.
 */

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_SPRING_API_BASE_URL ?? 'http://localhost:8080';
  const base = String(raw).replace(/\/$/, '');
  if (import.meta.env.PROD && base.startsWith('http://')) {
    console.warn(
      '[Flexshell] VITE_SPRING_API_BASE_URL should use https in production to avoid mixed content and protect health data in transit.'
    );
  }
  return base;
}

export const SERVER_PATHS = {
  products: '/api/products',
  /** Persist / load UI metadata from server overrides. */
  uiMetadata: '/api/uiMetadata',
  logsBatch: '/api/logs/batch',
  logsLevel: '/api/logs/level',
  login: '/api/auth/login',
  googleLogin: '/api/auth/google-login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  register: '/api/auth/register',
  changePassword: '/api/auth/change-password',
  medicalDepartmentGet: '/api/medical-department/get',
  doctorGet: '/api/doctor/get',
  doctorListActive: '/api/doctor/list-active',
  doctorSchedule: '/api/doctor/schedule',
  appointmentAvailableSlots: '/api/appointment/available-slots',
  /** Book flow: schedule minus open appointments (preferred for booking UI). */
  appointmentBookingAvailableSlots: '/api/appointment/booking/available-slots',
  appointmentCreate: '/api/appointment/create',
  appointmentGet: '/api/appointment/get',
  appointmentUpdate: '/api/appointment/update',
  appointmentDelete: '/api/appointment/delete',
  appointmentCancel: '/api/appointment/cancel',
  appointmentComplete: '/api/appointment/complete',
  /** Structured e-prescription: append `/{appointmentId}/…` (ensure-draft, draft, validate, finalize, pdf). */
  prescriptionAppointmentBase: '/api/prescription/appointment',
  appointmentOccupiedSlots: '/api/appointment/occupied-slots',
  medicinesSearch: '/api/medicines/search',
  chatRooms: '/api/chat/rooms',
  chatDirectRoom: '/api/chat/rooms/direct',
  chatSupportRequest: '/api/chat/support/request',
  chatSupportAccept: '/api/chat/support/accept',
  chatSupportReject: '/api/chat/support/reject',
  chatSupportOpen: '/api/chat/support/open',
  telemetrySessionEvent: '/api/telemetry/session-event',
  /** Ordered apply of multiple session events (logout flush); max 100 per request. */
  telemetrySessionEvents: '/api/telemetry/session-events',
  /** GET `?trace_id=` — current tab session row including `sessionSummary` (public). */
  telemetrySessionSnapshot: '/api/telemetry/session-snapshot',
  /** Mint RTC / vendor session after hospital call permission checks. */
  hospitalVideoSession: '/api/hospital/video/session',
  hospitalAiChat: '/api/hospital/ai/chat',
  /** GET `?limit=` — public LLM-generated wellness blog teasers (cached on server). */
  hospitalBlogPreviews: '/api/hospital/blog/previews',
  /** GET/PUT user by id: pass `userId` query param; PUT profile update uses registration-shaped JSON; PUT `inactive=true` deactivates. */
  user: '/api/user',
  /** PUT save profile: same body as `PUT /api/user`; optional `userId` query (else JWT principal). */
  userProfile: '/api/user/profile',
  test: '/api/test',
  /** GET `?q=` — YouTube channel hero video (public; API key on server). Empty `q` = top recent upload by views/likes (server config). Optional `user_id` scopes query_cache. */
  youtubeHeroVideo: '/api/youtube/hero-video',
  /** GET `?userId=&limit=` — recent YouTube hero queries from `query_cache` (authenticated; self only). */
  youtubeUserQueries: '/api/user/youtube-queries',
  adminRoleRequests: '/api/admin/role-requests',
  adminDoctors: '/api/admin/doctors',
  adminAppointments: '/api/admin/appointments'
} as const;

/** GET single teaser by URL slug (same pool as {@link SERVER_PATHS.hospitalBlogPreviews}). */
export function hospitalBlogPreviewBySlugPath(slug: string): string {
  return `${getApiBaseUrl()}${SERVER_PATHS.hospitalBlogPreviews}/slug/${encodeURIComponent(slug)}`;
}

export type ServerPathKey = keyof typeof SERVER_PATHS;

async function emitFetchSessionSummary(
  apiPath: string,
  method: string,
  startedAt: number,
  outcome: { type: 'response'; response: Response } | { type: 'network'; error: unknown }
): Promise<void> {
  if (shouldSkipTelemetrySessionSummaryForApiUrl(apiPath)) {
    return;
  }
  const durationMs = Math.round(performance.now() - startedAt);
  try {
    const { emitLoggedInSessionSummary } = await import('../analytics/sessionSummary');
    const { SessionSummaryKind } = await import('../analytics/sessionSummary/sessionSummaryKinds');
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
    void emitFetchSessionSummary(resolvedUrl, method, t0, { type: 'response', response });
    return response;
  } catch (error) {
    void emitFetchSessionSummary(resolvedUrl, method, t0, { type: 'network', error });
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
