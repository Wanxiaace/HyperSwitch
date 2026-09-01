import { computed } from 'vue'
import { useLocaleStore } from '@/stores/locale'
import type { Modality, ThinkingLevel } from '@shared/provider'

export function useI18nLabels() {
  const { t } = useLocaleStore()

  const modalityLabels = computed<Record<Modality, string>>(() => ({
    text: t('modality.text'),
    image: t('modality.image'),
    audio: t('modality.audio'),
    video: t('modality.video')
  }))

  const thinkingLabels = computed<Record<ThinkingLevel, string>>(() => ({
    off: t('thinking.off'),
    minimal: t('thinking.minimal'),
    low: t('thinking.low'),
    medium: t('thinking.medium'),
    high: t('thinking.high'),
    xhigh: t('thinking.xhigh'),
    max: t('thinking.max')
  }))

  return { t, modalityLabels, thinkingLabels }
}
