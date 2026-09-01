<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import CapabilityBadges from '@/components/CapabilityBadges.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { guessModelIcon } from '@/icons/guess'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'
import {
  defaultModelDisplayName,
  type FetchedModel,
  type Modality,
  type ThinkingLevel
} from '@shared/provider'

const props = defineProps<{
  open: boolean
  providerId: string
  providerName: string
  fetchedModels: FetchedModel[]
  fetching: boolean
  fetchError: boolean
  fetchMessage: string
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

type FilterKey = 'all' | 'text' | 'image' | 'audio' | 'video'

const catalogStore = useCatalogStore()
const providerStore = useProviderStore()
const toastStore = useToastStore()
const { t } = useLocaleStore()
const query = ref('')
const filter = ref<FilterKey>('all')
const collapsed = ref<Set<string>>(new Set())

const addedIds = computed(() => {
  const provider = providerStore.getById(props.providerId)
  return new Set((provider?.models ?? []).map((model) => model.id))
})

function capsFor(id: string): {
  input: Modality[]
  output: Modality[]
  thinkingLevels: ThinkingLevel[]
} {
  const preset = catalogStore.lookup(id)
  return {
    input: preset?.input ?? ['text'],
    output: preset?.output ?? ['text'],
    thinkingLevels: preset?.thinkingLevels ?? []
  }
}

function extra(list: Modality[]): Modality[] {
  return list.filter((item) => item !== 'text')
}

function matchesFilter(id: string, key: FilterKey = filter.value): boolean {
  if (key === 'all') return true
  const caps = capsFor(id)
  const kinds = new Set([...extra(caps.input), ...extra(caps.output)])
  if (key === 'text') return kinds.size === 0
  return kinds.has(key)
}

function displayName(model: FetchedModel): string {
  return catalogStore.lookup(model.id)?.name || defaultModelDisplayName(model.id) || model.id
}

function groupName(model: FetchedModel): string {
  const owned = model.ownedBy?.trim()
  if (owned) return owned
  const token = model.id.split(/[/:]/)[0]?.split('-')[0]
  return token || t('editor.other')
}

const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return props.fetchedModels.filter((model) => {
    if (!matchesFilter(model.id)) return false
    if (!keyword) return true
    return (
      model.id.toLowerCase().includes(keyword) ||
      displayName(model).toLowerCase().includes(keyword) ||
      (model.ownedBy ?? '').toLowerCase().includes(keyword)
    )
  })
})

