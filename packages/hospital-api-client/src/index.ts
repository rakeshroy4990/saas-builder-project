/**
 * Shared hospital API constants and response helpers (web + mobile).
 */

export function getApiBaseUrl(envBase?: string): string {
  const trimmed = String(envBase ?? '').trim();
  return (trimmed || 'http://localhost:8080').replace(/\/$/, '');
}

export function resolveSpringApiUrl(base: string, path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`Invalid API base URL (${JSON.stringify(base)}). Use http://localhost:8080 for local dev.`);
  }
  return `${base.replace(/\/$/, '')}${suffix}`;
}

export const SERVER_PATHS = {
  login: '/api/auth/login',
  googleLogin: '/api/auth/google-login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  register: '/api/auth/register',
  youtubeHeroVideo: '/api/youtube/hero-video',
  hospitalBlogPreviews: '/api/hospital/blog/previews',
  hospitalAiChat: '/api/hospital/ai/chat',
  hospitalEducationBooks: '/api/hospital/education/books',
  hospitalEducationKeyTopics: '/api/hospital/education/key-topics',
  hospitalEducationPrescriptionTranscribe: '/api/hospital/education/prescription-transcribe',
  patientPrescriptionsSimilaritySearch: '/api/v1/patient-prescriptions/similarity-search',
  user: '/api/user',
  appointmentGet: '/api/appointment/get',
  appointmentCreate: '/api/appointment/create',
  appointmentUpdate: '/api/appointment/update',
  appointmentBookingAvailableSlots: '/api/appointment/booking/available-slots',
  appointmentBookingDateAvailability: '/api/appointment/booking/date-availability',
  appointmentBookingFormContext: '/api/appointment/booking/form-context',
  adminAppointments: '/api/admin/appointments',
  medicalDepartmentGet: '/api/medical-department/get',
  doctorGet: '/api/doctor/get',
  doctorListPublic: '/api/doctor/list-public',
  patientPrescriptions: '/api/v1/patient-prescriptions',
  hospitalVideoSession: '/api/hospital/video/session',
  chatRooms: '/api/chat/rooms',
  patientDeviceReadings: '/api/v1/patient-device-readings',
  notifications: '/api/v1/notifications',
  notificationsUnreadCount: '/api/v1/notifications/unread-count',
  notificationsReadAll: '/api/v1/notifications/read-all',
  telemetrySessionEvent: '/api/telemetry/session-event',
  telemetrySessionEvents: '/api/telemetry/session-events',
  telemetrySessionSnapshot: '/api/telemetry/session-snapshot'
} as const;

export function appointmentJoinCallPath(appointmentId: string): string {
  return `/api/appointment/${encodeURIComponent(appointmentId)}/join-call`;
}

export function appointmentRenewTokenPath(appointmentId: string): string {
  return `/api/appointment/${encodeURIComponent(appointmentId)}/renew-token`;
}

export function appointmentEndCallPath(appointmentId: string): string {
  return `/api/appointment/${encodeURIComponent(appointmentId)}/end-call`;
}

export function notificationReadPath(externalId: string): string {
  return `/api/v1/notifications/${encodeURIComponent(externalId)}/read`;
}

export interface NotificationItem {
  externalId: string;
  eventType: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityExternalId?: string | null;
  entityRefId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SpringPage<T> {
  content?: T[];
  Content?: T[];
  totalElements?: number;
  TotalElements?: number;
}

export function parseNotificationItem(raw: unknown): NotificationItem | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const externalId = pickString(row, ['ExternalId', 'externalId']);
  const eventType = pickString(row, ['EventType', 'eventType']);
  const title = pickString(row, ['Title', 'title']);
  const message = pickString(row, ['Message', 'message']);
  if (!externalId || !eventType) return null;
  const entityType = pickString(row, ['EntityType', 'entityType']) || null;
  const entityExternalId = pickString(row, ['EntityExternalId', 'entityExternalId']) || null;
  const entityRefId = pickString(row, ['EntityRefId', 'entityRefId']) || null;
  const isRead = row.IsRead === true || row.isRead === true;
  const createdAt = pickString(row, ['CreatedAt', 'createdAt']);
  return {
    externalId,
    eventType,
    title,
    message: message || title,
    entityType,
    entityExternalId,
    entityRefId,
    isRead,
    createdAt
  };
}

export function parseUnreadNotificationCount(raw: unknown): number {
  const data = unwrapEnvelope<Record<string, unknown>>(raw);
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return pickNumber(row, ['Count', 'count']) ?? 0;
}

export function parseNotificationWsEvent(raw: unknown): NotificationItem | null {
  return parseNotificationItem(raw);
}

export interface VideoSessionPayload {
  provider: string;
  roomId: string;
  token: string;
  appId: string;
  uid: number;
  expiresAt: string;
}

export function parseVideoSessionPayload(data: unknown): VideoSessionPayload | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const provider = pickString(row, ['Provider', 'provider']) || 'agora';
  const roomId = pickString(row, ['RoomId', 'roomId', 'ChannelName', 'channelName']);
  const token = pickString(row, ['Token', 'token']);
  const appId = pickString(row, ['AppId', 'appId']);
  const uidRaw = row.Uid ?? row.uid;
  const uid =
    typeof uidRaw === 'number' && Number.isFinite(uidRaw)
      ? uidRaw
      : Number.parseInt(String(uidRaw ?? ''), 10);
  const expiresAt = pickString(row, ['ExpiresAt', 'expiresAt']);
  if (!roomId || !token || !appId || !Number.isFinite(uid) || uid === 0) {
    return null;
  }
  return { provider, roomId, token, appId, uid, expiresAt };
}

