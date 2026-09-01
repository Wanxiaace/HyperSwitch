<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { iconList } from '@/icons/extracted'
import { getIconMetadata, searchIcons } from '@/icons/extracted/metadata'
import { useLocaleStore } from '@/stores/locale'

const { t } = useLocaleStore()

const props = defineProps<{
  modelValue: string
  name: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)

const filtered = computed(() => (query.value.trim() ? searchIcons(query.value) : iconList))

function pick(icon: string): void {
  emit('update:modelValue', icon)
  open.value = false
}

function onPointer(event: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onPointer))
</script>

<template>
  <div ref="root" class="icon-picker">
    <button class="icon-picker-trigger" type="button" :title="t('editor.pickIcon')" @click="open = !open">
      <ProviderIcon :icon="modelValue" :name="name || t('editor.provider')" :size="48" />
    </button>
    <Transition name="pop">
      <div v-if="open" class="icon-picker-panel">
        <input v-model="query" class="dropdown-search" type="search" :placeholder="t('editor.searchIcons')" />
        <div class="icon-picker-grid">
          <button
            v-for="icon in filtered"
            :key="icon"
            class="icon-picker-item"
            :class="{ on: icon === modelValue }"
            type="button"
            :title="getIconMetadata(icon)?.displayName || icon"
            @click="pick(icon)"
          >
            <ProviderIcon :icon="icon" :name="icon" :size="24" />
          </button>
        </div>
        <p v-if="filtered.length === 0" class="dropdown-empty">{{ t('editor.noIcons') }}</p>
      </div>
    </Transition>
  </div>
</template>
