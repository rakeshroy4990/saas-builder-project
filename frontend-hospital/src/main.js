import { createApp } from 'vue'
import { registerDefaultBusyIndicators } from '@saas-builder/vue-async-ui'
import App from './App.vue'
import './styles.css'
import { bootstrap } from './core/bootstrap/AppBootstrap'
import { hydrateUiMetadataFromServer } from './core/bootstrap/hydrateUiMetadata'
import { router } from './router'
import { bindHttpRouter } from './services/http/apiClient'
import { logClient, startLogSyncScheduler } from './services/logging/clientLogger'
import { pinia } from './store/pinia'
import { hasPersistedAuthSessionProfile, hydrateAuthSessionProfile } from './services/auth/authSessionStore'
import { bootstrapSessionCookiesFromRefresh } from './services/auth/sessionCookieBootstrap'
import { initFirebaseAnalytics } from './services/analytics/firebaseAnalytics'
import { initSessionSummaryNavigation } from './services/analytics/sessionSummary'
import { initSentry } from './services/observability/sentry'
import * as Sentry from '@sentry/vue'

async function start() {
  startLogSyncScheduler()
  registerDefaultBusyIndicators()
  bootstrap()
  hydrateAuthSessionProfile()
  if (hasPersistedAuthSessionProfile()) {
    await bootstrapSessionCookiesFromRefresh()
  }
  bindHttpRouter(router)
  initSessionSummaryNavigation(router)
  await initFirebaseAnalytics(router).catch(async (err) => {
    await logClient('WARN', 'Firebase Analytics init skipped', { reason: String(err) })
  })
  await hydrateUiMetadataFromServer().catch(() => {})
  await logClient('INFO', 'FlexShell UI startup complete')
  const app = createApp(App).use(pinia).use(router)
  initSentry(app, router)
  app.mount('#app')
}

start().catch(async (err) => {
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
