import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'
import type { Router } from 'vue-router'
import type { TelemetryDomain, TelemetryReasonCode, TelemetryStatus } from '../observability/telemetrySchema'
import { ingestSessionTelemetry } from './sessionTelemetry'
import { getOrCreateTraceId } from '../logging/traceContext'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

function hasFirebaseConfig(): boolean {
  return Boolean(
    firebaseConfig.apiKey
      && firebaseConfig.authDomain
      && firebaseConfig.projectId
      && firebaseConfig.appId
      && firebaseConfig.measurementId
  )
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

export function trackEvent<TEventName extends AnalyticsEventName>(
  eventName: TEventName,
  params?: AnalyticsEventParamsMap[TEventName]
): void {
  const eventParams = params ?? {}
  const flow = analyticsFlowByEvent[eventName]
  if (
    flow === 'appointment'
    || flow === 'chat'
    || flow === 'video'
    || flow === 'profile'
    || eventName === 'login_success'
    || eventName === 'logout'
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
  if (!hasFirebaseConfig()) {
    return
  }

  if (!(await isSupported())) {
    return
  }

  const app = initializeApp(firebaseConfig)
  analytics = getAnalytics(app)

  router.afterEach((to) => {
    trackEvent('page_view', {
      page_title: document.title || String(to.name ?? ''),
      page_location: window.location.href,
      page_path: to.fullPath
    })
  })
}
