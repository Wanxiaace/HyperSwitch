import { createRouter, createWebHashHistory } from 'vue-router'
import AgentToolsView from '@/views/AgentToolsView.vue'
import HeaderPresetsView from '@/views/HeaderPresetsView.vue'
import HomeView from '@/views/HomeView.vue'
import ModelsView from '@/views/ModelsView.vue'
import PromptPresetsView from '@/views/PromptPresetsView.vue'
import ProvidersView from '@/views/ProvidersView.vue'
import SettingsView from '@/views/SettingsView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/providers', name: 'providers', component: ProvidersView },
    { path: '/providers/:id', name: 'provider-detail', component: ProvidersView },
    { path: '/models', name: 'models', component: ModelsView },
    { path: '/prompts', name: 'prompts', component: PromptPresetsView },
    { path: '/prompts/:id', name: 'prompt-detail', component: PromptPresetsView },
    { path: '/headers', name: 'headers', component: HeaderPresetsView },
    { path: '/headers/:id', name: 'header-detail', component: HeaderPresetsView },
    { path: '/tools', name: 'tools', component: AgentToolsView },
    { path: '/settings', name: 'settings', component: SettingsView }
  ]
})

export default router
