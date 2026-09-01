<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import BatchAddModelsDialog from '@/components/BatchAddModelsDialog.vue'
import IconPicker from '@/components/IconPicker.vue'
import ModelRow from '@/components/ModelRow.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { guessIcon } from '@/icons/guess'
import { fetchModelsErrorMessage } from '@/lib/format'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'
import {
  API_FORMAT_LABELS,
  API_FORMATS,
  isProviderKey,
  type ApiFormat,
  type FetchedModel
} from '@shared/provider'

const route = useRoute()
const router = useRouter()
const providerStore = useProviderStore()
const toastStore = useToastStore()
const { t } = useLocaleStore()
const { providers, dirty, saving } = storeToRefs(providerStore)

const query = ref('')
const agentList = ref<HTMLElement | null>(null)
const fetchedModels = ref<FetchedModel[]>([])
const fetching = ref(false)
const fetchMessage = ref('')
const fetchError = ref(false)
const revealKey = ref(false)
const batchOpen = ref(false)
let fetchGeneration = 0

const formatOptions = API_FORMATS.map((format) => ({
  value: format,
  label: API_FORMAT_LABELS[format]
}))

const filteredProviders = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return providers.value
  return providers.value.filter((provider) =>
    [provider.name, provider.baseUrl, provider.apiFormat].join(' ').toLowerCase().includes(keyword)
  )
})

const selectedId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const selected = computed(() => providerStore.getById(selectedId.value) ?? null)

const slugHint = computed(() => {
  const slug = selected.value?.slug.trim() ?? ''
  if (!slug) return t('providers.slugEmpty')
  if (!isProviderKey(slug)) return t('providers.slugInvalid')
  if (providerStore.slugConflict(slug, selected.value?.id)) return t('providers.slugTaken')
  return t('providers.slugOk')
})

watch(
  [() => route.params.id, providers],
  () => {
    if (route.name !== 'provider-detail') return
    if (!selected.value) router.replace({ name: 'providers' })
  },
  { immediate: true }
)

watch(selectedId, () => {
  fetchedModels.value = []
  fetchMessage.value = ''
  fetchError.value = false
  revealKey.value = false
  batchOpen.value = false
})

function openProvider(id: string): void {
  router.push({ name: 'provider-detail', params: { id } })
}

function createProvider(): void {
  const provider = providerStore.createProvider()
  openProvider(provider.id)
  requestAnimationFrame(() => {
    agentList.value?.scrollTo({ top: 0 })
  })
}

function patchSelected(patch: Parameters<typeof providerStore.updateProvider>[1]): void {
  if (!selected.value) return
  if (!patch.icon && !selected.value.icon && (patch.name || patch.baseUrl || patch.websiteUrl)) {
    const icon = guessIcon(patch.name ?? selected.value.name, patch.baseUrl ?? selected.value.baseUrl)
    if (icon) patch = { ...patch, icon }
  }
  providerStore.updateProvider(selected.value.id, patch)
}

function setIcon(icon: string): void {
  patchSelected({ icon })
}

function patchFormat(value: string): void {
  if ((API_FORMATS as readonly string[]).includes(value)) {
    patchSelected({ apiFormat: value as ApiFormat })
  }
}

function removeProvider(id: string): void {
  const selectedWas = selectedId.value === id
  providerStore.removeProvider(id)
  if (selectedWas) router.replace({ name: 'providers' })
}

function removeSelected(): void {
  if (!selected.value) return
  removeProvider(selected.value.id)
}

