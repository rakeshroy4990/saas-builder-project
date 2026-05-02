import { applyAccessExpiryHintFromAuthPayload } from './authToken';
import { getEphemeralRefreshToken, setEphemeralRefreshToken } from './refreshTokenEphemeral';
import { apiClient } from '../http/apiClient';
import { URLRegistry } from '../http/URLRegistry';

/**
 * After reload, httpOnly cookies may still be valid but we have no JWT in JS to read `exp`.
 * A silent refresh sets new cookies and returns TTL so proactive refresh can schedule.
 * Uses the same body as apiClient refresh (cookie + optional in-memory refresh fallback).
 */
export async function bootstrapSessionCookiesFromRefresh(): Promise<void> {
  try {
    const body: Record<string, string> = { DeviceId: 'browser' };
    const rt = getEphemeralRefreshToken();
    if (rt) {
      body.RefreshToken = rt;
    }
    const response = await apiClient.post(URLRegistry.paths.refresh, body);
    const root = response.data as Record<string, unknown> | undefined;
    const dataNode = (root?.data ?? root?.Data ?? root ?? {}) as Record<string, unknown>;
    applyAccessExpiryHintFromAuthPayload(dataNode);
    applyAccessExpiryHintFromAuthPayload(root);
    const newRt = String(dataNode.refreshToken ?? dataNode.RefreshToken ?? '').trim();
    if (newRt) {
      setEphemeralRefreshToken(newRt);
    }
  } catch {
    // No valid refresh cookie — user must log in again when accessing protected routes.
  }
}
