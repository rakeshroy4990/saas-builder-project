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
import { ensureLoginSessionIdForPersistedAuth } from './services/logging/loginSessionContext'
import { bootstrapSessionCookiesFromRefresh } from './services/auth/sessionCookieBootstrap'
import { ensureHospitalAdminSupportInboxReady } from './services/domain/hospital/chat/chatServices'
import { useAppStore } from './store/useAppStore'
import { initFirebaseAnalytics } from './services/analytics/firebaseAnalytics'
import { initSessionSummaryNavigation } from './services/analytics/sessionSummary'
import { initSentry } from './services/observability/sentry'
import * as Sentry from '@sentry/vue'
import { applyPreferredLocaleFromAuthSession, i18n, initI18n } from './i18n'

async function start() {
  startLogSyncScheduler()
  registerDefaultBusyIndicators()
  bootstrap()
  hydrateAuthSessionProfile()
  if (hasPersistedAuthSessionProfile()) {
    ensureLoginSessionIdForPersistedAuth()
    await bootstrapSessionCookiesFromRefresh()
    const appStore = useAppStore(pinia)
    const session = appStore.getData('hospital', 'AuthSession') ?? {}
    if (
      String(session.userId ?? '').trim() &&
      String(session.role ?? '').trim().toUpperCase() === 'ADMIN'
    ) {
      void ensureHospitalAdminSupportInboxReady().catch(() => {})
    }
  }
  bindHttpRouter(router)
  initSessionSummaryNavigation(router)
  await initFirebaseAnalytics(router).catch(async (err) => {
    await logClient('WARN', 'Firebase Analytics init skipped', { reason: String(err) })
  })
  await hydrateUiMetadataFromServer().catch(() => {})
  await initI18n()
  await applyPreferredLocaleFromAuthSession()
  await logClient('INFO', 'FlexShell UI startup complete')
  const app = createApp(App).use(pinia).use(router).use(i18n)
  initSentry(app, router)
  app.mount('#app')
}

start().catch(async (err) => {
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