async function fetchRemoteModels(): Promise<void> {
  if (!selected.value) return
  if (!selected.value.baseUrl.trim()) {
    fetchError.value = true
    fetchMessage.value = t('providers.emptyBaseUrl')
    toastStore.error(t('providers.emptyBaseUrl'))
    return
  }
  if (!selected.value.apiKey.trim()) {
    fetchError.value = true
    fetchMessage.value = t('providers.emptyApiKey')
    toastStore.error(t('providers.emptyApiKey'))
    return
  }

  const generation = ++fetchGeneration
  fetching.value = true
  fetchMessage.value = ''
  fetchError.value = false
  const result = await window.hyper.fetchModels({
    baseUrl: selected.value.baseUrl,
    apiKey: selected.value.apiKey,
    apiFormat: selected.value.apiFormat
  })
  if (generation !== fetchGeneration) return
  fetching.value = false
  if (!result.ok) {
    fetchError.value = true
    fetchMessage.value = fetchModelsErrorMessage(result.error)
    fetchedModels.value = []
    toastStore.error(fetchMessage.value)
    return
  }
  fetchedModels.value = result.models
  if (result.models.length === 0) {
    fetchMessage.value = t('providers.noFetched')
    toastStore.error(t('providers.noFetched'))
    return
  }
  fetchMessage.value = t('providers.fetched', { count: result.models.length })
  toastStore.success(fetchMessage.value)
}

function addBlankModel(): void {
  if (!selected.value) return
  providerStore.addModel(selected.value.id)
}

