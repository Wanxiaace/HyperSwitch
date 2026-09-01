<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AgentCatalogCard from '@/components/AgentCatalogCard.vue'
import HeaderPairsEditor from '@/components/HeaderPairsEditor.vue'
import ModelIdField from '@/components/ModelIdField.vue'
import OptionChips from '@/components/OptionChips.vue'
import PromptEditor from '@/components/PromptEditor.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { useAgentForm } from '@/composables/useAgentForm'
import { useI18nLabels } from '@/composables/useI18nLabels'
import {
  emptyGrokCatalogRow,
  emptyGrokSettings,
  grokBackendFromFormat,
  grokMenuName,
  grokProfileFor,
  grokProfileId,
  GROK_BACKEND_LABELS,
  GROK_BACKENDS,
  type GrokCatalogRow,
  type GrokLoadResult,
  type GrokSettingsView
} from '@shared/grokSettings'
import {
  defaultModelDisplayName,
  findProviderBySlug,
  THINKING_LEVELS,
  toggleThinkingLevel,
  type ThinkingLevel
} from '@shared/provider'

const props = defineProps<{
  active: boolean
}>()

const {
  toastStore,
  loading,
  saving,
  revealKey,
  providerId,
  promptDraft,
  savedPromptDraft,
  promptEnabled,
  savedPromptEnabled,
  bakExists,
  filteredProviders,
  providerOptions,
  selectedProvider,
  providerModels,
  modelChoices,
  matchProvider,
  setPromptDraft,
  setPromptEnabled,
  thinkingOptions,
  pickThinking,
  promptAction,
  cloneJson
} = useAgentForm({
  formats: ['openai-completions', 'openai-responses', 'anthropic-messages']
})
const { t, thinkingLabels } = useI18nLabels()

const draft = ref<GrokSettingsView>(emptyGrokSettings())
const saved = ref<GrokSettingsView>(emptyGrokSettings())

const backendOptions = GROK_BACKENDS.map((value) => ({
  value,
  label: GROK_BACKEND_LABELS[value]
}))

const dirty = computed(
  () =>
    JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
    promptEnabled.value !== savedPromptEnabled.value ||
    (promptEnabled.value && promptDraft.value !== savedPromptDraft.value)
)

const defaultModelChoices = computed(() =>
  draft.value.catalog
    .map((row) => grokProfileFor(row, draft.value.providerId))
    .filter(Boolean)
    .map((id) => {
      const row = draft.value.catalog.find((item) => grokProfileFor(item, draft.value.providerId) === id)
      return { id, ownedBy: row?.displayName || row?.model || null }
    })
)

const selectedDefaultRow = computed(
  () =>
    draft.value.catalog.find((row) => grokProfileFor(row, draft.value.providerId) === draft.value.defaultProfile) ??
    draft.value.catalog.find((row) => row.model === draft.value.defaultProfile) ??
    null
)

function supplierName(): string {
  return selectedProvider.value?.name || draft.value.providerName
}

const effortOptions = computed(() => {
  const modelId = selectedDefaultRow.value?.model || ''
  const fromProvider = providerModels.value.find((model) => model.id === modelId)
  const levels = selectedDefaultRow.value?.reasoningLevels.length
    ? selectedDefaultRow.value.reasoningLevels
    : (fromProvider?.thinkingLevels ?? [])
  return thinkingOptions(levels, draft.value.reasoningEffort)
})

function patch(partial: Partial<GrokSettingsView>): void {
  draft.value = { ...draft.value, ...partial }
}

function capsFor(modelId: string) {
  const fromProvider = providerModels.value.find((model) => model.id === modelId)
  const modelName = fromProvider?.name || defaultModelDisplayName(modelId) || modelId
  return {
    displayName: grokMenuName(supplierName(), modelName),
    contextWindow: fromProvider?.contextWindow ? String(fromProvider.contextWindow) : '',
    maxOutput: fromProvider?.maxOutput ? String(fromProvider.maxOutput) : '',
    reasoningLevels: (fromProvider?.thinkingLevels ?? []).filter((level) => level !== 'off'),
    fromPreset: Boolean(fromProvider)
  }
}

function applyProvider(id: string): void {
  providerId.value = id
  if (!id) {
    patch({ providerId: '' })
    return
  }
  const provider = findProviderBySlug(filteredProviders.value, id)
  if (!provider) return
  const models = provider.models.filter((model) => model.id.trim())
  const next: GrokSettingsView = {
    ...draft.value,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    providerId: provider.slug,
    providerName: provider.name,
    apiBackend: grokBackendFromFormat(provider.apiFormat)
  }
  if (draft.value.catalog.length === 0 && models.length > 0) {
    next.catalog = models.map((model) => {
      const caps = capsFor(model.id)
      return emptyGrokCatalogRow({
        profile: grokProfileId(provider.slug, model.id),
        model: model.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        reasoningLevels: caps.reasoningLevels
      })
    })
    next.defaultProfile = next.catalog[0]?.profile ?? ''
  }
  if (next.defaultProfile) {
    const row = next.catalog.find((item) => item.profile === next.defaultProfile)
    next.reasoningEffort = pickThinking(row?.reasoningLevels ?? [], next.reasoningEffort)
  }
  draft.value = next
}

