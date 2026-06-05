import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { refreshAccessToken } from '@/api/client';
import { isAccessTokenExpired, useSessionStore } from '@/auth/sessionStore';

/** Refresh when access JWT expires within this window (keeps video calls alive). */
const REFRESH_LEAD_MS = 5 * 60 * 1000;
const FOREGROUND_CHECK_MS = 60_000;

function shouldProactivelyRefresh(nowMs: number = Date.now()): boolean {
  const { accessToken, expiresAtMs } = useSessionStore.getState();
  if (!accessToken || !expiresAtMs) return false;
  return expiresAtMs - nowMs <= REFRESH_LEAD_MS || isAccessTokenExpired(nowMs);
}

async function maybeRefreshSession(): Promise<void> {
  if (!shouldProactivelyRefresh()) return;
  await refreshAccessToken();
}

/**
 * Proactively refreshes JWTs while the app is foregrounded so users are not logged out
 * mid-session (e.g. during telemedicine video calls).
 */
export function SessionTokenKeeper() {
  const authenticated = useSessionStore((s) => Boolean(s.accessToken));
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!authenticated) return;

    void maybeRefreshSession();

    const onAppStateChange = (next: AppStateStatus) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      appState.current = next;
      if (wasBackground && next === 'active') {
        void maybeRefreshSession();
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void maybeRefreshSession();
      }
    }, FOREGROUND_CHECK_MS);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [authenticated]);

  return null;
}
