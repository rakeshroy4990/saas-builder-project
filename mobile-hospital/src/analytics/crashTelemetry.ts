import { ErrorUtils, Platform } from 'react-native';

import {
  readLastKnownRoutePath,
  recordAppCrashTelemetry
} from '@/analytics/sessionTelemetry';

let registered = false;

/** Captures fatal/unhandled JS errors into session_telemetry ({@code flow=crash}). */
export function registerGlobalCrashTelemetry(): void {
  if (registered) return;
  registered = true;

  const prior = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    recordAppCrashTelemetry({
      reason_code: isFatal ? 'fatal_js_error' : 'unhandled_js_error',
      error_message: error?.message ?? String(error),
      error_name: error?.name,
      route_path: readLastKnownRoutePath(),
      attributes: {
        is_fatal: isFatal,
        platform: Platform.OS
      }
    });
    prior?.(error, isFatal);
  });
}

// Register before the root tree mounts so early JS errors are captured.
registerGlobalCrashTelemetry();
