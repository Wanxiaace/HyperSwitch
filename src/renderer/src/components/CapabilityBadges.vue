<script setup lang="ts">
import { computed } from 'vue'
import HoverTip from '@/components/HoverTip.vue'
import { useLocaleStore } from '@/stores/locale'
import { type Modality, type ThinkingLevel } from '@shared/provider'

const { t } = useLocaleStore()

const props = defineProps<{
  input: Modality[]
  output: Modality[]
  thinkingLevels: ThinkingLevel[]
  size?: 'sm' | 'md'
}>()

function extra(list: Modality[]): Modality[] {
  return list.filter((item) => item !== 'text')
}

const hasVision = computed(() => extra(props.input).length > 0)
const hasThinking = computed(() => props.thinkingLevels.length > 0)
const hasRichOutput = computed(() => extra(props.output).length > 0)

function modalityTip(kind: 'input' | 'output', list: Modality[]): string {
  return t('caps.modalityList', {
    kind: t(`caps.${kind}`),
    list: list.map((item) => t(`modality.${item}`)).join(' / ')
  })
}

const thinkingTip = computed(() =>
  t('caps.thinkingList', {
    list: props.thinkingLevels.map((level) => t(`thinking.${level}`)).join(' / ')
  })
)
</script>

<template>
  <div class="model-card-caps" :class="{ compact: size === 'sm' }">
    <HoverTip v-if="hasVision" :text="modalityTip('input', input)">
      <span class="cap-badge cap-eye" :aria-label="t('caps.vision')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
    </HoverTip>
    <HoverTip v-if="hasThinking" :text="thinkingTip">
      <span class="cap-badge cap-think" :aria-label="t('caps.thinkingAria')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 1 3.8 10.6c-.7.6-1.3 1.6-1.3 2.4H9.5c0-.8-.6-1.8-1.3-2.4A6 6 0 0 1 12 3Z" />
        </svg>
      </span>
    </HoverTip>
    <HoverTip v-if="hasRichOutput" :text="modalityTip('output', output)">
      <span class="cap-badge cap-output" :aria-label="t('caps.richOutput')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 3.2a8.8 8.8 0 1 0 2.2 17.3 2.4 2.4 0 0 0 2.2-3.4 1.9 1.9 0 0 1 1.9-2.6h.2a3 3 0 0 0 0-6A8.8 8.8 0 0 0 12 3.2Z" />
          <circle cx="7.8" cy="10.2" r="1.1" fill="currentColor" />
          <circle cx="10.8" cy="7.6" r="1.1" fill="currentColor" />
          <circle cx="14.6" cy="8" r="1.1" fill="currentColor" />
          <circle cx="8.6" cy="13.8" r="1.1" fill="currentColor" />
        </svg>
      </span>
    </HoverTip>
  </div>
</template>
