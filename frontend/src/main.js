import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'
import { bootstrap } from './core/bootstrap/AppBootstrap'
import { hydrateUiMetadataFromServer } from './core/bootstrap/hydrateUiMetadata'
import { router } from './router'
import { bindHttpRouter } from './services/http/apiClient'
import { logClient, startLogSyncScheduler } from './services/logging/clientLogger'
import { pinia } from './store/pinia'
import { i18n, initI18n } from './i18n'

async function start() {
  startLogSyncScheduler()
  bootstrap()
  bindHttpRouter(router)
  await hydrateUiMetadataFromServer().catch(() => {})
  await initI18n()
  await logClient('INFO', 'FlexShell UI startup complete')
  createApp(App).use(pinia).use(router).use(i18n).mount('#app')
}

start().catch(async (err) => {
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
