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
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  register: '/api/auth/register',
  user: '/api/user',
  appointmentGet: '/api/appointment/get',
  appointmentCreate: '/api/appointment/create',
  adminAppointments: '/api/admin/appointments',
  patientPrescriptions: '/api/v1/patient-prescriptions',
  hospitalVideoSession: '/api/hospital/video/session',
  chatRooms: '/api/chat/rooms',
  patientDeviceReadings: '/api/v1/patient-device-readings'
} as const;

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
