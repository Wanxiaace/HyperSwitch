<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const currentLabel = computed(
  () => props.options.find((item) => item.value === props.modelValue)?.label ?? props.modelValue
)

function place(): void {
  const trigger = root.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, 160)
  let left = rect.left
  if (left + width > window.innerWidth - 8) {
    left = window.innerWidth - width - 8
  }
  left = Math.max(8, left)
  const measured = panel.value?.offsetHeight ?? 0
  const height = Math.min(measured || 240, window.innerHeight - 16)
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

function close(): void {
  open.value = false
}

function pick(value: string): void {
  emit('update:modelValue', value)
  close()
}

function onPointer(event: MouseEvent): void {
  if (!open.value) return
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  close()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

function onScroll(event: Event): void {
  if (!open.value) return
  const target = event.target
  if (target instanceof Node && panel.value?.contains(target)) return
  place()
}

onMounted(() => {
  document.addEventListener('mousedown', onPointer)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', place)
  document.addEventListener('scroll', onScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointer)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', place)
  document.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div ref="root" class="select-menu">
    <button
      class="select-trigger"
      :class="{ open }"
      type="button"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="select-value">{{ currentLabel }}</span>
      <svg
        class="select-chevron"
        :class="{ open }"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="panel" class="select-panel" :style="panelStyle" role="listbox">
          <button
            v-for="option in options"
            :key="option.value"
            class="select-option"
            :class="{ on: option.value === modelValue }"
            type="button"
            role="option"
            :aria-selected="option.value === modelValue"
            @click="pick(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
