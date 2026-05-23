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
  /** Wall-clock ms when the current access token was issued (login or refresh). */
  loggedInAtMs: number | null;
  hydrated: boolean;
  /** True while a stored refresh token is being exchanged after cold start. */
  sessionRestoreInFlight: boolean;
  guestMode: boolean;
  setSession: (payload: {
    accessToken: string;
    user: SessionUser;
    expiresInSeconds?: number;
  }) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
  setSessionRestoreInFlight: (value: boolean) => void;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  isAuthenticated: () => boolean;
}

function computeExpiryMs(seconds?: number): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const skewMs = 30_000;
  return Date.now() + Math.floor(seconds * 1000) - skewMs;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  user: null,
  expiresAtMs: null,
  loggedInAtMs: null,
  hydrated: false,
  sessionRestoreInFlight: false,
  guestMode: false,
  setSession: ({ accessToken, user, expiresInSeconds }) =>
    set({
      accessToken,
      user,
      guestMode: false,
      expiresAtMs: computeExpiryMs(expiresInSeconds),
      loggedInAtMs: Date.now()
    }),
  clearSession: () =>
    set({
      accessToken: null,
      user: null,
      expiresAtMs: null,
      loggedInAtMs: null,
      guestMode: false
    }),
  setHydrated: (hydrated) => set({ hydrated }),
  setSessionRestoreInFlight: (sessionRestoreInFlight) => set({ sessionRestoreInFlight }),
  enterGuestMode: () =>
    set({
      guestMode: true,
      accessToken: null,
      user: null,
      expiresAtMs: null
    }),
  exitGuestMode: () => set({ guestMode: false }),
  isAuthenticated: () => Boolean(get().accessToken)
}));

export function isAccessTokenExpired(nowMs: number = Date.now()): boolean {
  const expiresAtMs = useSessionStore.getState().expiresAtMs;
  if (!expiresAtMs) return false;
  return nowMs >= expiresAtMs;
}
