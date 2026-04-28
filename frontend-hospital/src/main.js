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
import { hydrateAuthSessionProfile, syncHospitalUserIdFromAccessToken } from './services/auth/authSessionStore'
import { hydrateAuthTokensFromSessionStorage } from './services/auth/authToken'
import { initFirebaseAnalytics } from './services/analytics/firebaseAnalytics'
import { initSentry } from './services/observability/sentry'

async function start() {
  startLogSyncScheduler()
  registerDefaultBusyIndicators()
  bootstrap()
  hydrateAuthTokensFromSessionStorage()
  hydrateAuthSessionProfile()
  syncHospitalUserIdFromAccessToken()
  bindHttpRouter(router)
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
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
