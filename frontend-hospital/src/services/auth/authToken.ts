type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
};

let tokens: AuthSessionTokens | null = null;
let accessTokenExpiresAtMs: number | null = null;

type AuthTokenListener = (state: { accessToken: string | null; expiresAtMs: number | null }) => void;
const listeners = new Set<AuthTokenListener>();

function notify(): void {
  const state = { accessToken: tokens?.accessToken ?? null, expiresAtMs: accessTokenExpiresAtMs };
  for (const fn of listeners) fn(state);
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const str = normalized + pad;
  // atob is available in browsers; keep logic local to frontend.
  return atob(str);
}

function parseJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    const expSeconds = typeof payload.exp === 'number' ? payload.exp : Number(payload.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
    return Math.floor(expSeconds * 1000);
  } catch {
    return null;
  }
}

export function subscribeAuthToken(listener: AuthTokenListener): () => void {
  listeners.add(listener);
  listener({ accessToken: tokens?.accessToken ?? null, expiresAtMs: accessTokenExpiresAtMs });
  return () => listeners.delete(listener);
}

export function getAuthToken(): string | null {
  return tokens?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return tokens?.refreshToken ?? null;
}

export function getAuthTokenExpiresAtMs(): number | null {
  return accessTokenExpiresAtMs;
}

export function isAuthTokenExpired(nowMs: number = Date.now()): boolean {
  if (!tokens?.accessToken) return true;
  if (!accessTokenExpiresAtMs) return false; // if token isn't a JWT or has no exp, don't force-expire client-side
  return nowMs >= accessTokenExpiresAtMs;
}

export function setAuthToken(token: string): void {
  if (!token) return;
  tokens = { accessToken: token, refreshToken: tokens?.refreshToken ?? '' };
  accessTokenExpiresAtMs = parseJwtExpMs(token);
  notify();
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (!accessToken || !refreshToken) return;
  tokens = { accessToken, refreshToken };
  accessTokenExpiresAtMs = parseJwtExpMs(accessToken);
  notify();
}

export function clearAuthToken(): void {
  tokens = null;
  accessTokenExpiresAtMs = null;
  notify();
}

