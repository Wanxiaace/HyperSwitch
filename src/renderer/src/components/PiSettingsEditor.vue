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
  emptyPiCatalogRow,
  emptyPiSettings,
  PI_INPUTS,
  sanitizePiInput,
  togglePiInput,
  type PiCatalogRow,
  type PiInput,
  type PiLoadResult,
  type PiSettingsView
} from '@shared/piSettings'
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
  providerModels,
  modelChoices,
  matchProvider,
  setPromptDraft,
  setPromptEnabled,
  thinkingOptions,
  pickThinking,
  promptAction,
  cloneJson
} = useAgentForm()
const { t, modalityLabels, thinkingLabels } = useI18nLabels()

const draft = ref<PiSettingsView>(emptyPiSettings())
const saved = ref<PiSettingsView>(emptyPiSettings())

const dirty = computed(
  () =>
    JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
    promptEnabled.value !== savedPromptEnabled.value ||
    (promptEnabled.value && promptDraft.value !== savedPromptDraft.value)
)

const effortOptions = computed(() => {
  const fromProvider = providerModels.value.find((model) => model.id === draft.value.model)
  const row = draft.value.catalog.find((item) => item.model === draft.value.model)
  const levels = row?.thinkingLevels.length ? row.thinkingLevels : (fromProvider?.thinkingLevels ?? [])
  return thinkingOptions(levels, draft.value.thinkingLevel)
})

function patch(partial: Partial<PiSettingsView>): void {
  draft.value = { ...draft.value, ...partial }
}

function capsFor(modelId: string) {
  const fromProvider = providerModels.value.find((model) => model.id === modelId)
  return {
    displayName: fromProvider?.name || defaultModelDisplayName(modelId) || modelId,
    contextWindow: fromProvider?.contextWindow ? String(fromProvider.contextWindow) : '',
    maxOutput: fromProvider?.maxOutput ? String(fromProvider.maxOutput) : '',
    thinkingLevels: fromProvider?.thinkingLevels ?? [],
    input: sanitizePiInput(fromProvider?.input)
  }
}

function setDefaultModel(id: string, fill = false): void {
  const caps = capsFor(id)
  if (!fill && !providerModels.value.some((model) => model.id === id)) {
    patch({ model: id })
    return
  }
  patch({ model: id, thinkingLevel: pickThinking(caps.thinkingLevels, draft.value.thinkingLevel) })
}

function applyProvider(id: string): void {
  providerId.value = id
  const provider = findProviderBySlug(filteredProviders.value, id)
  if (!provider) return
  const models = provider.models.filter((model) => model.id.trim())
  const next: PiSettingsView = {
    ...draft.value,
    providerKey: provider.slug.trim(),
    providerName: provider.name,
    api: provider.apiFormat,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl
  }
  if (draft.value.catalog.length === 0 && models.length > 0) {
    next.catalog = models.map((model) => {
      const caps = capsFor(model.id)
      return emptyPiCatalogRow({
        model: model.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        thinkingLevels: caps.thinkingLevels,
        input: caps.input
      })
    })
  }
  if (!models.some((model) => model.id === next.model)) next.model = models[0]?.id ?? ''
  if (next.model) {
    const caps = capsFor(next.model)
    next.thinkingLevel = pickThinking(caps.thinkingLevels, next.thinkingLevel)
  }
  draft.value = next
}

function addCatalogRow(): void {
  const used = new Set(draft.value.catalog.map((row) => row.model))
  const next = providerModels.value.find((model) => model.id.trim() && !used.has(model.id))
  if (!next) {
    patch({ catalog: [...draft.value.catalog, emptyPiCatalogRow()] })
    return
  }
  const caps = capsFor(next.id)
  patch({
    catalog: [
      ...draft.value.catalog,
      emptyPiCatalogRow({
        model: next.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        thinkingLevels: caps.thinkingLevels,
        input: caps.input
      })
    ]
  })
}

function typeCatalogModel(id: string, modelId: string): void {
  patch({
    catalog: draft.value.catalog.map((row) => (row.id === id ? { ...row, model: modelId } : row))
  })
}

function setCatalogModel(id: string, modelId: string): void {
  const caps = capsFor(modelId)
  const fromPreset = providerModels.value.some((model) => model.id === modelId)
  patch({
    catalog: draft.value.catalog.map((row) =>
      row.id === id
        ? {
            ...row,
            model: modelId,
            displayName: caps.displayName,
            ...(fromPreset
              ? {
                  contextWindow: caps.contextWindow,
                  maxOutput: caps.maxOutput,
                  thinkingLevels: caps.thinkingLevels,
                  input: caps.input
                }
              : {})
          }
        : row
    )
  })
}