function setDefaultProfile(profile: string): void {
  const row =
    draft.value.catalog.find((item) => item.profile === profile) ??
    draft.value.catalog.find((item) => grokProfileFor(item, draft.value.providerId) === profile)
  patch({
    defaultProfile: profile,
    reasoningEffort: pickThinking(row?.reasoningLevels ?? [], draft.value.reasoningEffort)
  })
}

function addCatalogRow(): void {
  const used = new Set(draft.value.catalog.map((row) => row.model))
  const next = providerModels.value.find((model) => model.id.trim() && !used.has(model.id))
  const caps = next ? capsFor(next.id) : null
  const row = next && caps
    ? emptyGrokCatalogRow({
        profile: grokProfileId(draft.value.providerId || providerId.value, next.id),
        model: next.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        reasoningLevels: caps.reasoningLevels
      })
    : emptyGrokCatalogRow()
  patch({
    catalog: [...draft.value.catalog, row],
    defaultProfile: draft.value.defaultProfile || row.profile
  })
}

function typeCatalogModel(id: string, modelId: string): void {
  patch({
    catalog: draft.value.catalog.map((row) => {
      if (row.id !== id) return row
      const auto = grokProfileId(draft.value.providerId || providerId.value, row.model)
      const profile =
        !row.profile.trim() || row.profile.trim() === auto
          ? grokProfileId(draft.value.providerId || providerId.value, modelId)
          : row.profile
      return { ...row, model: modelId, profile }
    })
  })
}

function setCatalogModel(id: string, modelId: string): void {
  const caps = capsFor(modelId)
  patch({
    catalog: draft.value.catalog.map((row) => {
      if (row.id !== id) return row
      return {
        ...row,
        model: modelId,
        displayName: caps.displayName,
        contextWindow: caps.fromPreset ? caps.contextWindow : row.contextWindow,
        maxOutput: caps.fromPreset ? caps.maxOutput : row.maxOutput,
        reasoningLevels: caps.fromPreset ? caps.reasoningLevels : row.reasoningLevels,
        profile: grokProfileId(draft.value.providerId || providerId.value, modelId)
      }
    })
  })
}

function updateCatalogRow(id: string, partial: Partial<GrokCatalogRow>): void {
  patch({
    catalog: draft.value.catalog.map((row) => (row.id === id ? { ...row, ...partial } : row))
  })
}

function setCatalogNumber(id: string, field: 'contextWindow' | 'maxOutput', raw: string): void {
  updateCatalogRow(id, { [field]: raw.replace(/[^\d]/g, '') })
}

function toggleCatalogThinking(id: string, level: ThinkingLevel, enabled: boolean): void {
  const row = draft.value.catalog.find((item) => item.id === id)
  if (!row) return
  const current = row.reasoningLevels.filter((item): item is ThinkingLevel =>
    (THINKING_LEVELS as readonly string[]).includes(item)
  )
  if (current.includes(level) === enabled) return
  updateCatalogRow(id, { reasoningLevels: toggleThinkingLevel(current, level) })
}

async function load(): Promise<void> {
  if (!window.hyper?.loadAgentSettings) return
  loading.value = true
  try {
    const file = (await window.hyper.loadAgentSettings('grok')) as GrokLoadResult
    const slug = matchProvider(file.settings.providerId)
    const hs = findProviderBySlug(filteredProviders.value, slug)
    const providerName = hs?.name || file.settings.providerName
    const catalog = file.settings.catalog.map((row) => ({
      ...row,
      profile: grokProfileFor(row, file.settings.providerId),
      displayName: grokMenuName(providerName, row.displayName || row.model)
    }))
    const previousDefault = file.settings.defaultProfile.trim()
    const renamed = file.settings.catalog.find((row) => row.profile.trim() === previousDefault)
    draft.value = {
      ...file.settings,
      providerName,
      catalog,
      defaultProfile: renamed
        ? grokProfileFor(renamed, file.settings.providerId)
        : previousDefault
    }
    saved.value = cloneJson(file.settings)
    providerId.value = slug
    bakExists.value = file.prompt.bakExists
    promptEnabled.value = file.prompt.bakExists
    savedPromptEnabled.value = file.prompt.bakExists
    promptDraft.value = file.prompt.content
    savedPromptDraft.value = file.prompt.content
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.readFailed', { name: 'Grok' }))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) void load()
  },
  { immediate: true }
)

