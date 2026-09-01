<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AgentCatalogCard from '@/components/AgentCatalogCard.vue'
import HeaderPairsEditor from '@/components/HeaderPairsEditor.vue'
import ModelIdField from '@/components/ModelIdField.vue'
import OptionChips from '@/components/OptionChips.vue'
import PromptEditor from '@/components/PromptEditor.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { useAgentForm } from '@/composables/useAgentForm'
import { useI18nLabels } from '@/composables/useI18nLabels'
import { useProviderStore } from '@/stores/providers'
import {
  assertZcodeSave,
  emptyZcodeModelRow,
  emptyZcodeProvider,
  emptyZcodeSettings,
  isZcodeApi,
  isZcodeEditableKey,
  isZcodeKind,
  kindFromFormat,
  ZCODE_APIS,
  ZCODE_KIND_LABELS,
  ZCODE_KINDS,
  type ZcodeLoadResult,
  type ZcodeModelRow,
  type ZcodeProviderView,
  type ZcodeSettingsView
} from '@shared/zcodeSettings'
import {
  API_FORMAT_LABELS,
  defaultModelDisplayName,
  findProviderBySlug,
  isProviderKey,
  MODALITIES,
  sanitizeModalities,
  THINKING_LEVELS,
  toggleModality,
  toggleThinkingLevel,
  type FetchedModel,
  type Modality,
  type ProviderConfig,
  type ThinkingLevel
} from '@shared/provider'

const props = defineProps<{
  active: boolean
}>()

const providerStore = useProviderStore()
const { savedProviders } = storeToRefs(providerStore)
const {
  toastStore,
  loading,
  saving,
  promptDraft,
  savedPromptDraft,
  promptEnabled,
  savedPromptEnabled,
  bakExists,
  setPromptDraft,
  setPromptEnabled,
  promptAction,
  cloneJson
} = useAgentForm({
  formats: [...ZCODE_APIS]
})
const { t, modalityLabels, thinkingLabels } = useI18nLabels()

const draft = ref<ZcodeSettingsView>(emptyZcodeSettings())
const saved = ref<ZcodeSettingsView>(emptyZcodeSettings())
const expanded = ref('')
const revealKeys = ref<Record<string, boolean>>({})
const picking = ref(false)
const pickingHsId = ref('')
const kindOptions = ZCODE_KINDS.map((value) => ({ value, label: ZCODE_KIND_LABELS[value] }))

const dirty = computed(
  () =>
    JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
    promptEnabled.value !== savedPromptEnabled.value ||
    (promptEnabled.value && promptDraft.value !== savedPromptDraft.value)
)

const unusedProviders = computed(() => {
  const used = new Set(draft.value.providers.map((item) => item.key.trim()).filter(Boolean))
  return savedProviders.value.filter((provider) => {
    const slug = provider.slug.trim()
    return slug && isProviderKey(slug) && isZcodeApi(provider.apiFormat) && !used.has(slug)
  })
})

function patch(partial: Partial<ZcodeSettingsView>): void {
  draft.value = { ...draft.value, ...partial }
}

function patchProvider(id: string, partial: Partial<ZcodeProviderView>): void {
  patch({
    providers: draft.value.providers.map((item) => (item.id === id ? { ...item, ...partial } : item))
  })
}

function matchSource(key: string): ProviderConfig | null {
  return findProviderBySlug(savedProviders.value, key) ?? null
}

function capsFor(hs: ProviderConfig | null, modelId: string) {
  const fromProvider = hs?.models.find((model) => model.id === modelId)
  return {
    displayName: fromProvider?.name || defaultModelDisplayName(modelId) || modelId,
    contextWindow: fromProvider?.contextWindow ? String(fromProvider.contextWindow) : '',
    maxOutput: fromProvider?.maxOutput ? String(fromProvider.maxOutput) : '',
    thinkingLevels: (fromProvider?.thinkingLevels ?? []).filter((level) => level !== 'off'),
    input: fromProvider?.input ?? ['text'],
    output: fromProvider?.output ?? ['text']
  }
}

function modelChoicesFor(provider: ZcodeProviderView): FetchedModel[] {
  const hs = matchSource(provider.key)
  const seen = new Set<string>()
  const options: FetchedModel[] = []
  const add = (id: string, ownedBy: string | null): void => {
    const modelId = id.trim()
    if (!modelId || seen.has(modelId)) return
    seen.add(modelId)
    options.push({ id: modelId, ownedBy })
  }
  for (const model of hs?.models ?? []) add(model.id, hs?.name ?? model.name)
  for (const model of provider.models) add(model.model, model.displayName || provider.name || null)
  return options
}

