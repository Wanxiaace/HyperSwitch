<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'

const toastStore = useToastStore()
const { t } = useLocaleStore()
const { items } = storeToRefs(toastStore)
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="item in items" :key="item.id" class="toast" :class="item.type">
        <button class="toast-close" type="button" :title="t('toast.close')" @click="toastStore.dismiss(item.id)">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <svg
          v-if="item.type === 'success'"
          class="toast-icon"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M5 8.2l2 2 4-4" />
        </svg>
        <svg
          v-else
          class="toast-icon"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v4M8 11.2h.01" />
        </svg>
        <span>{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
