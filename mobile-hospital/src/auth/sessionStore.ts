import { create } from 'zustand';

import type { UserRole } from '@saas-builder/hospital-api-client';

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface SessionState {
  accessToken: string | null;
  user: SessionUser | null;
  expiresAtMs: number | null;
  hydrated: boolean;
  setSession: (payload: {
    accessToken: string;
    user: SessionUser;
    expiresInSeconds?: number;
  }) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
}

function computeExpiryMs(seconds?: number): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const skewMs = 30_000;
  return Date.now() + Math.floor(seconds * 1000) - skewMs;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  expiresAtMs: null,
  hydrated: false,
  setSession: ({ accessToken, user, expiresInSeconds }) =>
    set({
      accessToken,
      user,
      expiresAtMs: computeExpiryMs(expiresInSeconds)
    }),
  clearSession: () =>
    set({
      accessToken: null,
      user: null,
      expiresAtMs: null
    }),
  setHydrated: (hydrated) => set({ hydrated })
}));

export function isAccessTokenExpired(nowMs: number = Date.now()): boolean {
  const expiresAtMs = useSessionStore.getState().expiresAtMs;
  if (!expiresAtMs) return false;
  return nowMs >= expiresAtMs;
}
