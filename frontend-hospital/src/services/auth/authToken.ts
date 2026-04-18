type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
};

const TOKENS_STORAGE_KEY = 'flexshell_auth_tokens';

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

/** JWT `sub` — must match Spring WebSocket `Principal.getName()` for `/user/queue/...` routing. */
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

function applyTokensInMemory(accessToken: string, refreshToken: string): void {
  tokens = { accessToken, refreshToken };
  accessTokenExpiresAtMs = parseJwtExpMs(accessToken);
  notify();
}

function persistTokensToSession(accessToken: string, refreshToken: string): void {
  try {
    sessionStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify({ accessToken, refreshToken }));
  } catch {
    // no-op
  }
}

export function setAuthToken(token: string): void {
  if (!token) return;
  const refresh = tokens?.refreshToken ?? '';
  applyTokensInMemory(token, refresh);
  if (refresh) persistTokensToSession(token, refresh);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (!accessToken || !refreshToken) return;
  applyTokensInMemory(accessToken, refreshToken);
  persistTokensToSession(accessToken, refreshToken);
}

export function clearAuthToken(): void {
  tokens = null;
  accessTokenExpiresAtMs = null;
  try {
    sessionStorage.removeItem(TOKENS_STORAGE_KEY);
  } catch {
    // no-op
  }
  notify();
}

/** Restore JWT pair after a full page reload (used from `main.js`). */
export function hydrateAuthTokensFromSessionStorage(): void {
  try {
    const raw = sessionStorage.getItem(TOKENS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    const accessToken = String(parsed.accessToken ?? '').trim();
    const refreshToken = String(parsed.refreshToken ?? '').trim();
    if (!accessToken || !refreshToken) return;
    applyTokensInMemory(accessToken, refreshToken);
  } catch {
    // no-op
  }
}

