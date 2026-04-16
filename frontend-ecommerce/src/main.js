import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'
import { bootstrap } from './core/bootstrap/AppBootstrap'
import { hydrateUiMetadataFromServer } from './core/bootstrap/hydrateUiMetadata'
import { router } from './router'
import { bindHttpRouter } from './services/http/apiClient'
import { logClient, startLogSyncScheduler } from './services/logging/clientLogger'

async function start() {
  startLogSyncScheduler()
  bootstrap()
  bindHttpRouter(router)
  await hydrateUiMetadataFromServer().catch(() => {})
  await logClient('INFO', 'FlexShell UI startup complete')
  createApp(App).use(createPinia()).use(router).mount('#app')
}

start().catch(async (err) => {
  await logClient('ERROR', 'FlexShell UI startup failed', { reason: String(err) })
})
