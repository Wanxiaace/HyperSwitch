<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AgentCatalogCard from '@/components/AgentCatalogCard.vue'
import HeaderPairsEditor from '@/components/HeaderPairsEditor.vue'
import ModelIdField from '@/components/ModelIdField.vue'
import OptionChips from '@/components/OptionChips.vue'
import PromptEditor from '@/components/PromptEditor.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { useProviderStore } from '@/stores/providers'
import { useI18nLabels } from '@/composables/useI18nLabels'
import { useToastStore } from '@/stores/toasts'
import { resolvePromptAction } from '@shared/agentPlugin'
import {
  CODEX_EFFORTS,
  emptyCodexCatalogRow,
  emptyCodexSettings,
  type CodexCatalogRow,
  type CodexEffort,
  type CodexLoadResult,
  type CodexSettingsView
} from '@shared/codexSettings'
import {
  defaultModelDisplayName,
  findProviderBySlug,
  MODALITIES,
  sanitizeModalities,
  toggleModality,
  type Modality
} from '@shared/provider'

const props = defineProps<{
  active: boolean
}>()

const toastStore = useToastStore()
const { t, modalityLabels } = useI18nLabels()
const providerStore = useProviderStore()
const { savedProviders } = storeToRefs(providerStore)

const loading = ref(false)
const saving = ref(false)
const revealKey = ref(false)
const providerId = ref('')
const promptDraft = ref('')
const savedPromptDraft = ref('')
const promptEnabled = ref(false)
const savedPromptEnabled = ref(false)
const bakExists = ref(false)
const instructDraft = ref('')
const savedInstructDraft = ref('')
const instructEnabled = ref(false)
const savedInstructEnabled = ref(false)
const instructBakExists = ref(false)
const draft = ref<CodexSettingsView>(emptyCodexSettings())
const saved = ref<CodexSettingsView>(emptyCodexSettings())

const responsesProviders = computed(() =>
  savedProviders.value.filter((provider) => provider.apiFormat === 'openai-responses')
)

const providerOptions = computed(() => [
  { value: '', label: t('editor.manualFill') },
  ...responsesProviders.value
    .filter((provider) => provider.slug.trim())
    .map((provider) => ({
      value: provider.slug,
      label: provider.name
    }))
])

const selectedProvider = computed(
  () => findProviderBySlug(responsesProviders.value, providerId.value) ?? null
)

const providerModels = computed(() => {
  const list = selectedProvider.value
    ? selectedProvider.value.models
    : responsesProviders.value.flatMap((provider) => provider.models)
  const seen = new Set<string>()
  const models: { id: string; name: string }[] = []
  for (const model of list) {
    const id = model.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({ id, name: model.name.trim() })
  }
  return models
})

const modelChoices = computed(() =>
  providerModels.value.map((model) => ({
    id: model.id,
    ownedBy: selectedProvider.value?.name || model.name || null
  }))
)

function supportedEfforts(modelId: string): CodexEffort[] {
  return capsFor(modelId).reasoningLevels
}

const effortLabels = computed(() => {
  const labels = {} as Record<CodexEffort, string>
  for (const level of CODEX_EFFORTS) {
    labels[level] = t(`thinking.${level}`)
  }
  return labels
})

const effortOptions = computed(() => {
  const options: { value: string; label: string }[] = CODEX_EFFORTS.map((level) => ({
    value: level,
    label: effortLabels.value[level]
  }))
  const current = draft.value.reasoningEffort
  if (current && !options.some((item) => item.value === current)) {
    options.unshift({
      value: current,
      label: current
    })
  }
  return options
})

const dirty = computed(
  () =>
    JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
    promptEnabled.value !== savedPromptEnabled.value ||
    (promptEnabled.value && promptDraft.value !== savedPromptDraft.value) ||
    instructEnabled.value !== savedInstructEnabled.value ||
    (instructEnabled.value && instructDraft.value !== savedInstructDraft.value)
)

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function matchProvider(slug: string): string {
  return findProviderBySlug(responsesProviders.value, slug)?.slug ?? ''
}

