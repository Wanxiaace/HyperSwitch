<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ProviderIcon from '@/components/ProviderIcon.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import HoverTip from '@/components/HoverTip.vue'
import { guessModelIcon } from '@/icons/guess'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { MODALITIES, type Modality, type ModelConfig } from '@shared/provider'

const providerStore = useProviderStore()
const { t } = useLocaleStore()
const { savedProviders: providers, allModels } = storeToRefs(providerStore)

const query = ref('')
const providerFilter = ref('all')
const thinkingFilter = ref('all')
const inputFilter = ref('all')
const outputFilter = ref('all')

const providerOptions = computed(() => [
  { value: 'all', label: t('models.allProviders') },
  ...providers.value.map((provider) => ({ value: provider.id, label: provider.name }))
])

const thinkingOptions = computed(() => [
  { value: 'all', label: t('models.thinkingAll') },
  { value: 'yes', label: t('models.thinkingYes') },
  { value: 'no', label: t('models.thinkingNo') }
])

const inputOptions = computed(() => [
  { value: 'all', label: t('models.inputAll') },
  ...MODALITIES.map((type) => ({ value: type, label: t('models.inputKind', { kind: t(`modality.${type}`) }) }))
])

const outputOptions = computed(() => [
  { value: 'all', label: t('models.outputAll') },
  ...MODALITIES.map((type) => ({ value: type, label: t('models.outputKind', { kind: t(`modality.${type}`) }) }))
])

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return allModels.value.filter(({ providerId, providerName, model }) => {
    if (providerFilter.value !== 'all' && providerId !== providerFilter.value) return false
    if (thinkingFilter.value === 'yes' && model.thinkingLevels.length === 0) return false
    if (thinkingFilter.value === 'no' && model.thinkingLevels.length > 0) return false
    if (inputFilter.value !== 'all' && !model.input.includes(inputFilter.value as Modality)) {
      return false
    }
    if (outputFilter.value !== 'all' && !model.output.includes(outputFilter.value as Modality)) {
      return false
    }
    if (!keyword) return true
    return [model.id, model.name, providerName].join(' ').toLowerCase().includes(keyword)
  })
})

function iconFor(id: string, name: string, fallback: string): string {
  return guessModelIcon(id, name, fallback)
}

function extraModalities(list: Modality[]): Modality[] {
  return list.filter((item) => item !== 'text')
}

function hasVision(model: ModelConfig): boolean {
  return extraModalities(model.input).length > 0
}

function hasThinking(model: ModelConfig): boolean {
  return model.thinkingLevels.length > 0
}

function hasRichOutput(model: ModelConfig): boolean {
  return extraModalities(model.output).length > 0
}

function modalityTip(kind: 'input' | 'output', list: Modality[]): string {
  return t('caps.modalityList', {
    kind: t(`caps.${kind}`),
    list: list.map((item) => t(`modality.${item}`)).join(' / ')
  })
}

function thinkingTip(model: ModelConfig): string {
  return t('caps.thinkingList', {
    list: model.thinkingLevels.map((level) => t(`thinking.${level}`)).join(' / ')
  })
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <h1 class="page-title">{{ t('models.title') }}</h1>
    </header>

    <div class="filter-bar">
      <input v-model="query" class="search filter-search" type="search" :placeholder="t('models.search')" />
      <SelectMenu v-model="providerFilter" :options="providerOptions" />
      <SelectMenu v-model="thinkingFilter" :options="thinkingOptions" />
      <SelectMenu v-model="inputFilter" :options="inputOptions" />
      <SelectMenu v-model="outputFilter" :options="outputOptions" />
    </div>

    <div class="model-grid">
      <div v-if="filtered.length === 0" class="empty-list">{{ t('models.empty') }}</div>
      <router-link
        v-for="row in filtered"
        :key="`${row.providerId}-${row.model.key}`"
        class="model-card"
        :to="`/providers/${row.providerId}`"
      >
        <div class="model-card-head">
          <span class="model-card-icon">
            <ProviderIcon
              :icon="iconFor(row.model.id, row.model.name, row.providerIcon)"
              :name="row.model.name || row.model.id || t('common.model')"
              :size="56"
            />
          </span>
          <div class="model-card-copy">
            <div class="model-card-name">{{ row.model.name || row.model.id || t('common.unnamed') }}</div>
            <div class="model-card-id">{{ row.model.id || t('models.missingId') }}</div>
            <div class="model-card-provider">{{ row.providerName }}</div>
          </div>
          <div class="model-card-caps">
            <HoverTip v-if="hasVision(row.model)" :text="modalityTip('input', row.model.input)">
              <span class="cap-badge cap-eye" :aria-label="t('caps.vision')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
            </HoverTip>
            <HoverTip v-if="hasThinking(row.model)" :text="thinkingTip(row.model)">
              <span class="cap-badge cap-think" :aria-label="t('caps.thinkingAria')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18h6M10 21h4" />
                  <path d="M12 3a6 6 0 0 1 3.8 10.6c-.7.6-1.3 1.6-1.3 2.4H9.5c0-.8-.6-1.8-1.3-2.4A6 6 0 0 1 12 3Z" />
                </svg>
              </span>
            </HoverTip>
            <HoverTip v-if="hasRichOutput(row.model)" :text="modalityTip('output', row.model.output)">
              <span class="cap-badge cap-output" :aria-label="t('caps.richOutput')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 3.2a8.8 8.8 0 1 0 2.2 17.3 2.4 2.4 0 0 0 2.2-3.4 1.9 1.9 0 0 1 1.9-2.6h.2a3 3 0 0 0 0-6A8.8 8.8 0 0 0 12 3.2Z" />
                  <circle cx="7.8" cy="10.2" r="1.1" fill="currentColor" />
                  <circle cx="10.8" cy="7.6" r="1.1" fill="currentColor" />
                  <circle cx="14.6" cy="8" r="1.1" fill="currentColor" />
                  <circle cx="8.6" cy="13.8" r="1.1" fill="currentColor" />
                </svg>
              </span>
            </HoverTip>
          </div>
        </div>
      </router-link>
    </div>
  </section>
</template>
