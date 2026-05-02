import { getOrCreateTraceId } from '../logging/traceContext';

/**
 * Single entry for Spring API base URL, path constants, and low-level HTTP to the server.
 * Do not call `fetch()` against the API elsewhere—use {@link URLRegistry.request} or axios
 * {@link apiClient} with {@link URLRegistry.paths}.
 */

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_SPRING_API_BASE_URL ?? 'http://localhost:8080';
  return String(raw).replace(/\/$/, '');
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
  /** GET `?trace_id=` — current tab session row including `sessionSummary` (public). */
  telemetrySessionSnapshot: '/api/telemetry/session-snapshot',
  /** Mint RTC / vendor session after hospital call permission checks. */
  hospitalVideoSession: '/api/hospital/video/session',
  hospitalAiChat: '/api/hospital/ai/chat',
  /** GET/PUT user by id: pass `userId` query param; PUT profile update uses registration-shaped JSON; PUT `inactive=true` deactivates. */
  user: '/api/user',
  /** PUT save profile: same body as `PUT /api/user`; optional `userId` query (else JWT principal). */
  userProfile: '/api/user/profile',
  test: '/api/test',
  /** GET `?q=` — YouTube channel hero video (public; API key on server). Empty `q` = top recent upload by views/likes (server config). Optional `user_id` scopes query_cache. */
  youtubeHeroVideo: '/api/youtube/hero-video',
  /** GET `?userId=&limit=` — recent YouTube hero queries from `query_cache` (authenticated; self only). */
  youtubeUserQueries: '/api/user/youtube-queries'
} as const;

export type ServerPathKey = keyof typeof SERVER_PATHS;

export const URLRegistry = {
  paths: SERVER_PATHS,
  getBaseUrl: getApiBaseUrl,

  resolve(pathKey: ServerPathKey): string {
    return `${getApiBaseUrl()}${SERVER_PATHS[pathKey]}`;
  },

  /**
   * All direct `fetch` calls to this backend must go through here.
   */
  request(pathKey: ServerPathKey, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers ?? {});
    if (!headers.has('X-Trace-Id')) {
      headers.set('X-Trace-Id', getOrCreateTraceId());
    }
    return fetch(URLRegistry.resolve(pathKey), { ...init, headers, credentials: init?.credentials ?? 'include' });
  }
} as const;