async function openBatchAdd(): Promise<void> {
  batchOpen.value = true
  if (fetchedModels.value.length === 0 && !fetching.value) {
    await fetchRemoteModels()
  }
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <h1 class="page-title">{{ t('providers.title') }}</h1>
    </header>

    <div class="workspace">
      <div class="list-pane">
        <input v-model="query" class="search" type="search" :placeholder="t('providers.search')" />
        <div ref="agentList" class="agent-list">
          <TransitionGroup name="provider-item" tag="div" class="agent-stack">
            <div
              v-for="provider in filteredProviders"
              :key="provider.id"
              class="agent-card"
              :class="{ selected: provider.id === selectedId }"
              @click="openProvider(provider.id)"
            >
              <ProviderIcon :icon="provider.icon" :name="provider.name" :size="32" />
              <div>
                <div class="agent-name">{{ provider.name }}</div>
                <div class="agent-desc">{{ provider.baseUrl || t('providers.noBaseUrl') }}</div>
                <div class="agent-meta">{{ API_FORMAT_LABELS[provider.apiFormat] }} · {{ t('providers.modelCount', { count: provider.models.length }) }}</div>
              </div>
              <button
                class="card-delete"
                type="button"
                :title="t('common.delete')"
                @click.stop="removeProvider(provider.id)"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M4 5.5h12M7 5.5V4h6v1.5M6.5 8l.6 8h6.8l.6-8" />
                </svg>
              </button>
            </div>
          </TransitionGroup>
          <div v-if="filteredProviders.length === 0" class="empty-list">{{ t('providers.empty') }}</div>
        </div>
        <div class="list-pane-foot">
          <button class="list-add" type="button" @click="createProvider">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M8 3.2v9.6M3.2 8h9.6" />
            </svg>
            {{ t('providers.add') }}
          </button>
        </div>
      </div>

      <div class="editor-pane">
        <Transition name="editor-fade" mode="out-in">
          <div v-if="!selected" key="empty" class="editor-empty">
            <div>
              <h2>{{ t('providers.pickTitle') }}</h2>
              <p>{{ t('providers.pickDesc') }}</p>
            </div>
          </div>

          <form v-else key="editor" class="form form-wide editor-form" @submit.prevent="providerStore.save()">
            <div class="editor-scroll">
              <div class="editor-card">
                <div class="identity-icon">
                  <IconPicker :model-value="selected.icon" :name="selected.name" @update:model-value="setIcon" />
                </div>
                <div class="form-grid">
                  <label class="field">
                    <span class="field-label">{{ t('providers.name') }}</span>
                    <input
                      :value="selected.name"
                      :placeholder="t('providers.namePh')"
                      @input="patchSelected({ name: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('providers.slug') }} <span class="req">*</span></span>
                    <input
                      :value="selected.slug"
                      :placeholder="t('providers.slugPh')"
                      spellcheck="false"
                      @input="patchSelected({ slug: ($event.target as HTMLInputElement).value.trim().toLowerCase() })"
                    />
                    <span class="hint" style="margin: 0">{{ slugHint }}</span>
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('providers.notes') }}</span>
                    <input
                      :value="selected.notes"
                      :placeholder="t('providers.notesPh')"
                      @input="patchSelected({ notes: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="field span-2">
                    {{ t('providers.website') }}
                    <input
                      :value="selected.websiteUrl"
                      :placeholder="t('providers.websitePh')"
                      @input="patchSelected({ websiteUrl: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                </div>
              </div>

              <div class="editor-card">
                <div class="form-grid">
                  <label class="field span-2">
                    {{ t('providers.apiFormat') }}
                    <SelectMenu :model-value="selected.apiFormat" :options="formatOptions" @update:model-value="patchFormat" />
                  </label>
                  <label class="field span-2">
                    Base URL
                    <input
                      :value="selected.baseUrl"
                      placeholder="https://api.example.com/v1"
                      @input="patchSelected({ baseUrl: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="field span-2">
                    API Key
                    <span class="key-row">
                      <input
                        :type="revealKey ? 'text' : 'password'"
                        :value="selected.apiKey"
                        autocomplete="off"
                        @input="patchSelected({ apiKey: ($event.target as HTMLInputElement).value })"
                      />
                      <button class="btn" type="button" @click="revealKey = !revealKey">
                        {{ revealKey ? t('common.hide') : t('common.show') }}
                      </button>
                    </span>
                  </label>
                </div>
              </div>

              <section class="editor-card models-section">
                <div class="models-section-head">
                  <h3>{{ t('providers.models') }}</h3>
                  <div class="models-actions">
                    <button class="btn btn-sm" type="button" :disabled="fetching" @click="fetchRemoteModels">
                      <svg
                        v-if="fetching"
                        class="btn-svg spin"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                      >
                        <path d="M8 2.6a5.4 5.4 0 1 1-4.7 2.8" stroke-linecap="round" />
                      </svg>
                      <svg
                        v-else
                        class="btn-svg"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path d="M8 3v7M5 8l3 3 3-3M3.5 12.5h9" />
                      </svg>
                      {{ fetching ? t('providers.fetching') : t('providers.fetch') }}
                    </button>
                    <button class="btn btn-sm" type="button" @click="openBatchAdd">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 5h10M3 8h10M3 11h6" />
                      </svg>
                      {{ t('providers.batch') }}
                    </button>
                    <button class="btn btn-sm" type="button" @click="addBlankModel">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M8 3.5v9M3.5 8h9" />
                      </svg>
                      {{ t('providers.addModel') }}
                    </button>
                  </div>
                </div>
                <p v-if="fetchMessage" class="hint" :class="{ error: fetchError }">{{ fetchMessage }}</p>

                <p v-if="selected.models.length === 0" class="hint">{{ t('providers.noModels') }}</p>
                <div v-else class="cc-model-list">
                  <div class="cc-model-cols">
                    <span class="cc-col-icon" />
                    <span>{{ t('providers.modelId') }} <span class="req">*</span></span>
                    <span>{{ t('providers.displayName') }} <span class="req">*</span></span>
                    <span class="cc-col-icon" />
                  </div>
                  <TransitionGroup name="model-item" tag="div" class="cc-model-stack">
                    <ModelRow
                      v-for="model in selected.models"
                      :key="model.key"
                      :model="model"
                      :fetched-models="fetchedModels"
                      @update="providerStore.updateModel(selected.id, model.key, $event)"
                      @remove="providerStore.removeModel(selected.id, model.key)"
                    />
                  </TransitionGroup>
                </div>
              </section>
            </div>

            <div class="editor-footer">
              <button class="btn" type="button" @click="removeSelected">{{ t('providers.deleteProvider') }}</button>
              <button class="btn btn-primary btn-save" type="submit" :disabled="saving || !dirty">
                {{ t('common.save') }}
              </button>
            </div>
          </form>
        </Transition>
      </div>
    </div>

    <BatchAddModelsDialog
      :open="batchOpen && !!selected"
      :provider-id="selected?.id ?? ''"
      :provider-name="selected?.name ?? ''"
      :fetched-models="fetchedModels"
      :fetching="fetching"
      :fetch-error="fetchError"
      :fetch-message="fetchMessage"
      @close="batchOpen = false"
      @retry="fetchRemoteModels"
    />
  </section>
</template>
