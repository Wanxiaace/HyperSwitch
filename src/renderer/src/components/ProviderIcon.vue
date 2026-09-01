<script setup lang="ts">
import { computed } from 'vue'
import { getIcon, getIconMetadata, getIconUrl, hasIcon, isUrlIcon } from '@/icons/extracted'

const props = withDefaults(
  defineProps<{
    icon?: string
    name: string
    size?: number
  }>(),
  { size: 28 }
)

const svg = computed(() => {
  if (props.icon && !isUrlIcon(props.icon) && hasIcon(props.icon)) {
    return getIcon(props.icon)
  }
  return ''
})

const url = computed(() => (props.icon && isUrlIcon(props.icon) ? getIconUrl(props.icon) : ''))

const color = computed(() => {
  if (!props.icon) return undefined
  const meta = getIconMetadata(props.icon)
  return meta?.defaultColor && meta.defaultColor !== 'currentColor' ? meta.defaultColor : undefined
})

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
)

const box = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${props.size}px`,
  color: color.value
}))
</script>

<template>
  <span class="provider-icon" :style="box" :title="name">
    <span v-if="svg" class="provider-icon-svg" v-html="svg" />
    <img v-else-if="url" class="provider-icon-img" :src="url" :alt="name" />
    <span v-else class="provider-icon-fallback">{{ initials || '?' }}</span>
  </span>
</template>
