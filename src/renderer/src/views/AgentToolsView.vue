<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { AGENT_EDITORS } from '@/agents/registry'
import AgentModelPicker from '@/components/AgentModelPicker.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { guessModelIcon } from '@/icons/guess'
import { useAgentBindingStore } from '@/stores/agentBindings'
import { useLocaleStore } from '@/stores/locale'
import { useProviderStore } from '@/stores/providers'
import { useToastStore } from '@/stores/toasts'
import { getAgentPlugin } from '@shared/agentPlugin'
import {
  AGENT_TOOLS,
  toolFormats,
  type AgentToolBinding,
  type AgentToolId,
  type AgentToolStatus
} from '@shared/agentTools'

const toastStore = useToastStore()
const { t } = useLocaleStore()
const bindingStore = useAgentBindingStore()
const providerStore = useProviderStore()
const { bindings } = storeToRefs(bindingStore)
const { allModels } = storeToRefs(providerStore)

const loading = ref(true)
const expanded = ref<AgentToolId | ''>('')
const picking = ref<AgentToolId | ''>('')
const tools = ref<AgentToolStatus[]>(
  AGENT_TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    found: false,
    path: null
  }))
)

function toolIcon(id: AgentToolId): string {
  return getAgentPlugin(id)?.icon || id
}

function toolEditor(id: AgentToolId) {
  return AGENT_EDITORS[id]
}

const pickingTool = computed(() => tools.value.find((tool) => tool.id === picking.value) ?? null)
const pickingFormats = computed(() => (picking.value ? toolFormats(picking.value) : undefined))

function boundModels(id: AgentToolId) {
  return (bindings.value[id] ?? []).map((binding) => {
    const row = allModels.value.find(
      (item) => item.providerId === binding.providerId && item.model.key === binding.modelKey
    )
    const name = row?.model.name || row?.model.id || binding.modelKey
    return {
      binding,
      name,
      icon: guessModelIcon(row?.model.id ?? '', row?.model.name ?? '', row?.providerIcon ?? '')
    }
  })
}

function toggle(id: AgentToolId): void {
  expanded.value = expanded.value === id ? '' : id
}

async function openDir(tool: AgentToolStatus): Promise<void> {
  if (!tool.path || !window.hyper?.openPath) return
  const error = await window.hyper.openPath(tool.path)
  if (error) toastStore.error(error)
}

async function detect(showToast = false): Promise<void> {
  loading.value = true
  try {
    const result = await window.hyper.detectTools()
    if (!result.ok) {
      toastStore.error(t('tools.detectFailed', { error: result.error }))
      return
    }
    tools.value = result.tools
    if (showToast) {
      const ready = result.tools.filter((tool) => tool.found).length
      toastStore.success(t('tools.detectOk', { ready, total: result.tools.length }))
    }
  } catch (error) {
    toastStore.error(error instanceof Error ? error.message : t('tools.detectError'))
  } finally {
    loading.value = false
  }
}

async function applyModels(list: AgentToolBinding[]): Promise<void> {
  if (!picking.value) return
  await bindingStore.setBinding(picking.value, list)
  picking.value = ''
  toastStore.success(list.length ? t('tools.applied', { count: list.length }) : t('tools.cleared'))
}

async function removeBound(id: AgentToolId, binding: AgentToolBinding): Promise<void> {
  const next = (bindings.value[id] ?? []).filter(
    (item) => !(item.providerId === binding.providerId && item.modelKey === binding.modelKey)
  )
  await bindingStore.setBinding(id, next)
}

onMounted(() => {
  void detect()
})
</script>

<template>
  <section class="page tools-layout">
    <div class="tools-scroll">
      <div class="tools-column">
        <header class="tools-head">
          <div>
            <h1 class="page-title">{{ t('tools.title') }}</h1>
            <p class="page-desc">{{ t('tools.desc') }}</p>
          </div>
          <button class="btn btn-sm" type="button" :disabled="loading" @click="detect(true)">
            <svg
              class="btn-svg"
              :class="{ spin: loading }"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path d="M8 2.6a5.4 5.4 0 1 1-4.7 2.8" stroke-linecap="round" />
            </svg>
            {{ loading ? t('tools.detecting') : t('tools.detect') }}
          </button>
        </header>

        <div class="collapse-list">
          <article v-for="tool in tools" :key="tool.id" class="collapse-card">
            <button class="collapse-head" type="button" @click="toggle(tool.id)">
              <span class="tool-card-icon">
                <ProviderIcon :icon="toolIcon(tool.id)" :name="tool.name" :size="22" />
              </span>
              <span class="collapse-title">{{ tool.name }}</span>
              <span class="tool-badge" :class="loading ? 'load' : tool.found ? 'ok' : 'off'">
                {{ loading ? t('tools.detecting') : tool.found ? t('tools.found') : t('tools.missing') }}
              </span>
              <svg
                class="collapse-arrow"
                :class="{ open: expanded === tool.id }"
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            <Transition name="accordion">
              <div v-if="expanded === tool.id" class="accordion">
                <div class="accordion-inner">
                  <div class="collapse-body">
                    <div class="collapse-row">
                      <div>
                        <div class="collapse-row-title">{{ t('tools.openDir') }}</div>
                        <div class="collapse-row-desc">{{ tool.path || t('tools.noDir') }}</div>
                      </div>
                      <button class="btn btn-sm" type="button" :disabled="!tool.path" @click="openDir(tool)">
                        {{ t('common.open') }}
                      </button>
                    </div>
                    <component
                      :is="toolEditor(tool.id)"
                      v-if="toolEditor(tool.id)"
                      :active="expanded === tool.id"
                    />
                    <div v-else class="collapse-models">
                      <div class="collapse-row">
                        <div>
                          <div class="collapse-row-title">{{ t('tools.usedModels') }}</div>
                          <div class="collapse-row-desc">
                            {{
                              boundModels(tool.id).length
                                ? t('tools.selectedCount', { count: boundModels(tool.id).length })
                                : t('tools.noneSelected')
                            }}
                          </div>
                        </div>
                        <button class="btn btn-sm" type="button" @click="picking = tool.id">{{ t('common.select') }}</button>
                      </div>
                      <div v-if="boundModels(tool.id).length" class="binding-list">
                        <div
                          v-for="item in boundModels(tool.id)"
                          :key="`${item.binding.providerId}-${item.binding.modelKey}`"
                          class="binding-chip"
                        >
                          <ProviderIcon :icon="item.icon" :name="item.name" :size="16" />
                          <span>{{ item.name }}</span>
                          <button
                            class="binding-remove"
                            type="button"
                            :title="t('common.remove')"
                            @click="removeBound(tool.id, item.binding)"
                          >
                            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8">
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </article>
        </div>
      </div>
    </div>

    <AgentModelPicker
      :open="Boolean(pickingTool)"
      :title="pickingTool ? t('tools.pickTitle', { name: pickingTool.name }) : t('tools.pickGeneric')"
      :selected="picking ? bindings[picking] ?? [] : []"
      :formats="pickingFormats"
      @close="picking = ''"
      @confirm="applyModels"
    />
  </section>
</template>
