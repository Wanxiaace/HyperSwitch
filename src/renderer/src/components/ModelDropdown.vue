<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLocaleStore } from '@/stores/locale'
import type { FetchedModel } from '@shared/provider'

const { t } = useLocaleStore()

const props = defineProps<{
  models: FetchedModel[]
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const grouped = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const buckets = new Map<string, FetchedModel[]>()
  for (const model of props.models) {
    if (
      keyword &&
      !model.id.toLowerCase().includes(keyword) &&
      !(model.ownedBy ?? '').toLowerCase().includes(keyword)
    ) {
      continue
    }
    const vendor = model.ownedBy || 'Other'
    const list = buckets.get(vendor) ?? []
    list.push(model)
    buckets.set(vendor, list)
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
})

function anchorEl(): HTMLElement | null {
  return (root.value?.closest('.cc-model-id') as HTMLElement | null) ?? root.value
}

function place(): void {
  const anchor = anchorEl()
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const width = Math.max(rect.width, 280)
  let left = rect.left
  if (left + width > window.innerWidth - 8) {
    left = window.innerWidth - width - 8
  }
  left = Math.max(8, left)
  const measured = panel.value?.offsetHeight ?? 0
  const height = Math.min(measured || 320, window.innerHeight - 16)
  const below = rect.bottom + 6
  const top =
    below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - 6 - height)
  panelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${height}px`
  }
}

async function toggle(): Promise<void> {
  if (open.value) {
    close()
    return
  }
  place()
  open.value = true
  await nextTick()
  place()
}

function pick(id: string): void {
  emit('select', id)
  open.value = false
  query.value = ''
}

function close(): void {
  open.value = false
}

function onPointer(event: MouseEvent): void {
  if (!open.value) return
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  close()
}

function onScroll(event: Event): void {
  if (!open.value) return
  const target = event.target
  if (target instanceof Node && panel.value?.contains(target)) return
  place()
}

onMounted(() => {
  document.addEventListener('mousedown', onPointer)
  window.addEventListener('resize', place)
  document.addEventListener('scroll', onScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointer)
  window.removeEventListener('resize', place)
  document.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div ref="root" class="model-dropdown">
    <button class="btn btn-ghost btn-icon" type="button" :title="t('tools.pickGeneric')" @click="toggle">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="panel" class="dropdown-panel" :style="panelStyle">
          <input v-model="query" class="dropdown-search" type="search" :placeholder="t('editor.searchModels')" />
          <div class="dropdown-list">
            <div v-if="grouped.length === 0" class="dropdown-empty">{{ t('editor.noMatch') }}</div>
            <template v-for="[vendor, items] in grouped" :key="vendor">
              <div class="dropdown-vendor">{{ vendor }}</div>
              <button
                v-for="item in items"
                :key="item.id"
                class="dropdown-item"
                type="button"
                @click="pick(item.id)"
              >
                {{ item.id }}
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
