<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { formatCatalogStamp } from '@/lib/format'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import { usePresetStore } from '@/stores/presets'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'

const providerStore = useProviderStore()
const presetStore = usePresetStore()
const catalogStore = useCatalogStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const { t } = localeStore
const { locale } = storeToRefs(localeStore)
const { savedProviders: providers, modelCount } = storeToRefs(providerStore)
const { savedPromptPresets, savedHeaderPresets } = storeToRefs(presetStore)
const { count: catalogCount, updatedAt, updating } = storeToRefs(catalogStore)

const catalogHint = computed(() => {
  void locale.value
  return formatCatalogStamp(updatedAt.value, catalogCount.value)
})

async function refreshCatalog(): Promise<void> {
  const result = await catalogStore.update()
  if (result.ok) {
    toastStore.success(t('catalog.updated', { count: result.count }))
    return
  }
  toastStore.error(t('catalog.updateFailed', { error: result.error }))
}
</script>

<template>
  <section class="page home-layout">
    <div class="home-scroll">
      <div class="home-column">
        <header class="home-hero">
          <h1 class="page-title">{{ t('home.title') }}</h1>
          <p class="page-desc">{{ t('home.desc') }}</p>
        </header>

        <div class="home-stats">
          <div class="home-stat">
            <div class="home-stat-value">{{ providers.length }}</div>
            <div class="home-stat-label">{{ t('home.providers') }}</div>
          </div>
          <div class="home-stat">
            <div class="home-stat-value">{{ modelCount }}</div>
            <div class="home-stat-label">{{ t('home.models') }}</div>
          </div>
          <div class="home-stat">
            <div class="home-stat-value">{{ savedPromptPresets.length }}</div>
            <div class="home-stat-label">{{ t('home.prompts') }}</div>
          </div>
          <div class="home-stat">
            <div class="home-stat-value">{{ savedHeaderPresets.length }}</div>
            <div class="home-stat-label">{{ t('home.headers') }}</div>
          </div>
        </div>

        <section class="settings-card">
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M4 10a6 6 0 0 1 10.4-4.1L16 4v5h-5l1.7-1.7A4.2 4.2 0 1 0 14.2 13" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">models.dev</div>
              <div class="settings-row-desc">{{ catalogHint }}</div>
            </div>
            <button class="btn btn-sm btn-primary" type="button" :disabled="updating" @click="refreshCatalog">
              {{ updating ? t('settings.updating') : t('settings.update') }}
            </button>
          </div>
        </section>

        <section v-if="providers.length" class="home-block">
          <h2 class="home-block-title">{{ t('home.configured') }}</h2>
          <div class="home-providers">
            <router-link
              v-for="provider in providers"
              :key="provider.id"
              class="home-provider"
              :to="{ name: 'provider-detail', params: { id: provider.id } }"
            >
              <ProviderIcon :icon="provider.icon" :name="provider.name" :size="18" />
              <span>{{ provider.name }}</span>
            </router-link>
          </div>
        </section>

        <section class="home-block">
          <h2 class="home-block-title">{{ t('home.howTo') }}</h2>
          <div class="home-guide">
            <router-link class="home-guide-item" to="/providers">
              <span class="home-guide-num">1</span>
              <span>
                <span class="home-guide-title">{{ t('home.guideProviders') }}</span>
                <span class="home-guide-desc">{{ t('home.guideProvidersDesc') }}</span>
              </span>
            </router-link>
            <router-link class="home-guide-item" to="/prompts">
              <span class="home-guide-num">2</span>
              <span>
                <span class="home-guide-title">{{ t('home.guidePrompts') }}</span>
                <span class="home-guide-desc">{{ t('home.guidePromptsDesc') }}</span>
              </span>
            </router-link>
            <router-link class="home-guide-item" to="/headers">
              <span class="home-guide-num">3</span>
              <span>
                <span class="home-guide-title">{{ t('home.guideHeaders') }}</span>
                <span class="home-guide-desc">{{ t('home.guideHeadersDesc') }}</span>
              </span>
            </router-link>
            <router-link class="home-guide-item" to="/tools">
              <span class="home-guide-num">4</span>
              <span>
                <span class="home-guide-title">{{ t('home.guideTools') }}</span>
                <span class="home-guide-desc">{{ t('home.guideToolsDesc') }}</span>
              </span>
            </router-link>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
