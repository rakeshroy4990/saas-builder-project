import { useEffect, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { BrandIntroSplash, BRAND_INTRO_DURATION_MS } from '@/components/BrandIntroSplash';
import { hydrateSessionFromStorage, tryRestoreSessionFromRefresh } from '@/features/auth/api';
import { useSessionStore } from './sessionStore';

const STARTUP_REFRESH_TIMEOUT_MS = BRAND_INTRO_DURATION_MS;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { hasRefreshToken } = await hydrateSessionFromStorage();
        if (cancelled) return;

        const restoreWork = (async () => {
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
        })();

        await Promise.all([restoreWork, delay(BRAND_INTRO_DURATION_MS)]);

        if (cancelled) return;
        useSessionStore.getState().setHydrated(true);
        setReady(true);
        await SplashScreen.hideAsync().catch(() => undefined);
      } catch {
        if (!cancelled) {
          useSessionStore.getState().setSessionRestoreInFlight(false);
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
    return <BrandIntroSplash />;
  }

  return <>{children}</>;
}
