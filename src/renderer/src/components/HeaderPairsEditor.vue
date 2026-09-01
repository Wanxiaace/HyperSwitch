<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { enabledHeaderPairs, headerPreview } from '@shared/presets'
import { useLocaleStore } from '@/stores/locale'
import { usePresetStore } from '@/stores/presets'
import { useToastStore } from '@/stores/toasts'

const props = defineProps<{
  modelValue: { key: string; value: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: { key: string; value: string }[]]
}>()

const toastStore = useToastStore()
const { t } = useLocaleStore()
const { savedHeaderPresets } = storeToRefs(usePresetStore())
const picking = ref(false)

function setRows(rows: { key: string; value: string }[]): void {
  emit('update:modelValue', rows)
}

function addRow(): void {
  setRows([...props.modelValue, { key: '', value: '' }])
}

function removeRow(index: number): void {
  setRows(props.modelValue.filter((_, item) => item !== index))
}

function patchRow(index: number, partial: { key?: string; value?: string }): void {
  setRows(props.modelValue.map((row, item) => (item === index ? { ...row, ...partial } : row)))
}

function openPicker(): void {
  if (savedHeaderPresets.value.length === 0) {
    toastStore.error(t('headers.emptyPresets'))
    return
  }
  picking.value = true
}

function fillFrom(id: string): void {
  const preset = savedHeaderPresets.value.find((item) => item.id === id)
  if (!preset) return
  setRows(enabledHeaderPairs(preset))
  picking.value = false
}
</script>

<template>
  <div class="header-pairs">
    <div class="header-section-head">
      <span class="field-label">{{ t('headers.custom') }}</span>
      <div class="models-actions">
        <button class="btn btn-sm" type="button" @click="openPicker">{{ t('editor.fillFromPreset') }}</button>
        <button class="btn btn-sm" type="button" @click="addRow">{{ t('headers.addRow') }}</button>
      </div>
    </div>
    <slot />
    <div v-if="modelValue.length" class="header-stack">
      <div v-for="(entry, index) in modelValue" :key="index" class="header-row header-row-plain">
        <input
          :value="entry.key"
          placeholder="Header-Name"
          spellcheck="false"
          @input="patchRow(index, { key: ($event.target as HTMLInputElement).value })"
        />
        <input
          :value="entry.value"
          :placeholder="t('common.value')"
          spellcheck="false"
          @input="patchRow(index, { value: ($event.target as HTMLInputElement).value })"
        />
        <button class="model-delete" type="button" :title="t('common.delete')" @click="removeRow(index)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 7l.5 6h4l.5-6" />
          </svg>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="batch">
        <div v-if="picking" class="picker-overlay" @click="picking = false">
          <section class="picker-panel" @click.stop>
            <header class="picker-head">
              <div class="picker-title">{{ t('editor.fillFromPreset') }}</div>
              <button class="btn btn-sm" type="button" @click="picking = false">{{ t('common.close') }}</button>
            </header>
            <div class="picker-body">
              <button
                v-for="preset in savedHeaderPresets"
                :key="preset.id"
                class="picker-row"
                type="button"
                @click="fillFrom(preset.id)"
              >
                <div class="picker-row-copy">
                  <div class="picker-row-name">{{ preset.name }}</div>
                  <div class="picker-row-id">{{ headerPreview(preset) || t('headers.emptyPreview') }}</div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
