<script setup lang="ts">
import ModelDropdown from '@/components/ModelDropdown.vue'
import type { FetchedModel } from '@shared/provider'

defineProps<{
  modelValue: string
  models?: FetchedModel[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: string]
}>()
</script>

<template>
  <div class="cc-model-id">
    <input
      :value="modelValue"
      :placeholder="placeholder ?? 'model-id'"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <ModelDropdown
      v-if="models && models.length > 0"
      :models="models"
      @select="emit('select', $event)"
    />
  </div>
</template>
