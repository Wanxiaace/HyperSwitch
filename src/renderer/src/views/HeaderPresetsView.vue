<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { headerPreview } from '@shared/presets'
import { useLocaleStore } from '@/stores/locale'
import { usePresetStore } from '@/stores/presets'

const route = useRoute()
const router = useRouter()
const presetStore = usePresetStore()
const { t } = useLocaleStore()
const { headerPresets: presets, headerDirty: dirty, headerSaving: saving } = storeToRefs(presetStore)

const query = ref('')
const listEl = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return presets.value
  return presets.value.filter((item) =>
    [item.name, item.description, ...item.headers.map((entry) => `${entry.key} ${entry.value}`)]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  )
})

const selectedId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const selected = computed(() => presetStore.getHeader(selectedId.value) ?? null)

watch(
  [() => route.params.id, presets],
  () => {
    if (route.name !== 'header-detail') return
    if (!selected.value) router.replace({ name: 'headers' })
  },
  { immediate: true }
)

function openItem(id: string): void {
  router.push({ name: 'header-detail', params: { id } })
}

function createItem(): void {
  const item = presetStore.createHeader()
  openItem(item.id)
  requestAnimationFrame(() => {
    listEl.value?.scrollTo({ top: 0 })
  })
}

function patchSelected(patch: Parameters<typeof presetStore.updateHeader>[1]): void {
  if (!selected.value) return
  presetStore.updateHeader(selected.value.id, patch)
}

function patchEntry(entryId: string, patch: Parameters<typeof presetStore.updateHeaderEntry>[2]): void {
  if (!selected.value) return
  presetStore.updateHeaderEntry(selected.value.id, entryId, patch)
}

function addEntry(): void {
  if (!selected.value) return
  presetStore.addHeaderEntry(selected.value.id)
}

function removeEntry(entryId: string): void {
  if (!selected.value) return
  presetStore.removeHeaderEntry(selected.value.id, entryId)
}

function removeItem(id: string): void {
  const selectedWas = selectedId.value === id
  presetStore.removeHeader(id)
  if (selectedWas) router.replace({ name: 'headers' })
}

function removeSelected(): void {
  if (!selected.value) return
  removeItem(selected.value.id)
}

function headerCount(count: number): string {
  return t('headers.count', { count })
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ t('headers.title') }}</h1>
        <p class="page-desc">{{ t('headers.desc') }}</p>
      </div>
    </header>

    <div class="workspace">
      <div class="list-pane">
        <input v-model="query" class="search" type="search" :placeholder="t('headers.search')" />
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
                  <rect x="2.5" y="3" width="11" height="4.2" rx="1" />
                  <rect x="2.5" y="8.8" width="11" height="4.2" rx="1" />
                  <path d="M5 5.1h6M5 10.9h4" />
                </svg>
              </span>
              <div>
                <div class="agent-name">{{ item.name }}</div>
                <div class="agent-desc preset-desc">{{ headerPreview(item) || t('headers.emptyPreview') }}</div>
                <div class="agent-meta">{{ headerCount(item.headers.length) }}</div>
              </div>
              <button class="card-delete" type="button" :title="t('common.delete')" @click.stop="removeItem(item.id)">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M4 5.5h12M7 5.5V4h6v1.5M6.5 8l.6 8h6.8l.6-8" />
                </svg>
              </button>
            </div>
          </TransitionGroup>
          <div v-if="filtered.length === 0" class="empty-list">{{ t('headers.empty') }}</div>
        </div>
        <div class="list-pane-foot">
          <button class="list-add" type="button" @click="createItem">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M8 3.2v9.6M3.2 8h9.6" />
            </svg>
            {{ t('headers.add') }}
          </button>
        </div>
      </div>

      <div class="editor-pane">
        <Transition name="editor-fade" mode="out-in">
          <div v-if="!selected" key="empty" class="editor-empty">
            <div>
              <h2>{{ t('headers.pickTitle') }}</h2>
              <p>{{ t('headers.pickDesc') }}</p>
            </div>
          </div>

          <form v-else key="editor" class="form form-wide editor-form" @submit.prevent="presetStore.saveHeaders()">
            <div class="editor-scroll">
              <div class="editor-card">
                <div class="form-grid">
                  <label class="field">
                    <span class="field-label">{{ t('common.name') }} <span class="req">*</span></span>
                    <input
                      :value="selected.name"
                      :placeholder="t('headers.namePh')"
                      @input="patchSelected({ name: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('common.description') }}</span>
                    <input
                      :value="selected.description"
                      :placeholder="t('headers.descPh')"
                      @input="patchSelected({ description: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                </div>
              </div>

              <div class="editor-card">
                <div class="header-section-head">
                  <h3>{{ t('headers.section') }}</h3>
                  <button class="btn btn-sm" type="button" @click="addEntry">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M8 3.5v9M3.5 8h9" />
                    </svg>
                    {{ t('headers.addRow') }}
                  </button>
                </div>
                <div class="header-cols">
                  <span class="header-col-check" />
                  <span>{{ t('common.name') }}</span>
                  <span>{{ t('common.value') }}</span>
                  <span class="header-col-icon" />
                </div>
                <p v-if="selected.headers.length === 0" class="hint">{{ t('headers.none') }}</p>
                <TransitionGroup v-else name="model-item" tag="div" class="header-stack">
                  <div v-for="entry in selected.headers" :key="entry.id" class="header-row">
                    <button
                      class="picker-check"
                      :class="{ on: entry.enabled }"
                      type="button"
                      :title="entry.enabled ? t('common.enabled') : t('common.disabled')"
                      @click="patchEntry(entry.id, { enabled: !entry.enabled })"
                    >
                      <svg
                        v-if="entry.enabled"
                        viewBox="0 0 16 16"
                        width="10"
                        height="10"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
                      </svg>
                    </button>
                    <input
                      :value="entry.key"
                      placeholder="X-Title"
                      spellcheck="false"
                      @input="patchEntry(entry.id, { key: ($event.target as HTMLInputElement).value })"
                    />
                    <input
                      :value="entry.value"
                      placeholder="HyperSwitch"
                      spellcheck="false"
                      @input="patchEntry(entry.id, { value: ($event.target as HTMLInputElement).value })"
                    />
                    <button class="model-delete" type="button" :title="t('common.delete')" @click="removeEntry(entry.id)">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 7l.5 6h4l.5-6" />
                      </svg>
                    </button>
                  </div>
                </TransitionGroup>
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
