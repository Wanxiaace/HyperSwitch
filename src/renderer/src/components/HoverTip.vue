<script setup lang="ts">
import { nextTick, ref } from 'vue'

defineProps<{
  text: string
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

async function show(): Promise<void> {
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return
  open.value = true
  await nextTick()
  const above = rect.top > 40
  let left = rect.left + rect.width / 2
  left = Math.min(window.innerWidth - 12, Math.max(12, left))
  panelStyle.value = {
    left: `${left}px`,
    top: `${above ? rect.top - 8 : rect.bottom + 8}px`,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
  }
}

function hide(): void {
  open.value = false
}
</script>

<template>
  <span ref="root" class="hover-tip" @mouseenter="show" @mouseleave="hide">
    <slot />
    <Teleport to="body">
      <div v-if="open" class="hover-tip-panel" :style="panelStyle">{{ text }}</div>
    </Teleport>
  </span>
</template>
