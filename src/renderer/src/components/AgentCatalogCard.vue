<script setup lang="ts">
import { ref } from 'vue'
import { useLocaleStore } from '@/stores/locale'

const { t } = useLocaleStore()

const props = defineProps<{
  open?: boolean
}>()

defineEmits<{
  remove: []
}>()

const expanded = ref(props.open === true)
</script>

<template>
  <article class="agent-catalog-card">
    <div class="agent-catalog-head">
      <button
        class="btn btn-ghost btn-icon"
        type="button"
        :title="t('common.expand')"
        @click="expanded = !expanded"
      >
        <svg
          class="chevron"
          :class="{ rotated: expanded }"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>
      <div class="agent-catalog-fields">
        <slot name="head" />
      </div>
      <button class="model-delete" type="button" :title="t('common.delete')" @click="$emit('remove')">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 7l.5 6h4l.5-6" />
        </svg>
      </button>
    </div>
    <Transition name="accordion">
      <div v-if="expanded" class="accordion">
        <div class="accordion-inner">
          <div class="agent-catalog-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </article>
</template>
