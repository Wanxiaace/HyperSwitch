<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SelectMenu from '@/components/SelectMenu.vue'
import { promptPreview } from '@shared/presets'
import { useLocaleStore } from '@/stores/locale'
import { usePresetStore } from '@/stores/presets'
import { useToastStore } from '@/stores/toasts'

const props = defineProps<{
  enabled: boolean
  content: string
  label?: string
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:content': [value: string]
}>()

const toastStore = useToastStore()
const { t } = useLocaleStore()
const { savedPromptPresets } = storeToRefs(usePresetStore())
const picking = ref(false)

const modeOptions = computed(() => [
  { value: 'off', label: t('editor.unused') },
  { value: 'on', label: t('editor.use') }
])

const mode = computed(() => (props.enabled ? 'on' : 'off'))

function setMode(value: string): void {
  emit('update:enabled', value === 'on')
}

function openPicker(): void {
  if (savedPromptPresets.value.length === 0) {
    toastStore.error(t('prompts.none'))
    return
  }
  picking.value = true
}

function fillFrom(id: string): void {
  const preset = savedPromptPresets.value.find((item) => item.id === id)
  if (!preset) return
  if (!props.enabled) emit('update:enabled', true)
  emit('update:content', preset.content)
  picking.value = false
}
</script>

<template>
  <div class="prompt-block">
    <div class="header-section-head">
      <span class="field-label">{{ label ?? t('editor.systemPrompt') }}</span>
      <div class="models-actions">
        <button v-if="enabled" class="btn btn-sm" type="button" @click="openPicker">{{ t('editor.fillFromPreset') }}</button>
        <SelectMenu :model-value="mode" :options="modeOptions" @update:model-value="setMode" />
      </div>
    </div>
    <textarea
      v-if="enabled"
      class="prompt-editor-input"
      :value="content"
      :placeholder="t('editor.promptPh')"
      spellcheck="false"
      @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
    />

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
                v-for="preset in savedPromptPresets"
                :key="preset.id"
                class="picker-row"
                type="button"
                @click="fillFrom(preset.id)"
              >
                <div class="picker-row-copy">
                  <div class="picker-row-name">{{ preset.name }}</div>
                  <div class="picker-row-id">{{ promptPreview(preset) || t('prompts.emptyPreview') }}</div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
