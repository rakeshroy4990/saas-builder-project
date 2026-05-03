import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'
import type { Router } from 'vue-router'
import type { TelemetryDomain, TelemetryReasonCode, TelemetryStatus } from '../observability/telemetrySchema'
import { ingestSessionTelemetry } from './sessionTelemetry'
import { getOrCreateTraceId } from '../logging/traceContext'

/** Strip Vite/env placeholders so `"undefined"` strings do not count as configured. */
function normalizeFirebaseEnv(value: unknown): string {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  if (!t || t === 'undefined' || t === 'null' || t === 'none') return '';
  return t;
}

const firebaseConfig = {
  apiKey: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
};

function firebaseAnalyticsExplicitlyDisabled(): boolean {
  const v = normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_ANALYTICS_ENABLED).toLowerCase();
  return v === 'false' || v === '0' || v === 'off' || v === 'no';
}

/** Firebase / Google Cloud browser keys used by the web SDK are typically `AIza…`. */
function looksLikeGoogleBrowserApiKey(apiKey: string): boolean {
  return /^AIza[\w-]{20,}$/.test(apiKey);
}

/** e.g. `1:317459219201:web:428ee07a430fbdebe51100` */
function looksLikeFirebaseWebAppId(appId: string): boolean {
  return /^\d+:\d+:web:[a-zA-Z0-9]+$/.test(appId);
}

/** GA4 web stream measurement id */
function looksLikeGtagMeasurementId(measurementId: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(measurementId);
}

function hasFirebaseAnalyticsConfig(): boolean {
  if (firebaseAnalyticsExplicitlyDisabled()) {
    return false;
  }
  const { apiKey, authDomain, projectId, appId, measurementId } = firebaseConfig;
  return Boolean(
    apiKey
      && looksLikeGoogleBrowserApiKey(apiKey)
      && authDomain
      && projectId
      && appId
      && looksLikeFirebaseWebAppId(appId)
      && measurementId
      && looksLikeGtagMeasurementId(measurementId)
  );
}

let analytics: Analytics | null = null

type AnalyticsEventParamsMap = {
  page_view: {
    page_title: string
    page_location: string
    page_path: string
  }
  login_success: {
    role: string
    domain: TelemetryDomain
    status: TelemetryStatus
    trace_id: string
  }
  login_failed: {
    reason: 'missing_credentials' | 'unauthorized' | 'request_failed'
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    http_status?: number
    trace_id: string
  }
  logout: Record<string, never>
  register_success: {
    role: string
    roleStatus: string
  }
  register_failed: {
    reason: 'terms_not_accepted' | 'missing_required_fields' | 'missing_doctor_fields' | 'request_failed'
  }
  appointment_created: {
    appointmentId: string
    department: string
    doctorId: string
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  appointment_updated: {
    appointmentId: string
    department: string
    doctorId: string
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  appointment_submit_failed: {
    reason: 'missing_required_fields' | 'age_limit' | 'request_failed'
    missingCount?: number
    isEdit: boolean
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    http_status?: number
    trace_id: string
  }
  appointment_cancelled: {
    appointmentId: string
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  appointment_cancel_failed: {
    appointmentId?: string
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    http_status?: number
    trace_id: string
  }
  chat_support_request_created: {
    requestId: string
  }
  chat_ai_reply_received: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    provider?: string
  }
  chat_ai_escalated: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  chat_ai_failed: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    provider?: string
    http_status?: number
  }
  video_call_event: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    call_id?: string
    duration_sec?: number
  }
  profile_viewed: {
    section: 'profile' | 'inactive'
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  profile_view_failed: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    http_status?: number
  }
  profile_saved: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  profile_save_failed: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    http_status?: number
  }
  profile_deactivated: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
  }
  profile_deactivate_failed: {
    domain: TelemetryDomain
    status: TelemetryStatus
    reason_code: TelemetryReasonCode
    trace_id: string
    http_status?: number
  }
}

export type AnalyticsEventName = keyof AnalyticsEventParamsMap

