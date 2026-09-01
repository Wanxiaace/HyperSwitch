<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import BrandLogo from '@/components/BrandLogo.vue'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'

const route = useRoute()
const providerStore = useProviderStore()
const { t } = useLocaleStore()
const { savedProviders: providers, modelCount } = storeToRefs(providerStore)
const homeActive = computed(() => route.path === '/')
const providersActive = computed(() => route.path.startsWith('/providers'))
const promptsActive = computed(() => route.path.startsWith('/prompts'))
const headersActive = computed(() => route.path.startsWith('/headers'))
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <BrandLogo class="brand-logo" />
      <div>
        <div class="brand-title">HyperSwitch</div>
        <div class="brand-sub">{{ t('nav.brandSub') }}</div>
      </div>
    </div>

    <nav class="nav">
      <router-link class="nav-item" to="/" :class="{ active: homeActive }">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M2.5 7.2 8 2.8l5.5 4.4V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V7.2Z" />
        </svg>
        {{ t('nav.home') }}
      </router-link>
      <router-link class="nav-item" to="/providers" :class="{ active: providersActive }">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
          <path d="M5 8h6M8 5v6" />
        </svg>
        {{ t('nav.providers') }}
      </router-link>
      <router-link class="nav-item" to="/models" active-class="active">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M3 4.5h10M3 8h10M3 11.5h7" />
        </svg>
        {{ t('nav.models') }}
      </router-link>
      <router-link class="nav-item" to="/prompts" :class="{ active: promptsActive }">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4.5 2.5h4.2L12 5.8v7.7H4.5V2.5Z" />
          <path d="M8.7 2.5V5.8H12" />
          <path d="M6.2 8.4h4M6.2 11h2.6" />
        </svg>
        {{ t('nav.prompts') }}
      </router-link>
      <router-link class="nav-item" to="/headers" :class="{ active: headersActive }">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.5" y="3" width="11" height="4.2" rx="1" />
          <rect x="2.5" y="8.8" width="11" height="4.2" rx="1" />
          <path d="M5 5.1h6M5 10.9h4" />
        </svg>
        {{ t('nav.headers') }}
      </router-link>
      <router-link class="nav-item" to="/tools" active-class="active">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M5.2 10.8 3.4 12.6a2 2 0 0 0 2.8 2.8l1.6-1.6" />
          <path d="M9.2 4.2 12.4 7.4M7.4 2.4l6.2 6.2-3.4 3.4L4 5.8 7.4 2.4Z" />
        </svg>
        {{ t('nav.tools') }}
      </router-link>
      <router-link class="nav-item" to="/settings" active-class="active">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 2.4v1.4M8 12.2v1.4M2.4 8h1.4M12.2 8h1.4M4 4l1 1M11 11l1 1M12 4l-1 1M5 11l-1 1" />
        </svg>
        {{ t('nav.settings') }}
      </router-link>
    </nav>

    <div class="sidebar-spacer" />

    <div class="sidebar-active">
      <div class="sidebar-active-label">{{ t('nav.scale') }}</div>
      <div class="sidebar-active-name">{{ t('nav.providerCount', { count: providers.length }) }}</div>
      <div class="sidebar-active-meta">{{ t('nav.modelCount', { count: modelCount }) }}</div>
    </div>
  </aside>
</template>