async function load(): Promise<void> {
  if (!window.hyper?.loadAgentSettings) return
  loading.value = true
  try {
    const file = (await window.hyper.loadAgentSettings('codex')) as CodexLoadResult
    draft.value = file.settings
    saved.value = cloneJson(file.settings)
    providerId.value = matchProvider(file.settings.providerId)
    bakExists.value = file.prompt.bakExists
    promptEnabled.value = file.prompt.bakExists
    savedPromptEnabled.value = file.prompt.bakExists
    promptDraft.value = file.prompt.content
    savedPromptDraft.value = file.prompt.content
    instructBakExists.value = file.instructions.bakExists
    instructEnabled.value = file.instructions.bakExists
    savedInstructEnabled.value = file.instructions.bakExists
    instructDraft.value = file.instructions.content
    savedInstructDraft.value = file.instructions.content
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.readFailed', { name: 'Codex' }))
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

function patch(partial: Partial<CodexSettingsView>): void {
  draft.value = { ...draft.value, ...partial }
}

function pickEffort(modelId: string, current = ''): string {
  const levels = supportedEfforts(modelId)
  if (levels.length === 0) return 'none'
  if (current && levels.includes(current as CodexEffort)) return current
  return levels.at(-1) ?? 'none'
}

function setDefaultModel(id: string, fill = false): void {
  const fromPreset = providerModels.value.some((model) => model.id === id)
  if (!fill && !fromPreset) {
    patch({ model: id })
    return
  }
  const caps = capsFor(id)
  patch({
    model: id,
    reasoningEffort: fromPreset ? pickEffort(id, draft.value.reasoningEffort) : draft.value.reasoningEffort,
    contextWindow: fromPreset && caps.contextWindow ? caps.contextWindow : draft.value.contextWindow,
    maxOutput: fromPreset && caps.maxOutput ? caps.maxOutput : draft.value.maxOutput
  })
}

function applyProvider(id: string): void {
  providerId.value = id
  if (!id) {
    patch({ providerId: '' })
    return
  }
  const provider = findProviderBySlug(responsesProviders.value, id)
  if (!provider) return
  const models = provider.models.filter((model) => model.id.trim())
  const next: CodexSettingsView = {
    ...draft.value,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    providerId: provider.slug,
    providerName: provider.name
  }
  if (draft.value.catalog.length === 0 && models.length > 0) {
    next.catalog = models.map((model) => {
      const caps = capsFor(model.id)
      return emptyCodexCatalogRow({
        model: model.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        input: caps.input,
        reasoningLevels: caps.reasoningLevels,
        defaultReasoningLevel: caps.reasoningLevels.at(-1) ?? ''
      })
    })
  }
  if (!models.some((model) => model.id === next.model)) {
    next.model = models[0]?.id ?? ''
  }
  next.reasoningEffort = pickEffort(next.model, next.reasoningEffort)
  if (next.model) {
    const caps = capsFor(next.model)
    next.contextWindow = caps.contextWindow
    next.maxOutput = caps.maxOutput
  }
  draft.value = next
}

function setPromptDraft(content: string): void {
  promptDraft.value = content
}

function setInstructDraft(content: string): void {
  instructDraft.value = content
}

function mapThinking(levels: string[]): CodexEffort[] {
  return levels.flatMap((level) => {
    const mapped = level === 'off' ? 'none' : level
    return (CODEX_EFFORTS as readonly string[]).includes(mapped) ? [mapped as CodexEffort] : []
  })
}

function capsFor(
  modelId: string
): Pick<CodexCatalogRow, 'displayName' | 'contextWindow' | 'maxOutput' | 'input' | 'reasoningLevels'> {
  const fromProvider =
    selectedProvider.value?.models.find((model) => model.id === modelId) ??
    savedProviders.value.flatMap((provider) => provider.models).find((model) => model.id === modelId)
  return {
    displayName: fromProvider?.name || defaultModelDisplayName(modelId) || modelId,
    contextWindow: fromProvider?.contextWindow ? String(fromProvider.contextWindow) : '',
    maxOutput: fromProvider?.maxOutput ? String(fromProvider.maxOutput) : '',
    input: fromProvider?.input?.length ? fromProvider.input : ['text'],
    reasoningLevels: mapThinking(fromProvider?.thinkingLevels ?? [])
  }
}

function addCatalogRow(): void {
  const used = new Set(draft.value.catalog.map((row) => row.model))
  const next = providerModels.value.find((model) => model.id.trim() && !used.has(model.id))
  if (!next) {
    patch({ catalog: [...draft.value.catalog, emptyCodexCatalogRow()] })
    return
  }
  const caps = capsFor(next.id)
  patch({
    catalog: [
      ...draft.value.catalog,
      emptyCodexCatalogRow({
        model: next.id,
        displayName: caps.displayName,
        contextWindow: caps.contextWindow,
        maxOutput: caps.maxOutput,
        input: caps.input,
        reasoningLevels: caps.reasoningLevels,
        defaultReasoningLevel: caps.reasoningLevels.at(-1) ?? ''
      })
    ]
  })
}

function updateCatalogRow(id: string, partial: Partial<CodexCatalogRow>): void {
  patch({
    catalog: draft.value.catalog.map((row) => (row.id === id ? { ...row, ...partial } : row))
  })
}

function typeCatalogModel(id: string, modelId: string): void {
  updateCatalogRow(id, { model: modelId })
}

function setCatalogModel(id: string, modelId: string): void {
  const caps = capsFor(modelId)
  const fromPreset = providerModels.value.some((model) => model.id === modelId)
  updateCatalogRow(id, {
    model: modelId,
    displayName: caps.displayName,
    ...(fromPreset
      ? {
          contextWindow: caps.contextWindow,
          maxOutput: caps.maxOutput,
          input: caps.input,
          reasoningLevels: caps.reasoningLevels,
          defaultReasoningLevel: caps.reasoningLevels.at(-1) ?? ''
        }
      : {})
  })
}

function removeCatalogRow(id: string): void {
  patch({ catalog: draft.value.catalog.filter((row) => row.id !== id) })
}

function setCatalogNumber(id: string, field: 'contextWindow' | 'maxOutput', raw: string): void {
  updateCatalogRow(id, { [field]: raw.replace(/[^\d]/g, '') })
}

function toggleCatalogInput(id: string, type: Modality, enabled: boolean): void {
  const row = draft.value.catalog.find((item) => item.id === id)
  if (!row) return
  const current = sanitizeModalities(row.input)
  if (current.includes(type) === enabled) return
  updateCatalogRow(id, { input: toggleModality(current, type) })
}

function toggleCatalogEffort(id: string, level: CodexEffort, enabled: boolean): void {
  const row = draft.value.catalog.find((item) => item.id === id)
  if (!row) return
  if (row.reasoningLevels.includes(level) === enabled) return
  const next = enabled
    ? CODEX_EFFORTS.filter((item) => row.reasoningLevels.includes(item) || item === level)
    : row.reasoningLevels.filter((item) => item !== level)
  updateCatalogRow(id, {
    reasoningLevels: next,
    defaultReasoningLevel: next.includes(row.defaultReasoningLevel as CodexEffort)
      ? row.defaultReasoningLevel
      : (next.at(-1) ?? '')
  })
}

async function save(): Promise<void> {
  if (!window.hyper?.saveAgentSettings) return
  saving.value = true
  try {
    const snapshot = cloneJson(draft.value)
    const prompt = resolvePromptAction(promptEnabled.value, bakExists.value, promptDraft.value, savedPromptDraft.value)
    const instructions = resolvePromptAction(
      instructEnabled.value,
      instructBakExists.value,
      instructDraft.value,
      savedInstructDraft.value
    )
    await window.hyper.saveAgentSettings('codex', {
      settings: snapshot,
      prompt,
      instructions
    })
    saved.value = snapshot
    savedPromptDraft.value = promptDraft.value
    savedPromptEnabled.value = promptEnabled.value
    savedInstructDraft.value = instructDraft.value
    savedInstructEnabled.value = instructEnabled.value
    bakExists.value = prompt.mode === 'preset' ? true : prompt.mode === 'none' ? false : bakExists.value
    instructBakExists.value =
      instructions.mode === 'preset' ? true : instructions.mode === 'none' ? false : instructBakExists.value
    toastStore.success(t('editor.wrote', { name: 'Codex' }))
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('toast.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="claude-editor">
    <p v-if="loading" class="hint">{{ t('editor.reading', { path: '~/.codex/config.toml' }) }}</p>
    <template v-else>
      <div class="claude-block">
        <label class="field">
          <span class="field-label">{{ t('editor.provider') }}</span>
          <SelectMenu :model-value="providerId" :options="providerOptions" @update:model-value="applyProvider" />
        </label>
        <p class="hint">
          {{
            responsesProviders.length
              ? t('editor.codexProviderHint')
              : t('editor.codexNoProvider')
          }}
        </p>
        <label class="field">
          <span class="field-label">Base URL</span>
          <input
            :value="draft.baseUrl"
            placeholder="https://api.openai.com/v1"
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
        <p class="hint">{{ t('editor.authJsonHint') }}</p>
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
        <p class="hint">{{ t('editor.pickOrFill') }}</p>
        <label class="field">
          <span class="field-label">{{ t('editor.thinking') }}</span>
          <SelectMenu
            :model-value="draft.reasoningEffort"
            :options="effortOptions"
            @update:model-value="patch({ reasoningEffort: $event })"
          />
        </label>
        <div class="claude-toggles">
          <label class="claude-toggle">
            <button
              class="picker-check"
              :class="{ on: draft.disableResponseStorage }"
              type="button"
              @click="patch({ disableResponseStorage: !draft.disableResponseStorage })"
            >
              <svg v-if="draft.disableResponseStorage" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
              </svg>
            </button>
            {{ t('editor.disableStore') }}
          </label>
          <label class="claude-toggle">
            <button
              class="picker-check"
              :class="{ on: draft.remoteCompaction }"
              type="button"
              @click="patch({ remoteCompaction: !draft.remoteCompaction })"
            >
              <svg v-if="draft.remoteCompaction" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
              </svg>
            </button>
            {{ t('editor.remoteCompress') }}
          </label>
        </div>
        <p class="hint">{{ t('editor.remoteCompressHint') }}</p>
      </div>

      <div class="claude-block">
        <div class="header-section-head">
          <h3>{{ t('editor.modelMap') }}</h3>
          <div class="models-actions">
            <button class="btn btn-sm" type="button" @click="addCatalogRow">{{ t('editor.addModel') }}</button>
          </div>
        </div>
        <p class="hint">{{ t('editor.catalogHint') }}</p>
        <div class="agent-catalog-list">
          <AgentCatalogCard
            v-for="row in draft.catalog"
            :key="row.id"
            :open="!row.model"
            @remove="removeCatalogRow(row.id)"
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
                :options="MODALITIES"
                :labels="modalityLabels"
                :model-value="sanitizeModalities(row.input)"
                @toggle="(type, enabled) => toggleCatalogInput(row.id, type, enabled)"
              />
            </div>
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.thinking') }}</span>
              <OptionChips
                :options="CODEX_EFFORTS"
                :labels="effortLabels"
                :model-value="row.reasoningLevels"
                @toggle="(level, enabled) => toggleCatalogEffort(row.id, level, enabled)"
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
            {{ t('editor.codexHeaders') }}
            <router-link class="claude-link" to="/headers">{{ t('editor.managePresets') }}</router-link>
          </p>
        </HeaderPairsEditor>
      </div>

      <div class="claude-block">
        <PromptEditor
          :enabled="promptEnabled"
          :content="promptDraft"
          :label="t('editor.globalAgents')"
          @update:enabled="promptEnabled = $event"
          @update:content="setPromptDraft"
        />
      </div>

      <div class="claude-block">
        <PromptEditor
          :enabled="instructEnabled"
          :content="instructDraft"
          :label="t('editor.modelInstructions')"
          @update:enabled="instructEnabled = $event"
          @update:content="setInstructDraft"
        />
      </div>

      <div class="claude-save">
        <button class="btn btn-primary btn-save" type="button" :disabled="saving || !dirty" @click="save">
          {{ t('common.save') }}
        </button>
      </div>
    </template>
  </div>
</template>
