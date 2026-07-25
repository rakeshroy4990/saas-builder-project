import { Platform } from 'react-native';

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalErrorHandler | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

let registered = false;

/**
 * ErrorUtils is a Hermes/RN global — not a reliable named export from `react-native`.
 * Importing `{ ErrorUtils }` yields undefined and crashes at cold start on
 * `ErrorUtils.getGlobalHandler()`.
 */
function getErrorUtils(): ErrorUtilsLike | null {
  const g = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike };
  const utils = g.ErrorUtils;
  if (
    utils &&
    typeof utils.getGlobalHandler === 'function' &&
    typeof utils.setGlobalHandler === 'function'
  ) {
    return utils;
  }
  return null;
}

/** Captures fatal/unhandled JS errors into session_telemetry ({@code flow=crash}). */
export function registerGlobalCrashTelemetry(): void {
  if (registered) return;
  registered = true;

  const errorUtils = getErrorUtils();
  if (!errorUtils) return;

  const prior = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
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
// Never let telemetry setup abort the JS bundle.
try {
  registerGlobalCrashTelemetry();
} catch {
  // ignore
}
