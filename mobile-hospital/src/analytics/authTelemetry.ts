import { resolveSpringApiUrl, SERVER_PATHS } from '@saas-builder/hospital-api-client';

import type { AuthLoginTelemetryMeta } from '@/analytics/sessionTelemetry';
import { getMobileApiBaseUrl } from '@/api/config';

export function authTelemetryPath(path: string): string {
  return resolveSpringApiUrl(getMobileApiBaseUrl(), path);
}

export function authLoginTelemetryFromResponse(
  path: string,
  startedAtMs: number,
  httpStatus: number,
  httpMethod: 'POST' = 'POST'
): AuthLoginTelemetryMeta {
  return {
    api_path: authTelemetryPath(path),
    http_method: httpMethod,
    http_status: httpStatus,
    duration_ms: Math.max(0, Math.round(Date.now() - startedAtMs))
  };
}

export const AUTH_TELEMETRY_PATHS = {
  login: SERVER_PATHS.login,
  googleLogin: SERVER_PATHS.googleLogin,
  refresh: SERVER_PATHS.refresh
} as const;
