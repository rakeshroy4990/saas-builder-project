import * as Sentry from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

function parseBooleanEnv(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseNumberEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

export function initSentry(app: App, router: Router): void {
  const enabledByFlag = parseBooleanEnv(import.meta.env.VITE_SENTRY_ENABLED, false)
  const dsn = String(import.meta.env.VITE_SENTRY_DSN ?? '').trim()
  const enabled = (import.meta.env.PROD && Boolean(dsn)) || enabledByFlag

  if (!enabled || !dsn) {
    return
  }

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development',
    tracesSampleRate: parseNumberEnv(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
    integrations: [Sentry.browserTracingIntegration({ router })],
    sendDefaultPii: false
  })

  // Manual runtime probe: run `window.__triggerSentryTestError()` in browser console.
  if (typeof window !== 'undefined') {
    (window as Window & { __triggerSentryTestError?: () => void }).__triggerSentryTestError = () => {
      Sentry.captureException(new Error('Manual Sentry probe from browser console'))
    }
  }
}
