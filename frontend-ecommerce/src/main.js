import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerDefaultBusyIndicators } from '@saas-builder/vue-async-ui'
import App from './App.vue'
import './styles.css'
import { bootstrap } from './core/bootstrap/AppBootstrap'
import { bootstrapExtensibility } from './core/extensibility/bootstrapExtensibility'
import { hydrateUiMetadataFromServer } from './core/bootstrap/hydrateUiMetadata'
import { router } from './router'
import { bindHttpRouter } from './services/http/apiClient'
import { logClient, startLogSyncScheduler } from './services/logging/clientLogger'
import { i18n, initI18n } from './i18n'

async function start() {
  const pinia = createPinia()
  startLogSyncScheduler()
  registerDefaultBusyIndicators()
  await bootstrapExtensibility(pinia)
  bootstrap()
  bindHttpRouter(router)
  await hydrateUiMetadataFromServer(pinia).catch(() => {})
  await initI18n()
  await logClient('INFO', 'FlexShell UI startup complete')
  createApp(App).use(pinia).use(router).use(i18n).mount('#app')
}

start().catch(async (err) => {
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
