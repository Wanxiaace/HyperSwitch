import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { resolvePromptAction, type AgentPromptAction } from '@shared/agentPlugin'
import type { ApiFormat, ProviderConfig, ThinkingLevel } from '@shared/provider'
import { findProviderBySlug, THINKING_LEVELS } from '@shared/provider'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'

export function useAgentForm(options: {
  formats?: ApiFormat[]
} = {}) {
  const toastStore = useToastStore()
  const { t } = useLocaleStore()
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

  const filteredProviders = computed(() => {
    if (!options.formats) return savedProviders.value
    return savedProviders.value.filter((provider) => options.formats?.includes(provider.apiFormat))
  })

  const providerOptions = computed(() => [
    { value: '', label: t('editor.manualFill') },
    ...filteredProviders.value
      .filter((provider) => provider.slug.trim())
      .map((provider) => ({
        value: provider.slug,
        label: provider.name
      }))
  ])

  const selectedProvider = computed(
    () => findProviderBySlug(filteredProviders.value, providerId.value) ?? null
  )

  const providerModels = computed(() => collectModels(selectedProvider.value, filteredProviders.value))

  function matchProvider(slug: string): string {
    return findProviderBySlug(filteredProviders.value, slug)?.slug ?? ''
  }

  function setPromptDraft(content: string): void {
    promptDraft.value = content
  }

  function setPromptEnabled(enabled: boolean): void {
    promptEnabled.value = enabled
  }

  function modelSelectOptions(current: string): { value: string; label: string }[] {
    const list: { value: string; label: string }[] = []
    const seen = new Set<string>()
    if (!current) {
      list.push({ value: '', label: t('tools.pickGeneric') })
      seen.add('')
    }
    const add = (id: string, name = ''): void => {
      if (!id || seen.has(id)) return
      seen.add(id)
      list.push({ value: id, label: name && name !== id ? `${name} · ${id}` : id })
    }
    if (current) add(current, providerModels.value.find((model) => model.id === current)?.name ?? '')
    for (const model of providerModels.value) add(model.id, model.name)
    return list
  }

  const modelChoices = computed(() =>
    providerModels.value.map((model) => ({
      id: model.id,
      ownedBy: selectedProvider.value?.name || model.name || null
    }))
  )

  function thinkingOptions(_levels: string[], current = ''): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [
      { value: '', label: t('thinking.off') },
      ...THINKING_LEVELS.filter((level) => level !== 'off').map((level) => ({
        value: level,
        label: t(`thinking.${level}`)
      }))
    ]
    if (current && !options.some((item) => item.value === current)) {
      options.splice(1, 0, {
        value: current,
        label: (THINKING_LEVELS as readonly string[]).includes(current)
          ? t(`thinking.${current}`)
          : current
      })
    }
    return options
  }

  function pickThinking(levels: string[], current = ''): string {
    const supported = levels.filter((level) => level && level !== 'off')
    if (supported.length === 0) return ''
    if (current && supported.includes(current)) return current
    return supported.at(-1) ?? 'off'
  }

  function promptAction(): AgentPromptAction {
    return resolvePromptAction(
      promptEnabled.value,
      bakExists.value,
      promptDraft.value,
      savedPromptDraft.value
    )
  }

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  return {
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
    modelSelectOptions,
    thinkingOptions,
    pickThinking,
    promptAction,
    cloneJson
  }
}

function collectModels(
  selected: ProviderConfig | null,
  all: ProviderConfig[]
): { id: string; name: string; thinkingLevels: ThinkingLevel[]; contextWindow: number | null; maxOutput: number | null; input: string[] }[] {
  const list = selected ? selected.models : all.flatMap((provider) => provider.models)
  const seen = new Set<string>()
  const models: {
    id: string
    name: string
    thinkingLevels: ThinkingLevel[]
    contextWindow: number | null
    maxOutput: number | null
    input: string[]
  }[] = []
  for (const model of list) {
    const id = model.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      name: model.name.trim(),
      thinkingLevels: model.thinkingLevels,
      contextWindow: model.contextWindow,
      maxOutput: model.maxOutput,
      input: model.input
    })
  }
  return models
}
