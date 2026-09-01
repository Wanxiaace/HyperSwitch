import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emptyCatalog, lookupCatalogModel, type CatalogFile, type CatalogModel } from '@shared/catalog'
import { t } from '@/i18n'

export const useCatalogStore = defineStore('catalog', () => {
  const file = ref<CatalogFile>(emptyCatalog())
  const updating = ref(false)

  const count = computed(() => file.value.models.length)
  const updatedAt = computed(() => file.value.updatedAt)

  function lookup(id: string): CatalogModel | undefined {
    return lookupCatalogModel(file.value.models, id)
  }

  async function hydrate(): Promise<void> {
    if (!window.hyper?.loadCatalog) return
    file.value = await window.hyper.loadCatalog()
  }

  async function update(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
    if (!window.hyper?.updateCatalog) return { ok: false, error: t('catalog.unavailable') }
    updating.value = true
    try {
      const result = await window.hyper.updateCatalog()
      if (!result.ok) return result
      file.value = result.file
      return { ok: true, count: result.file.models.length }
    } finally {
      updating.value = false
    }
  }

  return { file, updating, count, updatedAt, lookup, hydrate, update }
})
