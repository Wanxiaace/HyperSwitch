<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { promptPreview } from '@shared/presets'
import { useLocaleStore } from '@/stores/locale'
import { usePresetStore } from '@/stores/presets'

const route = useRoute()
const router = useRouter()
const presetStore = usePresetStore()
const { t } = useLocaleStore()
const { promptPresets: presets, promptDirty: dirty, promptSaving: saving } = storeToRefs(presetStore)

const query = ref('')
const listEl = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return presets.value
  return presets.value.filter((item) =>
    [item.name, item.description, item.content].join(' ').toLowerCase().includes(keyword)
  )
})

const selectedId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const selected = computed(() => presetStore.getPrompt(selectedId.value) ?? null)

watch(
  [() => route.params.id, presets],
  () => {
    if (route.name !== 'prompt-detail') return
    if (!selected.value) router.replace({ name: 'prompts' })
  },
  { immediate: true }
)

function openItem(id: string): void {
  router.push({ name: 'prompt-detail', params: { id } })
}

function createItem(): void {
  const item = presetStore.createPrompt()
  openItem(item.id)
  requestAnimationFrame(() => {
    listEl.value?.scrollTo({ top: 0 })
  })
}

function patchSelected(patch: Parameters<typeof presetStore.updatePrompt>[1]): void {
  if (!selected.value) return
  presetStore.updatePrompt(selected.value.id, patch)
}

function removeItem(id: string): void {
  const selectedWas = selectedId.value === id
  presetStore.removePrompt(id)
  if (selectedWas) router.replace({ name: 'prompts' })
}

function removeSelected(): void {
  if (!selected.value) return
  removeItem(selected.value.id)
}

function contentCount(content: string): string {
  const length = content.length
  return t('prompts.chars', { count: length })
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ t('prompts.title') }}</h1>
        <p class="page-desc">{{ t('prompts.desc') }}</p>
      </div>
    </header>

    <div class="workspace">
      <div class="list-pane">
        <input v-model="query" class="search" type="search" :placeholder="t('prompts.search')" />
        <div ref="listEl" class="agent-list">
          <TransitionGroup name="provider-item" tag="div" class="agent-stack">
            <div
              v-for="item in filtered"
              :key="item.id"
              class="agent-card"
              :class="{ selected: item.id === selectedId }"
              @click="openItem(item.id)"
            >
              <span class="preset-card-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4.5 2.5h4.2L12 5.8v7.7H4.5V2.5Z" />
                  <path d="M8.7 2.5V5.8H12" />
                  <path d="M6.2 8.4h4M6.2 11h2.6" />
                </svg>
              </span>
              <div>
                <div class="agent-name">{{ item.name }}</div>
                <div class="agent-desc preset-desc">{{ promptPreview(item) || t('prompts.emptyPreview') }}</div>
                <div class="agent-meta">{{ contentCount(item.content) }}</div>
              </div>
              <button class="card-delete" type="button" :title="t('common.delete')" @click.stop="removeItem(item.id)">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M4 5.5h12M7 5.5V4h6v1.5M6.5 8l.6 8h6.8l.6-8" />
                </svg>
              </button>
            </div>
          </TransitionGroup>
          <div v-if="filtered.length === 0" class="empty-list">{{ t('prompts.empty') }}</div>
        </div>
        <div class="list-pane-foot">
          <button class="list-add" type="button" @click="createItem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M8 3.2v9.6M3.2 8h9.6" />
            </svg>
            {{ t('prompts.add') }}
          </button>
        </div>
      </div>

      <div class="editor-pane">
        <Transition name="editor-fade" mode="out-in">
          <div v-if="!selected" key="empty" class="editor-empty">
            <div>
              <h2>{{ t('prompts.pickTitle') }}</h2>
              <p>{{ t('prompts.pickDesc') }}</p>
            </div>
          </div>

          <form v-else key="editor" class="form form-wide editor-form" @submit.prevent="presetStore.savePrompts()">
            <div class="editor-scroll">
              <div class="editor-card">
                <div class="form-grid">
                  <label class="field">
                    <span class="field-label">{{ t('common.name') }} <span class="req">*</span></span>
                    <input
                      :value="selected.name"
                      :placeholder="t('prompts.namePh')"
                      @input="patchSelected({ name: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('common.description') }}</span>
                    <input
                      :value="selected.description"
                      :placeholder="t('prompts.descPh')"
                      @input="patchSelected({ description: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                </div>
              </div>

              <div class="editor-card">
                <label class="field">
                  <span class="field-label">{{ t('prompts.content') }}</span>
                  <textarea
                    class="prompt-editor"
                    :value="selected.content"
                    :placeholder="t('prompts.contentPh')"
                    @input="patchSelected({ content: ($event.target as HTMLTextAreaElement).value })"
                  />
                </label>
              </div>
            </div>

            <div class="editor-footer">
              <button class="btn" type="button" @click="removeSelected">{{ t('prompts.deletePreset') }}</button>
              <button class="btn btn-primary btn-save" type="submit" :disabled="saving || !dirty">
                {{ t('common.save') }}
              </button>
            </div>
          </form>
        </Transition>
      </div>
    </div>
  </section>
</template>
