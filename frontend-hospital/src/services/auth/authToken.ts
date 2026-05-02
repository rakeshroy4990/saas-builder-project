/**
 * Auth tokens are issued as **httpOnly, Secure cookies** by the backend (`Set-Cookie` on login/refresh).
 * We intentionally do **not** persist access or refresh tokens in localStorage/sessionStorage or Pinia
 * (XSS cannot exfiltrate httpOnly cookies). API calls use `credentials: 'include'`; the browser sends cookies.
 *
 * We keep only a **non-secret** approximate access-token expiry time for proactive refresh scheduling,
 * derived from login/refresh JSON (`expiresInSeconds`) — never from reading the JWT.
 */

let accessExpiryApproxMs: number | null = null;

type AuthTokenListener = (state: { accessToken: string | null; expiresAtMs: number | null }) => void;
const listeners = new Set<AuthTokenListener>();

function notify(): void {
  const state = { accessToken: null as string | null, expiresAtMs: accessExpiryApproxMs };
  for (const fn of listeners) fn(state);
}

/** @deprecated Tokens live in httpOnly cookies; this always returns null. */
export function getAuthToken(): string | null {
  return null;
}

/** @deprecated Refresh token is httpOnly; this always returns null. */
export function getRefreshToken(): string | null {
  return null;
}

export function getAuthTokenExpiresAtMs(): number | null {
  return accessExpiryApproxMs;
}

/**
 * Without JWT in JS we approximate expiry from server-reported TTL. If unknown, returns false
 * so we do not block requests (server still validates cookies).
 */
export function isAuthTokenExpired(nowMs: number = Date.now()): boolean {
  if (!accessExpiryApproxMs) return false;
  return nowMs >= accessExpiryApproxMs;
}

function setAccessExpiryApproxFromSeconds(seconds: number | undefined): void {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return;
  }
  const skewMs = 30_000;
  accessExpiryApproxMs = Date.now() + Math.floor(seconds * 1000) - skewMs;
  notify();
}

/** Call after login/refresh API success when the JSON includes access lifetime (seconds). */
export function applyAccessExpiryHintFromAuthPayload(payload: Record<string, unknown> | null | undefined): void {
  if (!payload) return;
  const direct = pickNumber(payload, [
    'accessTokenExpiresInSeconds',
    'AccessTokenExpiresInSeconds',
    'expiresInSeconds',
    'ExpiresInSeconds',
    'expires_in',
    'expiresIn'
  ]);
  if (direct != null) {
    setAccessExpiryApproxFromSeconds(direct);
    return;
  }
  const data = (payload.data ?? payload.Data) as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    const nested =
      pickNumber(data, ['accessTokenExpiresInSeconds', 'AccessTokenExpiresInSeconds', 'expiresInSeconds']) ??
      pickNumber(data, ['expiresInSeconds', 'ExpiresInSeconds']);
    if (nested != null) setAccessExpiryApproxFromSeconds(nested);
  }
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
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

/** @deprecated No-op: cookies are set by the server; do not store tokens in JS. */
export function setAuthToken(_token: string): void {
  notify();
}

/** @deprecated No-op: cookies are set by the server; do not store tokens in JS. */
export function setAuthTokens(_accessToken: string, _refreshToken: string): void {
  notify();
}

export function clearAuthToken(): void {
  accessExpiryApproxMs = null;
  notify();
}

/** @deprecated No sessionStorage tokens; cookies are restored by the browser on reload. */
export function hydrateAuthTokensFromSessionStorage(): void {
  // no-op
}

export function subscribeAuthToken(listener: AuthTokenListener): () => void {
  listeners.add(listener);
  listener({ accessToken: null, expiresAtMs: accessExpiryApproxMs });
  return () => listeners.delete(listener);
}

/**
 * JWT `sub` — only available if a legacy caller passes a token string; cookie auth uses profile/user APIs instead.
 */
export function parseJwtSubject(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as { sub?: unknown };
    const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    return sub || null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const str = normalized + pad;
  return atob(str);
}
