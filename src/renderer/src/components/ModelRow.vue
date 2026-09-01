<script setup lang="ts">
import { computed, ref } from 'vue'
import ModelDropdown from '@/components/ModelDropdown.vue'
import OptionChips from '@/components/OptionChips.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import {
  capsFromCatalog,
  defaultModelDisplayName,
  isAutoModelName,
  MODALITIES,
  THINKING_LEVELS,
  toggleModality,
  toggleThinkingLevel,
  type FetchedModel,
  type Modality,
  type ModelConfig,
  type ThinkingLevel
} from '@shared/provider'

const { t } = useLocaleStore()
const modalityLabels = computed(() => ({
  text: t('modality.text'),
  image: t('modality.image'),
  audio: t('modality.audio'),
  video: t('modality.video')
}))
const thinkingLabels = computed(() => ({
  off: t('thinking.off'),
  minimal: t('thinking.minimal'),
  low: t('thinking.low'),
  medium: t('thinking.medium'),
  high: t('thinking.high'),
  xhigh: t('thinking.xhigh'),
  max: t('thinking.max')
}))

const props = defineProps<{
  model: ModelConfig
  fetchedModels: FetchedModel[]
}>()

const emit = defineEmits<{
  update: [patch: Partial<Omit<ModelConfig, 'key'>>]
  remove: []
}>()

const catalogStore = useCatalogStore()
const expanded = ref(false)

function setId(id: string): void {
  const autoName = isAutoModelName(props.model.name, props.model.id)
  const preset = catalogStore.lookup(id)
  if (preset) {
    emit('update', {
      id,
      name: autoName ? preset.name || defaultModelDisplayName(id) : props.model.name,
      ...capsFromCatalog(preset)
    })
    return
  }
  emit('update', {
    id,
    name: autoName ? defaultModelDisplayName(id) : props.model.name
  })
}

function setNumber(field: 'contextWindow' | 'maxOutput', raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) {
    emit('update', { [field]: null })
    return
  }
  const value = Number(trimmed)
  emit('update', { [field]: Number.isFinite(value) && value > 0 ? value : null })
}

function setModality(field: 'input' | 'output', type: Modality, enabled: boolean): void {
  const current = props.model[field]
  if (current.includes(type) === enabled) return
  emit('update', { [field]: toggleModality(current, type) })
}

function setThinking(level: ThinkingLevel, enabled: boolean): void {
  const current = props.model.thinkingLevels
  if (current.includes(level) === enabled) return
  emit('update', { thinkingLevels: toggleThinkingLevel(current, level) })
}
</script>

<template>
  <article class="cc-model">
    <div class="cc-model-head">
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
      <div class="cc-model-id">
        <input
          :value="model.id"
          placeholder="model-id"
          :aria-label="t('providers.modelId')"
          @input="setId(($event.target as HTMLInputElement).value)"
        />
        <ModelDropdown
          v-if="fetchedModels.length > 0"
          :models="fetchedModels"
          @select="setId"
        />
      </div>
      <input
        :value="model.name"
        :placeholder="t('providers.displayName')"
        :aria-label="t('providers.displayName')"
        @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
      />
      <button class="model-delete" type="button" :title="t('common.remove')" @click="emit('remove')">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6.5l.5 6h5l.5-6" />
        </svg>
      </button>
    </div>

    <Transition name="accordion">
      <div v-if="expanded" class="accordion">
        <div class="accordion-inner">
          <div class="cc-model-details">
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.input') }}</span>
              <OptionChips
                :options="MODALITIES"
                :labels="modalityLabels"
                :model-value="model.input"
                @toggle="(type, enabled) => setModality('input', type, enabled)"
              />
            </div>
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.output') }}</span>
              <OptionChips
                :options="MODALITIES"
                :labels="modalityLabels"
                :model-value="model.output"
                @toggle="(type, enabled) => setModality('output', type, enabled)"
              />
            </div>
            <div class="capability-row">
              <span class="capability-label">{{ t('caps.thinking') }}</span>
              <OptionChips
                :options="THINKING_LEVELS"
                :labels="thinkingLabels"
                :model-value="model.thinkingLevels"
                @toggle="(level, enabled) => setThinking(level, enabled)"
              />
            </div>

            <div class="form-grid">
              <label class="field">
                <span>{{ t('editor.context') }} <span class="req">*</span></span>
                <input
                  type="number"
                  min="1"
                  :value="model.contextWindow ?? ''"
                  placeholder="262144"
                  @input="setNumber('contextWindow', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="field">
                <span>{{ t('editor.maxOutput') }} <span class="req">*</span></span>
                <input
                  type="number"
                  min="1"
                  :value="model.maxOutput ?? ''"
                  placeholder="32768"
                  @input="setNumber('maxOutput', ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </article>
</template>