function fromHyperSwitch(hs: ProviderConfig): ZcodeProviderView {
  const key = hs.slug.trim()
  return emptyZcodeProvider({
    key,
    originalKey: '',
    name: hs.name,
    kind: kindFromFormat(hs.apiFormat),
    apiKey: hs.apiKey,
    baseUrl: hs.baseUrl,
    models: hs.models
      .filter((model) => model.id.trim())
      .map((model) => {
        const caps = capsFor(hs, model.id)
        return emptyZcodeModelRow({
          model: model.id,
          displayName: caps.displayName,
          contextWindow: caps.contextWindow,
          maxOutput: caps.maxOutput,
          thinkingLevels: caps.thinkingLevels,
          input: caps.input,
          output: caps.output
        })
      })
  })
}

function openAddPicker(): void {
  if (unusedProviders.value.length === 0) {
    toastStore.error(
      savedProviders.value.length === 0
        ? t('editor.noSaved')
        : t('editor.allAdded')
    )
    return
  }
  pickingHsId.value = ''
  picking.value = true
}

function confirmImport(): void {
  const hs = findProviderBySlug(savedProviders.value, pickingHsId.value)
  if (!hs) {
    toastStore.error(t('editor.pickFirst'))
    return
  }
  const next = fromHyperSwitch(hs)
  const key = next.key
  if (!isZcodeEditableKey(key, next.originalKey)) {
    toastStore.error(t('editor.invalidSlug'))
    return
  }
  if (draft.value.providers.some((item) => item.key.trim() === key)) {
    toastStore.error(t('editor.slugExists', { slug: key }))
    return
  }
  expanded.value = next.id
  picking.value = false
  pickingHsId.value = ''
  patch({ providers: [...draft.value.providers, next] })
}

function providerTitle(provider: ZcodeProviderView): string {
  return matchSource(provider.key)?.name || provider.key
}

function removeProvider(id: string): void {
  const providers = draft.value.providers.filter((item) => item.id !== id)
  if (expanded.value === id) expanded.value = providers[0]?.id ?? ''
  patch({ providers })
}

function addModel(providerId: string): void {
  const provider = draft.value.providers.find((item) => item.id === providerId)
  if (!provider) return
  const hs = matchSource(provider.key)
  const used = new Set(provider.models.map((row) => row.model))
  const nextHs = hs?.models.find((model) => model.id.trim() && !used.has(model.id))
  if (nextHs) {
    const caps = capsFor(hs, nextHs.id)
    patchProvider(providerId, {
      models: [
        ...provider.models,
        emptyZcodeModelRow({
          model: nextHs.id,
          displayName: caps.displayName,
          contextWindow: caps.contextWindow,
          maxOutput: caps.maxOutput,
          thinkingLevels: caps.thinkingLevels,
          input: caps.input,
          output: caps.output
        })
      ]
    })
    return
  }
  patchProvider(providerId, { models: [...provider.models, emptyZcodeModelRow()] })
}

function typeModel(providerId: string, rowId: string, modelId: string): void {
  updateModel(providerId, rowId, { model: modelId })
}

function setModel(providerId: string, rowId: string, modelId: string): void {
  const provider = draft.value.providers.find((item) => item.id === providerId)
  if (!provider) return
  const hs = matchSource(provider.key)
  const caps = capsFor(hs, modelId)
  const fromPreset = Boolean(hs?.models.some((model) => model.id === modelId))
  patchProvider(providerId, {
    models: provider.models.map((row) =>
      row.id === rowId
        ? {
            ...row,
            model: modelId,
            displayName: caps.displayName,
            ...(fromPreset
              ? {
                  contextWindow: caps.contextWindow,
                  maxOutput: caps.maxOutput,
                  thinkingLevels: caps.thinkingLevels,
                  input: caps.input,
                  output: caps.output
                }
              : {})
          }
        : row
    )
  })
}

function updateModel(providerId: string, rowId: string, partial: Partial<ZcodeModelRow>): void {
  const provider = draft.value.providers.find((item) => item.id === providerId)
  if (!provider) return
  patchProvider(providerId, {
    models: provider.models.map((row) => (row.id === rowId ? { ...row, ...partial } : row))
  })
}

function setModelNumber(
  providerId: string,
  rowId: string,
  field: 'contextWindow' | 'maxOutput',
  raw: string
): void {
  updateModel(providerId, rowId, { [field]: raw.replace(/[^\d]/g, '') })
}