const groups = computed(() => {
  const buckets = new Map<string, FetchedModel[]>()
  for (const model of visible.value) {
    const name = groupName(model)
    const list = buckets.get(name) ?? []
    list.push(model)
    buckets.set(name, list)
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const filterCounts = computed(() => {
  const counts = { all: 0, text: 0, image: 0, audio: 0, video: 0 }
  for (const model of props.fetchedModels) {
    counts.all += 1
    if (matchesFilter(model.id, 'text')) counts.text += 1
    if (matchesFilter(model.id, 'image')) counts.image += 1
    if (matchesFilter(model.id, 'audio')) counts.audio += 1
    if (matchesFilter(model.id, 'video')) counts.video += 1
  }
  return counts
})

function isAdded(id: string): boolean {
  return addedIds.value.has(id)
}

function toggle(id: string): void {
  const provider = providerStore.getById(props.providerId)
  if (!provider) return
  const existing = provider.models.find((model) => model.id === id)
  if (existing) {
    providerStore.removeModel(props.providerId, existing.key)
    return
  }
  providerStore.addModel(props.providerId, { id })
}

function addMany(ids: string[]): void {
  for (const id of ids) {
    if (!isAdded(id)) providerStore.addModel(props.providerId, { id })
  }
}

const allVisibleAdded = computed(
  () => visible.value.length > 0 && visible.value.every((model) => isAdded(model.id))
)

function removeMany(ids: string[]): void {
  const provider = providerStore.getById(props.providerId)
  if (!provider) return
  for (const id of ids) {
    const existing = provider.models.find((model) => model.id === id)
    if (existing) providerStore.removeModel(props.providerId, existing.key)
  }
}

function addVisible(): void {
  const ids = visible.value.map((model) => model.id).filter((id) => !isAdded(id))
  addMany(ids)
  toastStore.success(t('editor.addedModels', { count: ids.length }))
}

function removeVisible(): void {
  const ids = visible.value.map((model) => model.id).filter((id) => isAdded(id))
  removeMany(ids)
  toastStore.success(t('editor.removedModels', { count: ids.length }))
}

function allGroupAdded(models: FetchedModel[]): boolean {
  return models.length > 0 && models.every((model) => isAdded(model.id))
}

function toggleGroupModels(models: FetchedModel[]): void {
  if (allGroupAdded(models)) {
    removeMany(models.map((model) => model.id))
    return
  }
  addMany(models.map((model) => model.id).filter((id) => !isAdded(id)))
}

function toggleGroup(name: string): void {
  const next = new Set(collapsed.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  collapsed.value = next
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="batch">
      <div v-if="open" class="batch-overlay" @click="emit('close')">
        <section class="batch-panel" @click.stop>
        <header class="batch-head">
          <div class="batch-title">
            <span class="batch-title-name">{{ t('editor.providerModels', { name: providerName }) }}</span>
            <span class="batch-count">{{ fetchedModels.length }}</span>
          </div>
          <button
            class="batch-text-btn"
            type="button"
            :disabled="visible.length === 0"
            @click="allVisibleAdded ? removeVisible() : addVisible()"
          >
            {{ allVisibleAdded ? t('editor.removeAll') : t('editor.addAll') }}
          </button>
          <button class="batch-icon-btn" type="button" :title="t('common.close')" @click="emit('close')">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div class="batch-search">
          <input v-model="query" type="search" :placeholder="t('editor.searchModels')" />
        </div>

        <div class="batch-filters">
          <button
            v-for="item in [
              { key: 'all', label: t('editor.all') },
              { key: 'text', label: t('batch.text') },
              { key: 'image', label: t('batch.image') },
              { key: 'audio', label: t('batch.audio') },
              { key: 'video', label: t('batch.video') }
            ]"
            :key="item.key"
            class="batch-chip"
            :class="{ on: filter === item.key }"
            type="button"
            @click="filter = item.key as FilterKey"
          >
            {{ item.label }} {{ filterCounts[item.key as FilterKey] }}
          </button>
        </div>

        <div class="batch-body">
          <div v-if="fetching" class="batch-empty">{{ t('editor.fetchingList') }}</div>
          <div v-else-if="fetchError" class="batch-empty">
            <p>{{ fetchMessage || t('editor.fetchFailed') }}</p>
            <button class="btn btn-sm" type="button" @click="emit('retry')">{{ t('common.retry') }}</button>
          </div>
          <div v-else-if="visible.length === 0" class="batch-empty">{{ t('models.empty') }}</div>
          <div v-else class="batch-groups">
            <section v-for="[name, models] in groups" :key="name" class="batch-group">
              <button class="batch-group-head" type="button" @click="toggleGroup(name)">
                <svg
                  class="batch-chevron"
                  :class="{ closed: collapsed.has(name) }"
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
                <span>{{ name }}</span>
                <span class="batch-count">{{ models.length }}</span>
                <span class="batch-spacer" />
                <span
                  class="batch-icon-btn"
                  :title="allGroupAdded(models) ? t('editor.removeGroup') : t('editor.addGroup')"
                  @click.stop="toggleGroupModels(models)"
                >
                  <svg
                    v-if="allGroupAdded(models)"
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <path d="M3.5 8h9" />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <path d="M8 3.2v9.6M3.2 8h9.6" />
                  </svg>
                </span>
              </button>
              <div v-show="!collapsed.has(name)" class="batch-group-list">
                <div
                  v-for="model in models"
                  :key="model.id"
                  class="batch-row"
                  :class="{ added: isAdded(model.id) }"
                >
                  <ProviderIcon
                    :icon="guessModelIcon(model.id, displayName(model))"
                    :name="displayName(model)"
                    :size="22"
                  />
                  <div class="batch-row-copy">
                    <div class="batch-row-name">{{ displayName(model) }}</div>
                    <div class="batch-row-id">{{ model.id }}</div>
                  </div>
                  <CapabilityBadges v-bind="capsFor(model.id)" size="sm" />
                  <button class="batch-icon-btn" type="button" @click="toggle(model.id)">
                    <svg
                      v-if="isAdded(model.id)"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                    >
                      <path d="M3.5 8h9" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                    >
                      <path d="M8 3.2v9.6M3.2 8h9.6" />
                    </svg>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
