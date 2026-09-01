<script setup lang="ts" generic="T extends string">
defineProps<{
  options: readonly T[]
  labels: Record<T, string>
  modelValue: T[]
}>()

const emit = defineEmits<{
  toggle: [value: T, enabled: boolean]
}>()
</script>

<template>
  <div class="option-chips">
    <button
      v-for="option in options"
      :key="option"
      class="option-chip"
      :class="{ on: modelValue.includes(option) }"
      type="button"
      @click="emit('toggle', option, !modelValue.includes(option))"
    >
      {{ labels[option] }}
    </button>
  </div>
</template>