type AnalyticsFlowKey = 'navigation' | 'auth' | 'registration' | 'appointment' | 'chat' | 'video' | 'profile'

const analyticsFlowByEvent: Record<AnalyticsEventName, AnalyticsFlowKey> = {
  page_view: 'navigation',
  login_success: 'auth',
  login_failed: 'auth',
  logout: 'auth',
  register_success: 'registration',
  register_failed: 'registration',
  appointment_created: 'appointment',
  appointment_updated: 'appointment',
  appointment_submit_failed: 'appointment',
  appointment_cancelled: 'appointment',
  appointment_cancel_failed: 'appointment',
  chat_support_request_created: 'chat',
  chat_ai_reply_received: 'chat',
  chat_ai_escalated: 'chat',
  chat_ai_failed: 'chat',
  video_call_event: 'video',
  profile_viewed: 'profile',
  profile_view_failed: 'profile',
  profile_saved: 'profile',
  profile_save_failed: 'profile',
  profile_deactivated: 'profile',
  profile_deactivate_failed: 'profile'
}

export type TrackEventOptions = {
  /** When true, only Firebase `logEvent` runs (no session-event queue ingest). */
  skipSessionTelemetry?: boolean;
};

export function trackEvent<TEventName extends AnalyticsEventName>(
  eventName: TEventName,
  params?: AnalyticsEventParamsMap[TEventName],
  options?: TrackEventOptions
): void {
  const eventParams = params ?? {}
  const flow = analyticsFlowByEvent[eventName]
  if (
    !options?.skipSessionTelemetry
    && (flow === 'appointment'
    || flow === 'chat'
    || flow === 'video'
    || flow === 'profile'
    || eventName === 'login_success'
    || eventName === 'logout')
  ) {
    const traceId =
      String((eventParams as Record<string, unknown>)?.trace_id ?? '').trim() || getOrCreateTraceId()
    const telemetryPayload = {
      event_name: eventName as string,
      flow,
      status: String((eventParams as Record<string, unknown>)?.status ?? ''),
      reason_code: String((eventParams as Record<string, unknown>)?.reason_code ?? ''),
      http_status:
        typeof (eventParams as Record<string, unknown>)?.http_status === 'number'
          ? Number((eventParams as Record<string, unknown>).http_status)
          : undefined,
      trace_id: traceId
    }
    void ingestSessionTelemetry(telemetryPayload)
  }

  if (!analytics) {
    return
  }

  logEvent(analytics, eventName as string, {
    ...eventParams,
    flow: analyticsFlowByEvent[eventName],
    timestamp: Date.now()
  })
}

export async function initFirebaseAnalytics(router: Router): Promise<void> {
  if (firebaseAnalyticsExplicitlyDisabled()) {
    return;
  }

  const partialEnvPresent =
    normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_API_KEY).length > 0
    || normalizeFirebaseEnv(import.meta.env.VITE_FIREBASE_APP_ID).length > 0;

  if (partialEnvPresent && !hasFirebaseAnalyticsConfig()) {
    if (import.meta.env.DEV) {
      console.info(
        '[Flexshell] Firebase Analytics skipped: VITE_FIREBASE_* values look wrong or incomplete. ' +
          'Use the Web app config from Firebase Console (apiKey starting with AIza…, appId 1:…:web:…, measurementId G-…). ' +
          'Mismatched keys cause API_KEY_INVALID on googleapis.com. Set VITE_FIREBASE_ANALYTICS_ENABLED=false to disable.'
      );
    }
    return;
  }

  if (!hasFirebaseAnalyticsConfig()) {
    return;
  }

  if (!(await isSupported())) {
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
  } catch (err) {
    analytics = null;
    console.warn('[Flexshell] Firebase Analytics init failed:', err);
    return;
  }

  router.afterEach((to) => {
    trackEvent('page_view', {
      page_title: document.title || String(to.name ?? ''),
      page_location: window.location.href,
      page_path: to.fullPath
    });
  });
}
