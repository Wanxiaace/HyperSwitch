import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: string
  type: 'success' | 'error'
  message: string
}

export const useToastStore = defineStore('toasts', () => {
  const items = ref<ToastItem[]>([])
  const timers = new Map<string, number>()

  function dismiss(id: string): void {
    const timer = timers.get(id)
    if (timer) window.clearTimeout(timer)
    timers.delete(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function show(type: ToastItem['type'], message: string): void {
    const id = crypto.randomUUID()
    items.value.push({ id, type, message })
    timers.set(
      id,
      window.setTimeout(() => dismiss(id), 2600)
    )
  }

  function success(message: string): void {
    show('success', message)
  }

  function error(message: string): void {
    show('error', message)
  }

  return { items, success, error, dismiss }
})
