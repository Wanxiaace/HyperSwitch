import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAgentBindingStore } from './stores/agentBindings'
import { useCatalogStore } from './stores/catalog'
import { useLocaleStore } from './stores/locale'
import { usePresetStore } from './stores/presets'
import { useProviderStore } from './stores/providers'
import './styles/main.css'

async function boot(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  await useLocaleStore(pinia).hydrate()
  void useProviderStore(pinia).hydrate()
  void useCatalogStore(pinia).hydrate()
  void useAgentBindingStore(pinia).hydrate()
  void usePresetStore(pinia).hydrate()
  app.mount('#app')
}

void boot()
