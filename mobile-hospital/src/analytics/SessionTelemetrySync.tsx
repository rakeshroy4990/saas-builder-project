import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  flushSessionTelemetryQueue,
  scheduleFlushSessionTelemetry,
  startSessionTelemetrySyncScheduler,
  stopSessionTelemetrySyncScheduler
} from '@/analytics/sessionTelemetry';
import { useSessionStore } from '@/auth/sessionStore';

/**
 * Starts the 15-minute session_telemetry sync while authenticated.
 * Also flushes any queued rows when the user becomes logged in (e.g. token restore).
 */
export function SessionTelemetrySync() {
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    void flushSessionTelemetryQueue();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        void flushSessionTelemetryQueue();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      stopSessionTelemetrySyncScheduler();
      return;
    }

    scheduleFlushSessionTelemetry();
    startSessionTelemetrySyncScheduler();
    return () => {
      stopSessionTelemetrySyncScheduler();
    };
  }, [accessToken]);

  return null;
}
