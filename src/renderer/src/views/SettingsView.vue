<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BrandLogo from '@/components/BrandLogo.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { formatCatalogStamp } from '@/lib/format'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'

const providerStore = useProviderStore()
const catalogStore = useCatalogStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const { t } = localeStore
const { locale, options: localeOptions } = storeToRefs(localeStore)
const { savedProviders: providers, modelCount } = storeToRefs(providerStore)
const { count: catalogCount, updatedAt, updating } = storeToRefs(catalogStore)

const version = ref('—')
const platform = ref('—')
const userData = ref('—')
const runtime = ref('—')

const catalogHint = computed(() => {
  void locale.value
  return formatCatalogStamp(updatedAt.value, catalogCount.value)
})

onMounted(async () => {
  if (!window.hyper) return
  const [appVersion, appPlatform, dataPath] = await Promise.all([
    window.hyper.getVersion(),
    window.hyper.getPlatform(),
    window.hyper.getDataDir()
  ])
  version.value = appVersion
  platform.value = appPlatform
  userData.value = dataPath
  runtime.value = `Electron ${window.electron.process.versions.electron} · Chrome ${window.electron.process.versions.chrome}`
})

async function openDataDir(): Promise<void> {
  if (!window.hyper?.openDataDir) return
  await window.hyper.openDataDir()
}

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
  <section class="page settings-layout">
    <div class="settings-scroll">
      <div class="settings-column">
        <section class="settings-card">
          <div class="settings-about">
            <BrandLogo class="settings-about-logo" />
            <div class="settings-about-copy">
              <div class="settings-about-name">HyperSwitch</div>
              <div class="settings-about-desc">{{ t('nav.brandSub') }}</div>
              <span class="settings-about-ver">{{ version }}</span>
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <rect x="3" y="4.5" width="14" height="11" rx="2" />
                <path d="M7 15.5v1.2h6v-1.2" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.platform') }}</div>
            </div>
            <div class="settings-row-value">{{ platform }}</div>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M4 14.5V6.8L10 4l6 2.8v7.7L10 17.5 4 14.5Z" />
                <path d="M10 17.5V10M4 6.8l6 3.2 6-3.2" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.runtime') }}</div>
              <div class="settings-row-desc">{{ runtime }}</div>
            </div>
          </div>
        </section>

        <section class="settings-card">
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M3.5 6.5h5l1.5 1.5H16.5v7.5h-13V6.5Z" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.dataDir') }}</div>
              <div class="settings-row-desc">{{ userData }}</div>
            </div>
            <button class="btn btn-sm" type="button" @click="openDataDir">{{ t('common.open') }}</button>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
                <path d="M7 10h6M10 7v6" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.providers') }}</div>
            </div>
            <div class="settings-row-value">{{ t('settings.count', { count: providers.length }) }}</div>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M4 6h12M4 10h12M4 14h8" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.models') }}</div>
            </div>
            <div class="settings-row-value">{{ t('settings.count', { count: modelCount }) }}</div>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M4 10a6 6 0 0 1 10.4-4.1L16 4v5h-5l1.7-1.7A4.2 4.2 0 1 0 14.2 13" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.updateCatalog') }}</div>
              <div class="settings-row-desc">{{ t('settings.updateCatalogDesc', { stamp: catalogHint }) }}</div>
            </div>
            <button class="btn btn-sm btn-primary" type="button" :disabled="updating" @click="refreshCatalog">
              {{ updating ? t('settings.updating') : t('settings.update') }}
            </button>
          </div>
          <div class="settings-row">
            <span class="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="10" cy="10" r="6.5" />
                <ellipse cx="10" cy="10" rx="2.6" ry="6.5" />
                <path d="M3.5 10h13M5.4 6.2h9.2M5.4 13.8h9.2" />
              </svg>
            </span>
            <div class="settings-row-body">
              <div class="settings-row-title">{{ t('settings.language') }}</div>
              <div class="settings-row-desc">{{ t('settings.languageDesc') }}</div>
            </div>
            <div class="settings-locale">
              <SelectMenu :model-value="locale" :options="localeOptions" @update:model-value="localeStore.setLocale" />
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
