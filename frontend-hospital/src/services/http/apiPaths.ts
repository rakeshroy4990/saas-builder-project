/**
 * API base URL and path constants only — no analytics or {@link URLRegistry} to avoid import cycles
 * (e.g. {@code sessionTelemetry} must not import {@code URLRegistry}).
 */

export function getApiBaseUrl(): string {
  const trimmed = String(import.meta.env.VITE_SPRING_API_BASE_URL ?? '').trim();
  const base = (trimmed || 'http://localhost:8080').replace(/\/$/, '');
  if (import.meta.env.PROD && base.startsWith('http://')) {
    console.warn(
      '[Flexshell] VITE_SPRING_API_BASE_URL should use https in production to avoid mixed content and protect health data in transit.'
    );
  }
  return base;
}

/** Absolute Spring URL; never a browser-relative `/api/...` (which would hit the UI origin, e.g. :5174). */
export function resolveSpringApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `Invalid VITE_SPRING_API_BASE_URL (${JSON.stringify(base)}). Use http://localhost:8080 for local dev.`
    );
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
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
  /** GET — clinical catalog proxied to pdf-rag `rag_pdf_registry` book names. */
  hospitalEducationBooks: '/api/hospital/education/books',
  /** GET `?BookName=&Limit=` — top section headings from Marker-ingested chunks. */
  hospitalEducationKeyTopics: '/api/hospital/education/key-topics',
  /** POST multipart `file` — doctor-only prescription image/PDF transcription for education chat. */
  hospitalEducationPrescriptionTranscribe: '/api/hospital/education/prescription-transcribe',
  /** Patient-uploaded prescription documents (storage + extraction). */
  patientPrescriptions: '/api/v1/patient-prescriptions',
  patientPrescriptionsUpload: '/api/v1/patient-prescriptions/upload',
  patientPrescriptionsSimilaritySearch: '/api/v1/patient-prescriptions/similarity-search',
  patientPrescriptionsSimilaritySearchStream: '/api/v1/patient-prescriptions/similarity-search/stream',
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
  adminAppointments: '/api/admin/appointments',
  patientDeviceReadings: '/api/v1/patient-device-readings'
} as const;

export type ServerPathKey = keyof typeof SERVER_PATHS;