function updateCatalogRow(id: string, partial: Partial<PiCatalogRow>): void {
  patch({
    catalog: draft.value.catalog.map((row) => (row.id === id ? { ...row, ...partial } : row))
  })
}

function setCatalogNumber(id: string, field: 'contextWindow' | 'maxOutput', raw: string): void {
  updateCatalogRow(id, { [field]: raw.replace(/[^\d]/g, '') })
}

function toggleCatalogInput(id: string, type: PiInput, enabled: boolean): void {
  const row = draft.value.catalog.find((item) => item.id === id)
  if (!row) return
  const current = sanitizePiInput(row.input)
  if (current.includes(type) === enabled) return
  updateCatalogRow(id, { input: togglePiInput(current, type) })
}

function toggleCatalogThinking(id: string, level: ThinkingLevel, enabled: boolean): void {
  const row = draft.value.catalog.find((item) => item.id === id)
  if (!row) return
  if (row.thinkingLevels.includes(level) === enabled) return
  updateCatalogRow(id, { thinkingLevels: toggleThinkingLevel(row.thinkingLevels, level) })
}

async function load(): Promise<void> {
  if (!window.hyper?.loadAgentSettings) return
  loading.value = true
  try {
    const file = (await window.hyper.loadAgentSettings('pi')) as PiLoadResult
    draft.value = file.settings
    saved.value = cloneJson(file.settings)
    providerId.value = matchProvider(file.settings.providerKey)
    bakExists.value = file.prompt.bakExists
    promptEnabled.value = file.prompt.bakExists
    savedPromptEnabled.value = file.prompt.bakExists
    promptDraft.value = file.prompt.content
    savedPromptDraft.value = file.prompt.content
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.readFailed', { name: 'Pi' }))
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
    await window.hyper.saveAgentSettings('pi', { settings: snapshot, prompt })
    saved.value = snapshot
    savedPromptDraft.value = promptDraft.value
    savedPromptEnabled.value = promptEnabled.value
    bakExists.value = prompt.mode === 'preset' ? true : prompt.mode === 'none' ? false : bakExists.value
    toastStore.success(t('editor.wrote', { name: 'Pi' }))
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('toast.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="claude-editor">
    <p v-if="loading" class="hint">{{ t('editor.reading', { path: '~/.pi/agent/models.json' }) }}</p>
    <template v-else>
      <div class="claude-block">
        <label class="field">
          <span class="field-label">{{ t('editor.provider') }}</span>
          <SelectMenu :model-value="providerId" :options="providerOptions" @update:model-value="applyProvider" />
        </label>
        <p class="hint">{{ t('editor.piHint') }}</p>
        <label class="field">
          <span class="field-label">Base URL</span>
          <input
            :value="draft.baseUrl"
            placeholder="https://api.deepseek.com"
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
            :model-value="draft.model"
            :models="modelChoices"
            placeholder="model-id"
            @update:model-value="setDefaultModel($event)"
            @select="setDefaultModel($event, true)"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ t('editor.thinking') }}</span>
          <SelectMenu
            :model-value="draft.thinkingLevel"
            :options="effortOptions"
            @update:model-value="patch({ thinkingLevel: $event })"
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
        <p class="hint">{{ t('editor.piMapHint') }}</p>
        <div class="agent-catalog-list">
          <AgentCatalogCard
            v-for="row in draft.catalog"
            :key="row.id"
            :open="!row.model"
            @remove="patch({ catalog: draft.catalog.filter((item) => item.id !== row.id) })"
          >
            <template #head>
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
                  placeholder="262144"
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
              <span class="capability-label">{{ t('caps.input') }}</span>
              <OptionChips
                :options="PI_INPUTS"
                :labels="modalityLabels"
                :model-value="sanitizePiInput(row.input)"
                @toggle="(type, enabled) => toggleCatalogInput(row.id, type, enabled)"
              />
            </div>
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.thinking') }}</span>
              <OptionChips
                :options="THINKING_LEVELS"
                :labels="thinkingLabels"
                :model-value="row.thinkingLevels"
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
            {{ t('editor.piHeaders') }}
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
