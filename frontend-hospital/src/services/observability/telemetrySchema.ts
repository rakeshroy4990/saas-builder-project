export type TelemetryDomain = 'auth' | 'appointment' | 'video' | 'chat';
export type TelemetryStatus = 'success' | 'fail' | 'drop';

type DomainReasonMap = Record<string, string>;

function defineDomainReasons<TDomainReasons extends DomainReasonMap>(reasons: TDomainReasons): TDomainReasons {
  return reasons;
}

/**
 * Central reason catalog.
 * To extend telemetry for new failures/events, add a new reason key here and reuse it from services.
 */
export const telemetryReasonCodes = {
  auth: {
    missingCredentials: 'missing_credentials',
    invalidCredentials: 'invalid_credentials',
    unauthorized: 'unauthorized',
    accountInactive: 'account_inactive',
    requestFailed: 'request_failed',
    networkError: 'network_error'
  } as const,
  appointment: defineDomainReasons({
    createSuccess: 'create_success',
    updateSuccess: 'update_success',
    createFailed: 'create_failed',
    validationError: 'validation_error',
    ageLimit: 'age_limit',
    requestFailed: 'request_failed',
    notificationFailed: 'notification_failed'
  }),
  video: defineDomainReasons({
    callStarted: 'call_started',
    callConnected: 'call_connected',
    callReconnectAttempt: 'call_reconnect_attempt',
    callDropped: 'call_dropped',
    callEnded: 'call_ended',
    stompDisconnect: 'stomp_disconnect',
    publishFailed: 'publish_failed',
    heartbeatFailed: 'heartbeat_failed',
    sessionPrepFailed: 'session_prep_failed',
    peerDisconnected: 'peer_disconnected',
    mediaPermissionDenied: 'media_permission_denied'
  }),
  chat: defineDomainReasons({
    replyReceived: 'reply_received',
    escalatedToHuman: 'escalated_to_human',
    quotaDaily: 'quota_daily',
    provider429: 'provider_429',
    provider5xx: 'provider_5xx',
    timeout: 'timeout',
    requestFailed: 'request_failed'
  })
} as const;

export type TelemetryReasonCode =
  | (typeof telemetryReasonCodes.auth)[keyof typeof telemetryReasonCodes.auth]
  | (typeof telemetryReasonCodes.appointment)[keyof typeof telemetryReasonCodes.appointment]
  | (typeof telemetryReasonCodes.video)[keyof typeof telemetryReasonCodes.video]
  | (typeof telemetryReasonCodes.chat)[keyof typeof telemetryReasonCodes.chat];

export type TelemetryEventBase = {
  domain: TelemetryDomain;
  status: TelemetryStatus;
  reason_code: TelemetryReasonCode;
  trace_id: string;
  http_status?: number;
  provider?: string;
  appointment_id?: string;
  call_id?: string;
  duration_sec?: number;
  session_id?: string;
  user_role?: string;
  env?: string;
};

export function buildTelemetryEvent(
  base: TelemetryEventBase,
  extra?: Record<string, unknown>
): TelemetryEventBase & Record<string, unknown> {
  return {
    ...base,
    ...(extra ?? {})
  };
}
