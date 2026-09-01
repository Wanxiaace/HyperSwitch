import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AgentToolBinding, AgentToolBindings, AgentToolId } from '@shared/agentTools'

export const useAgentBindingStore = defineStore('agentBindings', () => {
  const bindings = ref<AgentToolBindings>({})

  function getBinding(id: AgentToolId): AgentToolBinding[] {
    return bindings.value[id] ?? []
  }

  async function hydrate(): Promise<void> {
    if (!window.hyper) return
    if (window.hyper.loadBindings) {
      bindings.value = await window.hyper.loadBindings()
      return
    }
    if (!window.hyper.loadConfig) return
    const file = await window.hyper.loadConfig()
    bindings.value = file.agentBindings ?? {}
  }

  async function setBinding(id: AgentToolId, list: AgentToolBinding[]): Promise<void> {
    const next: AgentToolBindings = { ...bindings.value }
    if (list.length > 0) next[id] = list
    else delete next[id]
    bindings.value = next
    if (window.hyper?.saveBindings) await window.hyper.saveBindings(next)
  }

  return { bindings, getBinding, hydrate, setBinding }
})
