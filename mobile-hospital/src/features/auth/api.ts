import { isAxiosError } from 'axios';
import {
  parseAuthLoginPayload,
  pickString,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';

import { authLoginTelemetryFromResponse, AUTH_TELEMETRY_PATHS } from '@/analytics/authTelemetry';
import {
  clearLoginSessionId,
  readLoginSessionId,
  recordLogoutTelemetry,
  recordSuccessfulLoginTelemetry
} from '@/analytics/sessionTelemetry';
import { toUserFacingApiError } from '@/api/apiErrors';
import { apiClient } from '@/api/client';
import { AUTH_API_TIMEOUT_MS } from '@/api/timeouts';
import { clearSecureAuth, persistSessionSecrets } from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from '@/auth/tokenTtl';

export async function loginWithPassword(identity: string, password: string): Promise<void> {
  const startedAtMs = Date.now();
  const response = await apiClient.post(
    SERVER_PATHS.login,
    { EmailId: identity.trim(), Password: password },
    { timeout: AUTH_API_TIMEOUT_MS }
  );

  const parsed = parseAuthLoginPayload(response.data, identity.trim());
  if (!parsed.accessToken) {
    throw new Error('Login response missing access token');
  }

  const user: SessionUser = {
    userId: parsed.userId,
    email: parsed.email,
    displayName: parsed.displayName,
    role: parsed.role
  };

  useSessionStore.getState().setSession({
    accessToken: parsed.accessToken,
    user,
    expiresInSeconds: parsed.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS
  });

  persistSessionSecrets(parsed.refreshToken, user);
  recordSuccessfulLoginTelemetry(
    'password',
    authLoginTelemetryFromResponse(AUTH_TELEMETRY_PATHS.login, startedAtMs, response.status)
  );
  const { connectRealtimeAfterAuth } = await import('@/features/video/connectOnAuth');
  void connectRealtimeAfterAuth();
}

export async function logout(): Promise<void> {
  recordLogoutTelemetry();
  try {
    await apiClient.post(SERVER_PATHS.logout);
  } catch {
    // Best-effort server logout
  } finally {
    const { disconnectRealtimeOnLogout } = await import('@/features/video/connectOnAuth');
    await disconnectRealtimeOnLogout();
    useSessionStore.getState().clearSession();
    await clearSecureAuth();
    clearLoginSessionId();
  }
}

export function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const message = pickString(payload, ['Message', 'message']);
    if (error.response?.status === 401 || error.response?.status === 403) {
      return message || 'Invalid email or password';
    }
  }
  return toUserFacingApiError(error, 'Unable to sign in right now.');
}

/** Fast local read — does not call the network. */
export async function hydrateSessionFromStorage(): Promise<{ hasRefreshToken: boolean }> {
  const { getStoredRefreshToken, getStoredSessionProfile } = await import('@/auth/secureTokens');
  const [profile, refreshToken] = await Promise.all([getStoredSessionProfile(), getStoredRefreshToken()]);
  if (profile) {
    useSessionStore.setState({ user: profile });
  }
  return { hasRefreshToken: Boolean(refreshToken?.trim()) };
}

export async function tryRestoreSessionFromRefresh(options?: { timeoutMs?: number }): Promise<boolean> {
  const { refreshAccessToken } = await import('@/api/client');
  const ok = await refreshAccessToken({ timeoutMs: options?.timeoutMs });
  if (ok && useSessionStore.getState().accessToken) {
    if (!readLoginSessionId()) {
      recordSuccessfulLoginTelemetry('token_refresh');
    }
    const { connectRealtimeAfterAuth } = await import('@/features/video/connectOnAuth');
    void connectRealtimeAfterAuth();
  }
  return ok && Boolean(useSessionStore.getState().accessToken);
}

export async function fetchUserProfile(userId: string): Promise<Record<string, unknown>> {
  const response = await apiClient.get(SERVER_PATHS.user, { params: { userId } });
  const data = unwrapEnvelope<unknown>(response.data);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}