async function save(): Promise<void> {
  if (!window.hyper?.saveAgentSettings) return
  saving.value = true
  try {
    const snapshot = cloneJson(draft.value)
    const prompt = promptAction()
    await window.hyper.saveAgentSettings('grok', { settings: snapshot, prompt })
    saved.value = snapshot
    savedPromptDraft.value = promptDraft.value
    savedPromptEnabled.value = promptEnabled.value
    bakExists.value = prompt.mode === 'preset' ? true : prompt.mode === 'none' ? false : bakExists.value
    toastStore.success(t('editor.wrote', { name: 'Grok Build' }))
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('toast.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="claude-editor">
    <p v-if="loading" class="hint">{{ t('editor.reading', { path: '~/.grok/config.toml' }) }}</p>
    <template v-else>
      <div class="claude-block">
        <label class="field">
          <span class="field-label">{{ t('editor.provider') }}</span>
          <SelectMenu :model-value="providerId" :options="providerOptions" @update:model-value="applyProvider" />
        </label>
        <p class="hint">{{ t('editor.grokHint') }}</p>
        <label class="field">
          <span class="field-label">{{ t('editor.apiProtocol') }}</span>
          <SelectMenu :model-value="draft.apiBackend" :options="backendOptions" @update:model-value="patch({ apiBackend: $event })" />
        </label>
        <label class="field">
          <span class="field-label">Base URL</span>
          <input
            :value="draft.baseUrl"
            placeholder="https://api.x.ai/v1"
            @input="patch({ baseUrl: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="field">
          <span class="field-label">API Key</span>
          <span class="key-row">
            <input
              :type="revealKey ? 'text' : 'password'"
              :value="draft.apiKey"
              autocomplete="off"
              @input="patch({ apiKey: ($event.target as HTMLInputElement).value })"
            />
            <button class="btn" type="button" @click="revealKey = !revealKey">
              {{ revealKey ? t('common.hide') : t('common.show') }}
            </button>
          </span>
        </label>
        <label class="field">
          <span class="field-label">{{ t('editor.defaultModel') }}</span>
          <ModelIdField
            :model-value="draft.defaultProfile"
            :models="defaultModelChoices"
            :placeholder="t('editor.grokModelPh')"
            @update:model-value="setDefaultProfile"
            @select="setDefaultProfile"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ t('editor.thinking') }}</span>
          <SelectMenu
            :model-value="draft.reasoningEffort"
            :options="effortOptions"
            @update:model-value="patch({ reasoningEffort: $event })"
          />
        </label>
      </div>

      <div class="claude-block">
        <div class="header-section-head">
          <h3>{{ t('editor.modelMap') }}</h3>
          <div class="models-actions">
            <button class="btn btn-sm" type="button" @click="addCatalogRow">{{ t('editor.addModel') }}</button>
          </div>
        </div>
        <p class="hint">{{ t('editor.grokMapHint') }}</p>
        <div class="agent-catalog-list">
          <AgentCatalogCard
            v-for="row in draft.catalog"
            :key="row.id"
            class="grok"
            :open="!row.model"
            @remove="patch({ catalog: draft.catalog.filter((item) => item.id !== row.id) })"
          >
            <template #head>
              <input
                :value="row.profile"
                :placeholder="t('editor.configId')"
                spellcheck="false"
                @input="updateCatalogRow(row.id, { profile: ($event.target as HTMLInputElement).value })"
              />
              <input
                :value="row.displayName"
                :placeholder="t('editor.displayName')"
                @input="updateCatalogRow(row.id, { displayName: ($event.target as HTMLInputElement).value })"
              />
              <ModelIdField
                :model-value="row.model"
                :models="modelChoices"
                :placeholder="t('editor.requestModel')"
                @update:model-value="typeCatalogModel(row.id, $event)"
                @select="setCatalogModel(row.id, $event)"
              />
            </template>
            <div class="form-grid">
              <label class="field">
                <span class="field-label">{{ t('editor.context') }}</span>
                <input
                  :value="row.contextWindow"
                  type="number"
                  min="1"
                  placeholder="500000"
                  @input="setCatalogNumber(row.id, 'contextWindow', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="field">
                <span class="field-label">{{ t('editor.maxOutput') }}</span>
                <input
                  :value="row.maxOutput"
                  type="number"
                  min="1"
                  placeholder="32768"
                  @input="setCatalogNumber(row.id, 'maxOutput', ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.thinking') }}</span>
              <OptionChips
                :options="THINKING_LEVELS"
                :labels="thinkingLabels"
                :model-value="row.reasoningLevels.filter((item): item is ThinkingLevel => (THINKING_LEVELS as readonly string[]).includes(item))"
                @toggle="(level, enabled) => toggleCatalogThinking(row.id, level, enabled)"
              />
            </div>
          </AgentCatalogCard>
        </div>
      </div>

      <div class="claude-block">
        <HeaderPairsEditor
          :model-value="draft.customHeaders"
          @update:model-value="patch({ customHeaders: $event })"
        >
          <p class="hint">
            {{ t('editor.grokHeaders') }}
            <router-link class="claude-link" to="/headers">{{ t('editor.managePresets') }}</router-link>
          </p>
        </HeaderPairsEditor>
      </div>

      <div class="claude-block">
        <PromptEditor
          :enabled="promptEnabled"
          :content="promptDraft"
          :label="t('editor.globalAgents')"
          @update:enabled="setPromptEnabled"
          @update:content="setPromptDraft"
        />
      </div>

      <div class="claude-save">
        <button class="btn btn-primary btn-save" type="button" :disabled="saving || !dirty" @click="save">{{ t('common.save') }}</button>
      </div>
    </template>
  </div>
</template>
