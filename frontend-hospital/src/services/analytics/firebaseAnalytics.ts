import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'
import type { Router } from 'vue-router'

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
  }
  login_failed: {
    reason: 'missing_credentials' | 'unauthorized' | 'request_failed'
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
  }
  appointment_updated: {
    appointmentId: string
    department: string
    doctorId: string
  }
  appointment_submit_failed: {
    reason: 'missing_required_fields' | 'age_limit' | 'request_failed'
    missingCount?: number
    isEdit: boolean
  }
  chat_support_request_created: {
    requestId: string
  }
  chat_ai_reply_received: Record<string, never>
  chat_ai_escalated: Record<string, never>
  chat_ai_failed: Record<string, never>
}

export type AnalyticsEventName = keyof AnalyticsEventParamsMap

type AnalyticsFlowKey = 'navigation' | 'auth' | 'registration' | 'appointment' | 'chat'

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
  chat_support_request_created: 'chat',
  chat_ai_reply_received: 'chat',
  chat_ai_escalated: 'chat',
  chat_ai_failed: 'chat'
}

export function trackEvent<TEventName extends AnalyticsEventName>(
  eventName: TEventName,
  params?: AnalyticsEventParamsMap[TEventName]
): void {
  if (!analytics) {
    return
  }

  const eventParams = params ?? {}
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
