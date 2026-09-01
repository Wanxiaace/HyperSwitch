<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import HeaderPairsEditor from '@/components/HeaderPairsEditor.vue'
import ModelDropdown from '@/components/ModelDropdown.vue'
import PromptEditor from '@/components/PromptEditor.vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { fetchModelsErrorMessage } from '@/lib/format'
import { useProviderStore } from '@/stores/providers'
import { useI18nLabels } from '@/composables/useI18nLabels'
import { useToastStore } from '@/stores/toasts'
import { resolvePromptAction } from '@shared/agentPlugin'
import {
  emptyClaudeSettings,
  hasClaudeOneMMarker,
  setClaudeOneMMarker,
  stripClaudeOneMMarker,
  type ClaudeLoadResult,
  type ClaudeRoleConfig,
  type ClaudeSettingsView
} from '@shared/claudeSettings'
import { findProviderBySlug, type FetchedModel } from '@shared/provider'

const props = defineProps<{
  active: boolean
}>()

const toastStore = useToastStore()
const { t } = useI18nLabels()
const providerStore = useProviderStore()
const { savedProviders } = storeToRefs(providerStore)

const loading = ref(false)
const saving = ref(false)
const revealKey = ref(false)
const fetching = ref(false)
const providerId = ref('')
const promptDraft = ref('')
const savedPromptDraft = ref('')
const promptEnabled = ref(false)
const savedPromptEnabled = ref(false)
const bakExists = ref(false)
const draft = ref<ClaudeSettingsView>(emptyClaudeSettings())
const saved = ref<ClaudeSettingsView>(emptyClaudeSettings())
const fetchedModels = ref<FetchedModel[]>([])

const anthropicProviders = computed(() =>
  savedProviders.value.filter((provider) => provider.apiFormat === 'anthropic-messages')
)

const providerOptions = computed(() => [
  { value: '', label: t('editor.manualFill') },
  ...anthropicProviders.value
    .filter((provider) => provider.slug.trim())
    .map((provider) => ({
      value: provider.slug,
      label: provider.name
    }))
])

const authOptions = computed(() => [
  { value: 'ANTHROPIC_AUTH_TOKEN', label: t('editor.authDefault') },
  { value: 'ANTHROPIC_API_KEY', label: 'ANTHROPIC_API_KEY' }
])

const selectedProvider = computed(
  () => findProviderBySlug(anthropicProviders.value, providerId.value) ?? null
)

const modelChoices = computed(() => {
  const fromProvider = (selectedProvider.value?.models ?? [])
    .filter((model) => model.id.trim())
    .map((model) => ({ id: model.id, ownedBy: selectedProvider.value?.name ?? null }))
  const seen = new Set(fromProvider.map((model) => model.id))
  const extra = fetchedModels.value.filter((model) => !seen.has(model.id))
  return [...fromProvider, ...extra]
})

const dirty = computed(
  () =>
    JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
    promptEnabled.value !== savedPromptEnabled.value ||
    (promptEnabled.value && promptDraft.value !== savedPromptDraft.value)
)

type RoleKey = 'sonnet' | 'opus' | 'fable' | 'haiku'

const roles: { key: RoleKey; label: string; oneM: boolean }[] = [
  { key: 'sonnet', label: 'Sonnet', oneM: true },
  { key: 'opus', label: 'Opus', oneM: true },
  { key: 'fable', label: 'Fable', oneM: true },
  { key: 'haiku', label: 'Haiku', oneM: false }
]

function matchProvider(slug: string): string {
  return findProviderBySlug(anthropicProviders.value, slug)?.slug ?? ''
}

