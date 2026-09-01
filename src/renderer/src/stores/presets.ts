import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  emptyHeaderEntry,
  emptyHeaderPreset,
  emptyPromptPreset,
  type HeaderEntry,
  type HeaderPreset,
  type PromptPreset
} from '@shared/presets'
import { t } from '@/i18n'
import { useToastStore } from './toasts'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function same<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function now(): string {
  return new Date().toISOString()
}

export const usePresetStore = defineStore('presets', () => {
  const promptPresets = ref<PromptPreset[]>([])
  const savedPrompts = ref<PromptPreset[]>([])
  const headerPresets = ref<HeaderPreset[]>([])
  const savedHeaders = ref<HeaderPreset[]>([])
  const hydrated = ref(false)
  const promptDirty = ref(false)
  const headerDirty = ref(false)
  const promptSaving = ref(false)
  const headerSaving = ref(false)
  let persistSkip = false

  const savedPromptPresets = computed(() => savedPrompts.value)
  const savedHeaderPresets = computed(() => savedHeaders.value)

  function getPrompt(id: string): PromptPreset | undefined {
    return promptPresets.value.find((item) => item.id === id)
  }

  function getHeader(id: string): HeaderPreset | undefined {
    return headerPresets.value.find((item) => item.id === id)
  }

  function syncPromptDirty(): void {
    if (!hydrated.value || persistSkip) return
    promptDirty.value = !same(promptPresets.value, savedPrompts.value)
  }

  function syncHeaderDirty(): void {
    if (!hydrated.value || persistSkip) return
    headerDirty.value = !same(headerPresets.value, savedHeaders.value)
  }

  function markPromptDirty(): void {
    if (!hydrated.value || persistSkip) return
    promptDirty.value = true
  }

  function markHeaderDirty(): void {
    if (!hydrated.value || persistSkip) return
    headerDirty.value = true
  }

  function touchPrompt(item: PromptPreset): void {
    item.updatedAt = now()
    markPromptDirty()
  }

  function touchHeader(item: HeaderPreset): void {
    item.updatedAt = now()
    markHeaderDirty()
  }

  async function hydrate(): Promise<void> {
    if (!window.hyper) {
      hydrated.value = true
      return
    }
    persistSkip = true
    const [prompts, headers] = await Promise.all([
      window.hyper.loadPromptPresets
        ? window.hyper.loadPromptPresets()
        : window.hyper.loadConfig().then((file) => file.promptPresets ?? []),
      window.hyper.loadHeaderPresets
        ? window.hyper.loadHeaderPresets()
        : window.hyper.loadConfig().then((file) => file.headerPresets ?? [])
    ])
    promptPresets.value = clone(prompts)
    savedPrompts.value = clone(prompts)
    headerPresets.value = clone(headers)
    savedHeaders.value = clone(headers)
    persistSkip = false
    promptDirty.value = false
    headerDirty.value = false
    hydrated.value = true
  }

  async function savePrompts(options?: { silent?: boolean }): Promise<void> {
    if (!window.hyper?.savePromptPresets) return
    promptSaving.value = true
    try {
      const snapshot = clone(promptPresets.value)
      await window.hyper.savePromptPresets(snapshot)
      savedPrompts.value = snapshot
      promptDirty.value = false
      if (!options?.silent) useToastStore().success(t('toast.saved'))
    } catch {
      if (!options?.silent) useToastStore().error(t('toast.saveFailed'))
    } finally {
      promptSaving.value = false
    }
  }

  async function saveHeaders(options?: { silent?: boolean }): Promise<void> {
    if (!window.hyper?.saveHeaderPresets) return
    headerSaving.value = true
    try {
      const snapshot = clone(headerPresets.value)
      await window.hyper.saveHeaderPresets(snapshot)
      savedHeaders.value = snapshot
      headerDirty.value = false
      if (!options?.silent) useToastStore().success(t('toast.saved'))
    } catch {
      if (!options?.silent) useToastStore().error(t('toast.saveFailed'))
    } finally {
      headerSaving.value = false
    }
  }

  function createPrompt(): PromptPreset {
    const item = emptyPromptPreset({ name: t('common.unnamed') })
    promptPresets.value.unshift(item)
    markPromptDirty()
    return item
  }

  function updatePrompt(id: string, patch: Partial<Omit<PromptPreset, 'id'>>): void {
    const item = getPrompt(id)
    if (!item) return
    Object.assign(item, patch)
    touchPrompt(item)
  }

  function removePrompt(id: string): void {
    promptPresets.value = promptPresets.value.filter((item) => item.id !== id)
    const existed = savedPrompts.value.some((item) => item.id === id)
    if (existed) {
      const snapshot = savedPrompts.value.filter((item) => item.id !== id)
      savedPrompts.value = snapshot
      void window.hyper?.savePromptPresets(snapshot)
    }
    syncPromptDirty()
  }

  function createHeader(): HeaderPreset {
    const item = emptyHeaderPreset({ name: t('common.unnamed') })
    headerPresets.value.unshift(item)
    markHeaderDirty()
    return item
  }

  function updateHeader(id: string, patch: Partial<Omit<HeaderPreset, 'id' | 'headers'>>): void {
    const item = getHeader(id)
    if (!item) return
    Object.assign(item, patch)
    touchHeader(item)
  }

  function removeHeader(id: string): void {
    headerPresets.value = headerPresets.value.filter((item) => item.id !== id)
    const existed = savedHeaders.value.some((item) => item.id === id)
    if (existed) {
      const snapshot = savedHeaders.value.filter((item) => item.id !== id)
      savedHeaders.value = snapshot
      void window.hyper?.saveHeaderPresets(snapshot)
    }
    syncHeaderDirty()
  }

  function addHeaderEntry(presetId: string): HeaderEntry | null {
    const item = getHeader(presetId)
    if (!item) return null
    const entry = emptyHeaderEntry()
    item.headers.push(entry)
    touchHeader(item)
    return entry
  }

  function updateHeaderEntry(
    presetId: string,
    entryId: string,
    patch: Partial<Omit<HeaderEntry, 'id'>>
  ): void {
    const item = getHeader(presetId)
    const entry = item?.headers.find((row) => row.id === entryId)
    if (!item || !entry) return
    Object.assign(entry, patch)
    touchHeader(item)
  }

  function removeHeaderEntry(presetId: string, entryId: string): void {
    const item = getHeader(presetId)
    if (!item) return
    item.headers = item.headers.filter((row) => row.id !== entryId)
    touchHeader(item)
  }

  return {
    promptPresets,
    savedPromptPresets,
    headerPresets,
    savedHeaderPresets,
    hydrated,
    promptDirty,
    headerDirty,
    promptSaving,
    headerSaving,
    hydrate,
    getPrompt,
    getHeader,
    savePrompts,
    saveHeaders,
    createPrompt,
    updatePrompt,
    removePrompt,
    createHeader,
    updateHeader,
    removeHeader,
    addHeaderEntry,
    updateHeaderEntry,
    removeHeaderEntry
  }
})