function toggleModelModality(
  providerId: string,
  rowId: string,
  field: 'input' | 'output',
  type: Modality,
  enabled: boolean
): void {
  const provider = draft.value.providers.find((item) => item.id === providerId)
  const row = provider?.models.find((item) => item.id === rowId)
  if (!row) return
  const current = sanitizeModalities(row[field])
  if (current.includes(type) === enabled) return
  updateModel(providerId, rowId, { [field]: toggleModality(current, type) })
}

function toggleModelThinking(providerId: string, rowId: string, level: ThinkingLevel, enabled: boolean): void {
  const provider = draft.value.providers.find((item) => item.id === providerId)
  const row = provider?.models.find((item) => item.id === rowId)
  if (!row) return
  const current = row.thinkingLevels.filter((item): item is ThinkingLevel =>
    (THINKING_LEVELS as readonly string[]).includes(item)
  )
  if (current.includes(level) === enabled) return
  updateModel(providerId, rowId, { thinkingLevels: toggleThinkingLevel(current, level) })
}

function modelThinking(row: ZcodeModelRow): ThinkingLevel[] {
  return row.thinkingLevels.filter((item): item is ThinkingLevel =>
    (THINKING_LEVELS as readonly string[]).includes(item)
  )
}

async function load(): Promise<void> {
  if (!window.hyper?.loadAgentSettings) return
  loading.value = true
  try {
    const file = (await window.hyper.loadAgentSettings('zcode')) as ZcodeLoadResult
    draft.value = file.settings
    saved.value = cloneJson(file.settings)
    expanded.value = file.settings.providers[0]?.id ?? ''
    bakExists.value = file.prompt.bakExists
    promptEnabled.value = file.prompt.bakExists
    savedPromptEnabled.value = file.prompt.bakExists
    promptDraft.value = file.prompt.content
    savedPromptDraft.value = file.prompt.content
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.readFailed', { name: 'ZCode' }))
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
  const snapshot = cloneJson(draft.value)
  try {
    assertZcodeSave(snapshot)
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.incomplete'))
    return
  }
  saving.value = true
  try {
    const prompt = promptAction()
    await window.hyper.saveAgentSettings('zcode', { settings: snapshot, prompt })
    saved.value = snapshot
    savedPromptDraft.value = promptDraft.value
    savedPromptEnabled.value = promptEnabled.value
    bakExists.value = prompt.mode === 'preset' ? true : prompt.mode === 'none' ? false : bakExists.value
    toastStore.success(t('editor.wrote', { name: 'ZCode' }))
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('toast.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="claude-editor">
    <p v-if="loading" class="hint">{{ t('editor.reading', { path: '~/.zcode/v2/config.json' }) }}</p>
    <template v-else>
      <div class="claude-block">
        <div class="header-section-head">
          <h3>{{ t('nav.providers') }}</h3>
          <div class="models-actions">
            <button class="btn btn-sm" type="button" @click="openAddPicker">{{ t('editor.addProvider') }}</button>
          </div>
        </div>
        <p class="hint">{{ t('editor.builtinsKept') }}</p>
        <div v-if="draft.providers.length === 0" class="hint">{{ t('editor.emptyCustom') }}</div>

        <div class="oc-provider-list">
          <article v-for="provider in draft.providers" :key="provider.id" class="oc-provider">
            <div class="oc-provider-head">
              <button
                class="oc-provider-toggle"
                type="button"
                @click="expanded = expanded === provider.id ? '' : provider.id"
              >
                <svg
                  class="collapse-arrow"
                  :class="{ open: expanded === provider.id }"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
                <span class="oc-provider-title">{{ providerTitle(provider) }}</span>
                <span class="oc-provider-meta">
                  {{ provider.baseUrl || t('providers.noBaseUrl') }} · {{ t('providers.modelCount', { count: provider.models.length }) }}
                </span>
              </button>
              <button class="card-delete" type="button" :title="t('providers.deleteProvider')" @click="removeProvider(provider.id)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 7l.5 6h4l.5-6" />
                </svg>
              </button>
            </div>

            <div v-if="expanded === provider.id" class="oc-provider-body">
              <label class="field">
                <span class="field-label">{{ t('editor.protocol') }}</span>
                <SelectMenu
                  :model-value="provider.kind"
                  :options="[...kindOptions]"
                  @update:model-value="
                    patchProvider(provider.id, { kind: isZcodeKind($event) ? $event : provider.kind })
                  "
                />
              </label>
              <label class="field">
                <span class="field-label">Base URL</span>
                <input
                  :value="provider.baseUrl"
                  placeholder="https://api.example.com/v1"
                  @input="patchProvider(provider.id, { baseUrl: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field">
                <span class="field-label">API Key</span>
                <span class="key-row">
                  <input
                    :type="revealKeys[provider.id] ? 'text' : 'password'"
                    :value="provider.apiKey"
                    autocomplete="off"
                    @input="patchProvider(provider.id, { apiKey: ($event.target as HTMLInputElement).value })"
                  />
                  <button
                    class="btn"
                    type="button"
                    @click="revealKeys = { ...revealKeys, [provider.id]: !revealKeys[provider.id] }"
                  >
                    {{ revealKeys[provider.id] ? t('common.hide') : t('common.show') }}
                  </button>
                </span>
              </label>
              <HeaderPairsEditor
                :model-value="provider.customHeaders"
                @update:model-value="patchProvider(provider.id, { customHeaders: $event })"
              />

              <div class="header-section-head">
                <h3>{{ t('editor.models') }}</h3>
                <button class="btn btn-sm" type="button" @click="addModel(provider.id)">{{ t('editor.addModel') }}</button>
              </div>
              <div class="agent-catalog-list">
                <AgentCatalogCard
                  v-for="row in provider.models"
                  :key="row.id"
                  :open="!row.model"
                  @remove="
                    patchProvider(provider.id, { models: provider.models.filter((item) => item.id !== row.id) })
                  "
                >
                  <template #head>
                    <input
                      :value="row.displayName"
                      :placeholder="t('editor.displayName')"
                      @input="updateModel(provider.id, row.id, { displayName: ($event.target as HTMLInputElement).value })"
                    />
                    <ModelIdField
                      :model-value="row.model"
                      :models="modelChoicesFor(provider)"
                      :placeholder="t('editor.requestModel')"
                      @update:model-value="typeModel(provider.id, row.id, $event)"
                      @select="setModel(provider.id, row.id, $event)"
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
                        @input="setModelNumber(provider.id, row.id, 'contextWindow', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                    <label class="field">
                      <span class="field-label">{{ t('editor.maxOutput') }}</span>
                      <input
                        :value="row.maxOutput"
                        type="number"
                        min="1"
                        placeholder="32768"
                        @input="setModelNumber(provider.id, row.id, 'maxOutput', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                  </div>
                  <div class="capability-row">
                    <span class="capability-label">{{ t('caps.input') }}</span>
                    <OptionChips
                      :options="MODALITIES"
                      :labels="modalityLabels"
                      :model-value="row.input"
                      @toggle="(type, enabled) => toggleModelModality(provider.id, row.id, 'input', type, enabled)"
                    />
                  </div>
                  <div class="capability-row">
                    <span class="capability-label">{{ t('caps.output') }}</span>
                    <OptionChips
                      :options="MODALITIES"
                      :labels="modalityLabels"
                      :model-value="row.output"
                      @toggle="(type, enabled) => toggleModelModality(provider.id, row.id, 'output', type, enabled)"
                    />
                  </div>
                  <div class="capability-row">
                    <span class="capability-label">{{ t('caps.thinking') }}</span>
                    <OptionChips
                      :options="THINKING_LEVELS"
                      :labels="thinkingLabels"
                      :model-value="modelThinking(row)"
                      @toggle="(level, enabled) => toggleModelThinking(provider.id, row.id, level, enabled)"
                    />
                  </div>
                </AgentCatalogCard>
              </div>
            </div>
          </article>
        </div>
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

    <Teleport to="body">
      <Transition name="batch">
        <div v-if="picking" class="picker-overlay" @click="picking = false">
          <section class="picker-panel" @click.stop>
            <header class="picker-head">
              <div class="picker-title">{{ t('editor.addProvider') }}</div>
              <button class="btn btn-sm" type="button" @click="picking = false">{{ t('common.close') }}</button>
            </header>
            <div class="picker-body">
              <button
                v-for="provider in unusedProviders"
                :key="provider.slug || provider.id"
                class="picker-row"
                :class="{ on: pickingHsId === provider.slug }"
                type="button"
                @click="pickingHsId = provider.slug"
              >
                <ProviderIcon :icon="provider.icon" :name="provider.name" :size="22" />
                <div class="picker-row-copy">
                  <div class="picker-row-name">{{ provider.name }}</div>
                  <div class="picker-row-id">
                    {{ provider.slug }} · {{ API_FORMAT_LABELS[provider.apiFormat] }} ·
                    {{ provider.baseUrl || t('providers.noBaseUrl') }}
                  </div>
                </div>
              </button>
            </div>
            <footer class="picker-foot">
              <button class="btn btn-primary" type="button" :disabled="!pickingHsId" @click="confirmImport">
                {{ t('common.add') }}
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