async function load(): Promise<void> {
  if (!window.hyper?.loadAgentSettings) return
  loading.value = true
  try {
    const file = (await window.hyper.loadAgentSettings('claude')) as ClaudeLoadResult
    draft.value = file.settings
    saved.value = JSON.parse(JSON.stringify(file.settings)) as ClaudeSettingsView
    providerId.value = matchProvider(file.settings.providerId)
    bakExists.value = file.prompt.bakExists
    promptEnabled.value = file.prompt.bakExists
    savedPromptEnabled.value = file.prompt.bakExists
    promptDraft.value = file.prompt.content
    savedPromptDraft.value = file.prompt.content
    fetchedModels.value = []
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('editor.readFailed', { name: 'Claude' }))
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

function applyProvider(id: string): void {
  providerId.value = id
  if (!id) {
    draft.value.providerId = ''
    return
  }
  const provider = findProviderBySlug(anthropicProviders.value, id)
  if (!provider) return
  const maxOutput = provider.models.reduce((best, model) => {
    const value = model.maxOutput ?? 0
    return value > best ? value : best
  }, 0)
  draft.value.providerId = provider.slug
  draft.value.baseUrl = provider.baseUrl
  draft.value.apiKey = provider.apiKey
  draft.value.maxOutputTokens = maxOutput > 0 ? String(maxOutput) : draft.value.maxOutputTokens
}

function setAuthField(value: string): void {
  patch({
    authField: value === 'ANTHROPIC_API_KEY' ? 'ANTHROPIC_API_KEY' : 'ANTHROPIC_AUTH_TOKEN'
  })
}

function setPromptDraft(content: string): void {
  promptDraft.value = content
}

function patch(partial: Partial<ClaudeSettingsView>): void {
  draft.value = { ...draft.value, ...partial }
}

function patchRole(key: RoleKey, partial: Partial<ClaudeRoleConfig>): void {
  const current = draft.value[key]
  const next = { ...current, ...partial }
  if (partial.model !== undefined) {
    const oldBase = stripClaudeOneMMarker(current.model).trim()
    const nextBase = stripClaudeOneMMarker(next.model).trim()
    if (!current.name.trim() || current.name.trim() === oldBase) {
      next.name = nextBase
    }
  }
  draft.value = { ...draft.value, [key]: next }
}

function setRoleModel(key: RoleKey, value: string, allowOneM: boolean): void {
  const current = draft.value[key]
  const enabled = allowOneM && hasClaudeOneMMarker(current.model)
  patchRole(key, { model: allowOneM ? setClaudeOneMMarker(value, enabled) : stripClaudeOneMMarker(value) })
}

function setRoleOneM(key: RoleKey, enabled: boolean): void {
  patchRole(key, { model: setClaudeOneMMarker(draft.value[key].model, enabled) })
}

function setFallback(value: string): void {
  const enabled = hasClaudeOneMMarker(draft.value.fallbackModel)
  patch({ fallbackModel: setClaudeOneMMarker(value, enabled) })
}

function setSubagent(value: string): void {
  const enabled = hasClaudeOneMMarker(draft.value.subagentModel)
  patch({ subagentModel: setClaudeOneMMarker(value, enabled) })
}

function quickSet(): void {
  const source =
    draft.value.fallbackModel ||
    draft.value.sonnet.model ||
    draft.value.opus.model ||
    draft.value.fable.model ||
    draft.value.haiku.model ||
    draft.value.subagentModel
  if (!source.trim()) return
  const named = stripClaudeOneMMarker(source).trim()
  draft.value = {
    ...draft.value,
    sonnet: { model: source, name: named },
    opus: { model: source, name: named },
    fable: { model: source, name: named },
    haiku: { model: stripClaudeOneMMarker(source), name: named },
    subagentModel: source
  }
  toastStore.success(t('editor.applyNames'))
}

async function fetchRemote(): Promise<void> {
  if (!draft.value.baseUrl.trim()) {
    toastStore.error(t('providers.emptyBaseUrl'))
    return
  }
  if (!draft.value.apiKey.trim()) {
    toastStore.error(t('providers.emptyApiKey'))
    return
  }
  fetching.value = true
  try {
    const result = await window.hyper.fetchModels({
      baseUrl: draft.value.baseUrl,
      apiKey: draft.value.apiKey,
      apiFormat: 'anthropic-messages'
    })
    if (!result.ok) {
      fetchedModels.value = []
      toastStore.error(fetchModelsErrorMessage(result.error))
      return
    }
    fetchedModels.value = result.models
    if (result.models.length === 0) toastStore.error(t('providers.noFetched'))
    else toastStore.success(t('providers.fetched', { count: result.models.length }))
  } finally {
    fetching.value = false
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function save(): Promise<void> {
  if (!window.hyper?.saveAgentSettings) return
  saving.value = true
  try {
    const prompt = resolvePromptAction(
      promptEnabled.value,
      bakExists.value,
      promptDraft.value,
      savedPromptDraft.value
    )
    const snapshot = cloneJson(draft.value)
    await window.hyper.saveAgentSettings('claude', {
      settings: snapshot,
      prompt
    })
    saved.value = snapshot
    savedPromptDraft.value = promptDraft.value
    savedPromptEnabled.value = promptEnabled.value
    bakExists.value = prompt.mode === 'preset' ? true : prompt.mode === 'none' ? false : bakExists.value
    toastStore.success(t('editor.wrote', { name: 'Claude Code' }))
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('toast.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="claude-editor">
    <p v-if="loading" class="hint">{{ t('editor.reading', { path: '~/.claude/settings.json' }) }}</p>
    <template v-else>
      <div class="claude-block">
        <label class="field">
          <span class="field-label">{{ t('editor.provider') }}</span>
          <SelectMenu :model-value="providerId" :options="providerOptions" @update:model-value="applyProvider" />
        </label>
        <p class="hint">
          {{
            anthropicProviders.length
              ? t('editor.claudeProviderHint')
              : t('editor.claudeNoProvider')
          }}
        </p>
        <label class="field">
          <span class="field-label">{{ t('editor.authField') }}</span>
          <SelectMenu
            :model-value="draft.authField"
            :options="authOptions"
            @update:model-value="setAuthField"
          />
        </label>
        <p class="hint">{{ t('editor.authHint') }}</p>
        <label class="field">
          <span class="field-label">Base URL</span>
          <input
            :value="draft.baseUrl"
            placeholder="https://api.anthropic.com"
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
          <span class="field-label">{{ t('editor.maxOutput') }}</span>
          <input
            :value="draft.maxOutputTokens"
            type="number"
            min="1"
            :placeholder="t('editor.maxOutputPh')"
            @input="patch({ maxOutputTokens: ($event.target as HTMLInputElement).value.replace(/[^\d]/g, '') })"
          />
        </label>
        <p class="hint">{{ t('editor.maxOutputHint') }}</p>
      </div>

      <div class="claude-block">
        <div class="header-section-head">
          <h3>{{ t('editor.modelMap') }}</h3>
          <div class="models-actions">
            <button class="btn btn-sm" type="button" @click="quickSet">{{ t('editor.oneClick') }}</button>
            <button class="btn btn-sm" type="button" :disabled="fetching" @click="fetchRemote">
              {{ fetching ? t('providers.fetching') : t('providers.fetch') }}
            </button>
          </div>
        </div>
        <p class="hint">{{ t('editor.claudeModelsHint') }}</p>
        <div class="claude-role-cols">
          <span>{{ t('editor.role') }}</span>
          <span>{{ t('editor.displayName') }}</span>
          <span>{{ t('editor.requestModel') }}</span>
          <span>1M</span>
        </div>
        <div v-for="role in roles" :key="role.key" class="claude-role-row">
          <div class="claude-role-name">{{ role.label }}</div>
          <input
            :value="draft[role.key].name"
            :placeholder="t('editor.displayNamePh')"
            @input="patchRole(role.key, { name: ($event.target as HTMLInputElement).value })"
          />
          <div class="cc-model-id">
            <input
              :value="stripClaudeOneMMarker(draft[role.key].model)"
              placeholder="model-id"
              @input="setRoleModel(role.key, ($event.target as HTMLInputElement).value, role.oneM)"
            />
            <ModelDropdown
              v-if="modelChoices.length > 0"
              :models="modelChoices"
              @select="setRoleModel(role.key, $event, role.oneM)"
            />
          </div>
          <label v-if="role.oneM" class="claude-onem">
            <button
              class="picker-check"
              :class="{ on: hasClaudeOneMMarker(draft[role.key].model) }"
              type="button"
              @click="setRoleOneM(role.key, !hasClaudeOneMMarker(draft[role.key].model))"
            >
              <svg
                v-if="hasClaudeOneMMarker(draft[role.key].model)"
                viewBox="0 0 16 16"
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
              </svg>
            </button>
            1M
          </label>
          <span v-else class="claude-onem mute">—</span>
        </div>
        <div class="claude-role-row">
          <div class="claude-role-name">Subagent</div>
          <div class="claude-role-static">{{ t('editor.notInMenu') }}</div>
          <div class="cc-model-id">
            <input
              :value="stripClaudeOneMMarker(draft.subagentModel)"
              placeholder="model-id"
              @input="setSubagent(($event.target as HTMLInputElement).value)"
            />
            <ModelDropdown
              v-if="modelChoices.length > 0"
              :models="modelChoices"
              @select="setSubagent"
            />
          </div>
          <label class="claude-onem">
            <button
              class="picker-check"
              :class="{ on: hasClaudeOneMMarker(draft.subagentModel) }"
              type="button"
              @click="patch({ subagentModel: setClaudeOneMMarker(draft.subagentModel, !hasClaudeOneMMarker(draft.subagentModel)) })"
            >
              <svg
                v-if="hasClaudeOneMMarker(draft.subagentModel)"
                viewBox="0 0 16 16"
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
              </svg>
            </button>
            1M
          </label>
        </div>
        <label class="field" style="margin-top: 12px">
          <span class="field-label">{{ t('editor.fallback') }}</span>
          <div class="claude-fallback">
            <div class="cc-model-id">
              <input
                :value="stripClaudeOneMMarker(draft.fallbackModel)"
                placeholder="model-id"
                @input="setFallback(($event.target as HTMLInputElement).value)"
              />
              <ModelDropdown
                v-if="modelChoices.length > 0"
                :models="modelChoices"
                @select="setFallback"
              />
            </div>
            <label class="claude-onem">
              <button
                class="picker-check"
                :class="{ on: hasClaudeOneMMarker(draft.fallbackModel) }"
                type="button"
                @click="patch({ fallbackModel: setClaudeOneMMarker(draft.fallbackModel, !hasClaudeOneMMarker(draft.fallbackModel)) })"
              >
                <svg
                  v-if="hasClaudeOneMMarker(draft.fallbackModel)"
                  viewBox="0 0 16 16"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
                </svg>
              </button>
              1M
            </label>
          </div>
        </label>
        <p class="hint">
          {{ t('editor.fallbackHint') }}
        </p>
      </div>

      <div class="claude-block">
        <HeaderPairsEditor
          :model-value="draft.customHeaders"
          @update:model-value="patch({ customHeaders: $event })"
        >
          <p class="hint">
            {{ t('editor.claudeHeaders') }}
            <router-link class="claude-link" to="/headers">{{ t('editor.managePresets') }}</router-link>
          </p>
        </HeaderPairsEditor>
      </div>

      <div class="claude-block">
        <PromptEditor
          :enabled="promptEnabled"
          :content="promptDraft"
          :label="t('editor.systemPrompt')"
          @update:enabled="promptEnabled = $event"
          @update:content="setPromptDraft"
        />
      </div>

      <div class="claude-toggles">
        <label class="claude-toggle">
          <button
            class="picker-check"
            :class="{ on: draft.hideAttribution }"
            type="button"
            @click="patch({ hideAttribution: !draft.hideAttribution })"
          >
            <svg v-if="draft.hideAttribution" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
            </svg>
          </button>
          {{ t('editor.hideByline') }}
        </label>
        <label class="claude-toggle">
          <button
            class="picker-check"
            :class="{ on: draft.teammates }"
            type="button"
            @click="patch({ teammates: !draft.teammates })"
          >
            <svg v-if="draft.teammates" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
            </svg>
          </button>
          {{ t('editor.teammates') }}
        </label>
        <label class="claude-toggle">
          <button
            class="picker-check"
            :class="{ on: draft.enableToolSearch }"
            type="button"
            @click="patch({ enableToolSearch: !draft.enableToolSearch })"
          >
            <svg v-if="draft.enableToolSearch" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
            </svg>
          </button>
          {{ t('editor.toolSearch') }}
        </label>
        <label class="claude-toggle">
          <button
            class="picker-check"
            :class="{ on: draft.effortMax }"
            type="button"
            @click="patch({ effortMax: !draft.effortMax })"
          >
            <svg v-if="draft.effortMax" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
            </svg>
          </button>
          {{ t('editor.maxThinking') }}
        </label>
        <label class="claude-toggle">
          <button
            class="picker-check"
            :class="{ on: draft.disableAutoUpgrade }"
            type="button"
            @click="patch({ disableAutoUpgrade: !draft.disableAutoUpgrade })"
          >
            <svg v-if="draft.disableAutoUpgrade" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
            </svg>
          </button>
          {{ t('editor.disableUpgrade') }}
        </label>
      </div>

      <div class="claude-save">
        <button class="btn btn-primary btn-save" type="button" :disabled="saving || !dirty" @click="save">
          {{ t('common.save') }}
        </button>
      </div>
    </template>
  </div>
</template>
