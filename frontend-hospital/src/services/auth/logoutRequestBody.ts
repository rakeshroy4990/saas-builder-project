import { getEphemeralRefreshToken } from './refreshTokenEphemeral';

/**
 * Logout body for `/api/auth/logout`. Refresh cookie may be scoped to `/api/auth/refresh` only,
 * so the browser will not send it on logout — include in-memory refresh when present.
 */
export function buildLogoutRequestBody(): { DeviceId: string; RefreshToken?: string } {
  const body: { DeviceId: string; RefreshToken?: string } = { DeviceId: 'browser' };
  const rt = getEphemeralRefreshToken();
  if (rt) {
    body.RefreshToken = rt;
  }
  return body;
}
