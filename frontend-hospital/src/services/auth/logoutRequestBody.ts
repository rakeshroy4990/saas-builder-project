import { clearEphemeralRefreshToken, getEphemeralRefreshToken } from './refreshTokenEphemeral';

/**
 * Logout body for `/api/auth/logout`. Refresh cookie is scoped to `/api/auth` (sent on logout).
 * Include in-memory refresh when present (e.g. after rotation before reload).
 */
export function buildLogoutRequestBody(): { DeviceId: string; RefreshToken?: string } {
  const body: { DeviceId: string; RefreshToken?: string } = { DeviceId: 'browser' };
  const rt = getEphemeralRefreshToken();
  if (rt) {
    body.RefreshToken = rt;
  }
  return body;
}

/** Drop stale in-memory refresh so logout uses the httpOnly cookie only. */
export function clearLogoutRefreshTokenHint(): void {
  clearEphemeralRefreshToken();
}
