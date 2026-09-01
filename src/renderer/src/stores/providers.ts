import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  capsFromCatalog,
  defaultModelDisplayName,
  emptyModel,
  emptyProvider,
  isProviderKey,
  type ModelConfig,
  type ProviderConfig
} from '@shared/provider'
import { t } from '@/i18n'
import { useCatalogStore } from './catalog'
import { useToastStore } from './toasts'

function now(): string {
  return new Date().toISOString()
}

function cloneProviders(list: ProviderConfig[]): ProviderConfig[] {
  return JSON.parse(JSON.stringify(list)) as ProviderConfig[]
}

function flattenModels(list: ProviderConfig[]) {
  return list.flatMap((provider) =>
    provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      providerFormat: provider.apiFormat,
      providerIcon: provider.icon,
      model
    }))
  )
}

function sameProviders(a: ProviderConfig[], b: ProviderConfig[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export const useProviderStore = defineStore('providers', () => {
  const providers = ref<ProviderConfig[]>([])
  const saved = ref<ProviderConfig[]>([])
  const hydrated = ref(false)
  const dirty = ref(false)
  const saving = ref(false)
  let persistSkip = false

  const modelCount = computed(() =>
    saved.value.reduce((sum, provider) => sum + provider.models.length, 0)
  )

  const allModels = computed(() => flattenModels(saved.value))
  const savedProviders = computed(() => saved.value)

  function getById(id: string): ProviderConfig | undefined {
    return providers.value.find((provider) => provider.id === id)
  }

  function syncDirty(): void {
    if (!hydrated.value || persistSkip) return
    dirty.value = !sameProviders(providers.value, saved.value)
  }

  function markDirty(): void {
    if (!hydrated.value || persistSkip) return
    dirty.value = true
  }

  async function writeConfig(
    list: ProviderConfig[],
    options?: { silent?: boolean }
  ): Promise<boolean> {
    if (!window.hyper) return false
    saving.value = true
    try {
      await window.hyper.saveConfig(list)
      if (!options?.silent) useToastStore().success(t('toast.saved'))
      return true
    } catch {
      if (!options?.silent) useToastStore().error(t('toast.saveFailed'))
      return false
    } finally {
      saving.value = false
    }
  }

  function slugConflict(slug: string, exceptId = ''): boolean {
    const key = slug.trim()
    return providers.value.some((item) => item.id !== exceptId && item.slug.trim() === key)
  }

  async function save(options?: { silent?: boolean }): Promise<void> {
    const snapshot = cloneProviders(providers.value)
    const seen = new Set<string>()
    for (const provider of snapshot) {
      const slug = provider.slug.trim()
      if (!slug) {
        useToastStore().error(t('providers.needSlug'))
        return
      }
      if (!isProviderKey(slug)) {
        useToastStore().error(t('providers.slugIllegal', { slug }))
        return
      }
      if (seen.has(slug)) {
        useToastStore().error(t('providers.slugDup', { slug }))
        return
      }
      seen.add(slug)
    }
    const ok = await writeConfig(snapshot, options)
    if (!ok) return
    saved.value = snapshot
    dirty.value = false
  }

  function touch(provider: ProviderConfig): void {
    provider.updatedAt = now()
    markDirty()
  }

  async function hydrate(): Promise<void> {
    if (!window.hyper) {
      hydrated.value = true
      return
    }
    persistSkip = true
    const list = window.hyper.loadProviders
      ? await window.hyper.loadProviders()
      : (await window.hyper.loadConfig()).providers
    providers.value = cloneProviders(list)
    saved.value = cloneProviders(list)
    persistSkip = false
    dirty.value = false
    hydrated.value = true
  }

  function createProvider(): ProviderConfig {
    const provider = emptyProvider({ name: t('common.unnamed') })
    providers.value.unshift(provider)
    markDirty()
    return provider
  }

  function updateProvider(id: string, patch: Partial<Omit<ProviderConfig, 'id' | 'models'>>): void {
    const provider = getById(id)
    if (!provider) return
    Object.assign(provider, patch)
    touch(provider)
  }

  function removeProvider(id: string): void {
    providers.value = providers.value.filter((provider) => provider.id !== id)
    const existed = saved.value.some((provider) => provider.id === id)
    if (existed) {
      const snapshot = saved.value.filter((provider) => provider.id !== id)
      saved.value = snapshot
      void writeConfig(snapshot, { silent: true })
    }
    syncDirty()
  }

  function addModel(providerId: string, partial?: Partial<ModelConfig>): ModelConfig | null {
    const provider = getById(providerId)
    if (!provider) return null
    if (partial?.id && provider.models.some((model) => model.id === partial.id)) {
      return provider.models.find((model) => model.id === partial.id) ?? null
    }
    const preset = partial?.id ? useCatalogStore().lookup(partial.id) : undefined
    const model = emptyModel({
      ...capsFromCatalog(preset),
      ...(preset ? { id: preset.id, name: preset.name } : {}),
      ...partial
    })
    if (!model.name) model.name = defaultModelDisplayName(model.id)
    provider.models.push(model)
    touch(provider)
    return model
  }

  function updateModel(
    providerId: string,
    key: string,
    patch: Partial<Omit<ModelConfig, 'key'>>
  ): void {
    const provider = getById(providerId)
    const model = provider?.models.find((item) => item.key === key)
    if (!provider || !model) return
    Object.assign(model, patch)
    touch(provider)
  }

  function removeModel(providerId: string, key: string): void {
    const provider = getById(providerId)
    if (!provider) return
    provider.models = provider.models.filter((model) => model.key !== key)
    touch(provider)
  }

  return {
    providers,
    savedProviders,
    hydrated,
    modelCount,
    allModels,
    getById,
    dirty,
    saving,
    hydrate,
    save,
    slugConflict,
    createProvider,
    updateProvider,
    removeProvider,
    addModel,
    updateModel,
    removeModel
  }
})