export type ServerPathKey = keyof typeof SERVER_PATHS;

export interface ApiEnvelope<T = unknown> {
  success?: boolean;
  Success?: boolean;
  data?: T;
  Data?: T;
  message?: string;
  Message?: string;
  timestamp?: string;
  Timestamp?: string;
  errorCode?: string;
  ErrorCode?: string;
  page?: number;
  Page?: number;
  size?: number;
  Size?: number;
  totalCount?: number;
  TotalCount?: number;
  /** @deprecated legacy pagination — prefer envelope TotalCount */
  totalElements?: number;
  /** @deprecated legacy pagination — prefer envelope TotalCount */
  TotalElements?: number;
  /** @deprecated legacy pagination */
  totalPages?: number;
  /** @deprecated legacy pagination */
  TotalPages?: number;
  /** @deprecated legacy pagination */
  number?: number;
  /** @deprecated legacy pagination */
  Number?: number;
}

export interface ParsedPagedList<T> {
  items: T[];
  totalCount: number;
  page: number;
  size: number;
}

/**
 * Parses entity list responses: row array in envelope Data; Page/Size/TotalCount on the envelope.
 * Falls back to legacy Data.Content and TotalElements when envelope pagination is absent.
 */
export function parsePagedEntityList<T>(
  raw: unknown,
  parseItem: (row: unknown) => T | null
): ParsedPagedList<T> {
  const envelope =
    raw != null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const data = envelope.Data ?? envelope.data;
  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data != null && typeof data === 'object') {
    const legacy = data as SpringPage<unknown>;
    rows = Array.isArray(legacy.content)
      ? legacy.content
      : Array.isArray(legacy.Content)
        ? legacy.Content
        : [];
  }
  const items = rows.map(parseItem).filter((entry): entry is T => entry !== null);
  const page =
    pickNumber(envelope, ['Page', 'page']) ??
    pickNumber((data ?? {}) as Record<string, unknown>, ['Number', 'number']) ??
    0;
  const size =
    pickNumber(envelope, ['Size', 'size']) ??
    pickNumber((data ?? {}) as Record<string, unknown>, ['Size', 'size']) ??
    items.length;
  const totalCount =
    pickNumber(envelope, ['TotalCount', 'totalCount', 'TotalElements', 'totalElements']) ??
    pickNumber((data ?? {}) as Record<string, unknown>, ['TotalCount', 'totalCount', 'TotalElements', 'totalElements']) ??
    items.length;
  return { items, page, size, totalCount };
}

export function parseNotificationPage(raw: unknown): NotificationItem[] {
  return parsePagedEntityList(raw, parseNotificationItem).items;
}

export function unwrapEnvelope<T = unknown>(raw: unknown): T {
  if (raw == null || typeof raw !== 'object') {
    return raw as T;
  }
  const envelope = raw as ApiEnvelope<T>;
  if (envelope.data !== undefined) return envelope.data as T;
  if (envelope.Data !== undefined) return envelope.Data as T;
  return raw as T;
}

export function isEnvelopeSuccess(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object') return true;
  const e = raw as ApiEnvelope;
  if (e.success === false || e.Success === false) return false;
  return true;
}

export function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function parseJwtSubject(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return '';
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return String(payload.sub ?? payload.userId ?? payload.UserId ?? '').trim();
  } catch {
    return '';
  }
}

export function pickNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN' | string;

export interface AuthLoginPayload {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
  expiresInSeconds?: number;
}

export function parseAuthLoginPayload(raw: unknown, identityFallback: string): AuthLoginPayload {
  const data = unwrapEnvelope<Record<string, unknown>>(raw);
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const accessToken = pickString(row, ['accessToken', 'AccessToken', 'token', 'Token']);
  const refreshToken = pickString(row, ['refreshToken', 'RefreshToken']);
  const userId =
    pickString(row, ['UserId', 'userId']) || (accessToken ? parseJwtSubject(accessToken) : '') || identityFallback;
  const email = pickString(row, ['Email', 'email']) || identityFallback;
  const firstName = pickString(row, ['FirstName', 'firstName']);
  const lastName = pickString(row, ['LastName', 'lastName']);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email || 'User';
  const role = (pickString(row, ['Role', 'role']) || 'PATIENT').toUpperCase();
  const expiresInSeconds = pickNumber(row, [
    'accessTokenExpiresInSeconds',
    'AccessTokenExpiresInSeconds',
    'expiresInSeconds',
    'ExpiresInSeconds'
  ]);
  return { accessToken, refreshToken, userId, email, role, displayName, expiresInSeconds };
}

export { toTelemetryWire } from './telemetryWire';
export { toLogWire } from './logWire';
export {
  USER_SKETCH_IMAGE_DATA_URL,
  resolveDoctorProfileImage,
  parsePublicDoctorProfile,
  type PublicDoctorProfile
} from './doctorProfileImage';
export { loadDoctorsAcrossDepartments } from './departmentDoctors';
