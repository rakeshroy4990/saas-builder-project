import { ErrorUtils, Platform } from 'react-native';

let registered = false;

/** Captures fatal/unhandled JS errors into session_telemetry ({@code flow=crash}). */
export function registerGlobalCrashTelemetry(): void {
  if (registered) return;
  registered = true;

  const prior = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    void (async () => {
      try {
        const { readLastKnownRoutePath, recordAppCrashTelemetry } = await import(
          '@/analytics/sessionTelemetry'
        );
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
      } catch {
        // Telemetry must never prevent the default crash handler from running.
      }
    })();
    prior?.(error, isFatal);
  });
}

// Register before the root tree mounts so early JS errors are captured.
registerGlobalCrashTelemetry();
