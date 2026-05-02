/**
 * Holds the latest refresh JWT **only in memory** for the current tab session.
 * HttpOnly cookies are preferred, but cross-site `fetch` POST requests do not send
 * `SameSite=Lax` cookies — the body `RefreshToken` is required unless cookies use `SameSite=None; Secure`.
 * Updated after each successful `/api/auth/refresh` (rotation). Cleared on logout.
 */
let ephemeralRefreshToken: string | null = null;

export function setEphemeralRefreshToken(token: string | null | undefined): void {
  const t = token == null ? '' : String(token).trim();
  ephemeralRefreshToken = t.length > 0 ? t : null;
}

export function getEphemeralRefreshToken(): string | null {
  return ephemeralRefreshToken;
}

export function clearEphemeralRefreshToken(): void {
  ephemeralRefreshToken = null;
}
