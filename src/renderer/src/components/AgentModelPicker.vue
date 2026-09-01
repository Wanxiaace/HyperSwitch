<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { guessModelIcon } from '@/icons/guess'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import type { AgentToolBinding } from '@shared/agentTools'
import { API_FORMAT_LABELS, type ApiFormat } from '@shared/provider'

const props = defineProps<{
  open: boolean
  title: string
  selected: AgentToolBinding[]
  formats?: ApiFormat[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: AgentToolBinding[]]
}>()

const providerStore = useProviderStore()
const { t } = useLocaleStore()
const { allModels } = storeToRefs(providerStore)
const query = ref('')
const draft = ref<AgentToolBinding[]>([])

const eligible = computed(() => {
  const formats = props.formats
  if (!formats || formats.length === 0) return allModels.value
  return allModels.value.filter((row) => formats.includes(row.providerFormat))
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      const allowed = new Set(eligible.value.map((row) => `${row.providerId}:${row.model.key}`))
      draft.value = props.selected
        .filter((item) => allowed.has(`${item.providerId}:${item.modelKey}`))
        .map((item) => ({ ...item }))
      query.value = ''
    }
  }
)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return eligible.value
  return eligible.value.filter(({ providerName, model }) =>
    [model.id, model.name, providerName].join(' ').toLowerCase().includes(keyword)
  )
})

const emptyText = computed(() => {
  if (allModels.value.length === 0) {
    return t('tools.emptyAll')
  }
  if (eligible.value.length === 0 && props.formats?.length) {
    const labels = props.formats.map((format) => API_FORMAT_LABELS[format]).join(' / ')
    return t('tools.emptyFormats', { formats: labels })
  }
  return t('tools.emptyMatch')
})

const picked = computed(() =>
  draft.value.map((item) => {
    const row = allModels.value.find(
      (entry) => entry.providerId === item.providerId && entry.model.key === item.modelKey
    )
    return {
      ...item,
      name: row?.model.name || row?.model.id || item.modelKey,
      icon: guessModelIcon(row?.model.id ?? '', row?.model.name ?? '', row?.providerIcon ?? '')
    }
  })
)

function isOn(providerId: string, modelKey: string): boolean {
  return draft.value.some((item) => item.providerId === providerId && item.modelKey === modelKey)
}

function toggle(providerId: string, modelKey: string): void {
  if (isOn(providerId, modelKey)) {
    draft.value = draft.value.filter(
      (item) => !(item.providerId === providerId && item.modelKey === modelKey)
    )
    return
  }
  draft.value = [...draft.value, { providerId, modelKey }]
}

function removePicked(providerId: string, modelKey: string): void {
  draft.value = draft.value.filter(
    (item) => !(item.providerId === providerId && item.modelKey === modelKey)
  )
}

function confirm(): void {
  const allowed = new Set(eligible.value.map((row) => `${row.providerId}:${row.model.key}`))
  emit(
    'confirm',
    draft.value
      .filter((item) => allowed.has(`${item.providerId}:${item.modelKey}`))
      .map((item) => ({ ...item }))
  )
}

function onKey(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="batch">
      <div v-if="open" class="picker-overlay" @click="emit('close')">
        <section class="picker-panel" @click.stop>
          <header class="picker-head">
            <div class="picker-title">{{ title }}</div>
            <span class="batch-count">{{ draft.length }}</span>
            <button class="batch-icon-btn" type="button" :title="t('common.close')" @click="emit('close')">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>
          <div class="batch-search">
            <input v-model="query" type="search" :placeholder="t('editor.searchModels')" />
          </div>
          <div class="picker-body">
            <p v-if="filtered.length === 0" class="batch-empty">{{ emptyText }}</p>
            <button
              v-for="row in filtered"
              :key="`${row.providerId}-${row.model.key}`"
              class="picker-row"
              :class="{ on: isOn(row.providerId, row.model.key) }"
              type="button"
              @click="toggle(row.providerId, row.model.key)"
            >
              <span class="picker-check" aria-hidden="true">
                <svg v-if="isOn(row.providerId, row.model.key)" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
                </svg>
              </span>
              <ProviderIcon
                :icon="guessModelIcon(row.model.id, row.model.name, row.providerIcon)"
                :name="row.model.name || row.model.id"
                :size="22"
              />
              <div class="picker-row-copy">
                <div class="picker-row-name">{{ row.model.name || row.model.id || t('common.unnamed') }}</div>
                <div class="picker-row-id">{{ row.providerName }} · {{ row.model.id }}</div>
              </div>
            </button>
          </div>
          <div v-if="picked.length" class="picker-picked">
            <div class="picker-picked-label">{{ t('tools.selectedCount', { count: picked.length }) }}</div>
            <div class="binding-list picker-picked-list">
              <div
                v-for="item in picked"
                :key="`${item.providerId}-${item.modelKey}`"
                class="binding-chip"
              >
                <ProviderIcon :icon="item.icon" :name="item.name" :size="16" />
                <span>{{ item.name }}</span>
                <button
                  class="binding-remove"
                  type="button"
                  :title="t('common.remove')"
                  @click="removePicked(item.providerId, item.modelKey)"
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <footer class="picker-foot">
            <button class="btn" type="button" @click="draft = []">{{ t('common.clear') }}</button>
            <span class="picker-spacer" />
            <button class="btn" type="button" @click="emit('close')">{{ t('common.cancel') }}</button>
            <button class="btn btn-primary" type="button" @click="confirm">
              {{ t('common.confirm') }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
