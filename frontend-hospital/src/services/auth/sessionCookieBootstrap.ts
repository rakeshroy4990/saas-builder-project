import { applyAccessExpiryHintFromAuthPayload } from './authToken';
import { apiClient } from '../http/apiClient';
import { URLRegistry } from '../http/URLRegistry';

/**
 * After reload, httpOnly cookies may still be valid but we have no JWT in JS to read `exp`.
 * A silent refresh sets new cookies and returns TTL so proactive refresh can schedule.
 */
export async function bootstrapSessionCookiesFromRefresh(): Promise<void> {
  try {
    const response = await apiClient.post(URLRegistry.paths.refresh, { DeviceId: 'browser' });
    const root = response.data as Record<string, unknown> | undefined;
    const dataNode = (root?.data ?? root?.Data ?? root ?? {}) as Record<string, unknown>;
    applyAccessExpiryHintFromAuthPayload(dataNode);
    applyAccessExpiryHintFromAuthPayload(root);
  } catch {
    // No valid refresh cookie — user must log in again when accessing protected routes.
  }
}
