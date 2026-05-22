import { useEffect, useState, type ReactNode } from 'react';

import { tryRestoreSessionFromRefresh } from '@/features/auth/api';
import { useSessionStore } from './sessionStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await tryRestoreSessionFromRefresh();
      } finally {
        if (!cancelled) {
          useSessionStore.getState().setHydrated(true);
          setReady(true);
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
