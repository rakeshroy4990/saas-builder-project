import { isAxiosError } from 'axios';
import {
  parseAuthLoginPayload,
  pickString,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import {
  clearSecureAuth,
  setStoredRefreshToken,
  setStoredSessionProfile
} from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';

export async function loginWithPassword(identity: string, password: string): Promise<void> {
  const response = await apiClient.post(SERVER_PATHS.login, {
    EmailId: identity.trim(),
    Password: password
  });

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
    expiresInSeconds: parsed.expiresInSeconds ?? 900
  });

  if (parsed.refreshToken) {
    await setStoredRefreshToken(parsed.refreshToken);
  }
  await setStoredSessionProfile(user);
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post(SERVER_PATHS.logout);
  } catch {
    // Best-effort server logout
  } finally {
    useSessionStore.getState().clearSession();
    await clearSecureAuth();
  }
}

export function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const message = pickString(payload, ['Message', 'message']);
    if (error.response?.status === 401 || error.response?.status === 403) {
      return message || 'Invalid email or password';
    }
    if (!error.response) {
      return 'Unable to reach the server. Check your connection and API URL.';
    }
    return message || 'Unable to sign in right now.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to sign in right now.';
}

export async function tryRestoreSessionFromRefresh(): Promise<boolean> {
  const { getStoredSessionProfile } = await import('@/auth/secureTokens');
  const profile = await getStoredSessionProfile();
  if (profile) {
    useSessionStore.setState({ user: profile });
  }
  const { refreshAccessToken } = await import('@/api/client');
  const ok = await refreshAccessToken();
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
