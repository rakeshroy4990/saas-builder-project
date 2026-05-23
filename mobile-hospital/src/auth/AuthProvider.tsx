import { useEffect, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { hydrateSessionFromStorage, tryRestoreSessionFromRefresh } from '@/features/auth/api';
import { useSessionStore } from './sessionStore';

const STARTUP_REFRESH_TIMEOUT_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { hasRefreshToken } = await hydrateSessionFromStorage();
        if (cancelled) return;

        useSessionStore.getState().setHydrated(true);
        setReady(true);
        await SplashScreen.hideAsync().catch(() => undefined);

        if (!hasRefreshToken) return;

        useSessionStore.getState().setSessionRestoreInFlight(true);
        try {
          await tryRestoreSessionFromRefresh({ timeoutMs: STARTUP_REFRESH_TIMEOUT_MS });
        } catch {
          // Network or invalid refresh — user can sign in manually.
        } finally {
          if (!cancelled) {
            useSessionStore.getState().setSessionRestoreInFlight(false);
          }
        }
      } catch {
        if (!cancelled) {
          useSessionStore.getState().setHydrated(true);
          setReady(true);
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
