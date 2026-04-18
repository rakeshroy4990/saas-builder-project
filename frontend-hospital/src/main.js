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

async function start() {
  startLogSyncScheduler()
  registerDefaultBusyIndicators()
  bootstrap()
  hydrateAuthTokensFromSessionStorage()
  hydrateAuthSessionProfile()
  syncHospitalUserIdFromAccessToken()
  bindHttpRouter(router)
  await hydrateUiMetadataFromServer().catch(() => {})
  await logClient('INFO', 'FlexShell UI startup complete')
  createApp(App).use(pinia).use(router).mount('#app')
}

start().catch(async (err) => {
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
