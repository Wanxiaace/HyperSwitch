<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SelectMenu from '@/components/SelectMenu.vue'
import { formatCatalogStamp } from '@/lib/format'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toasts'

const catalogStore = useCatalogStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const { t } = localeStore
const { locale, options: localeOptions } = storeToRefs(localeStore)
const { count, updatedAt, updating } = storeToRefs(catalogStore)

const visible = ref(false)
const step = ref<1 | 2 | 3>(1)
const finishing = ref(false)
const error = ref('')

const catalogHint = computed(() => {
  void locale.value
  return formatCatalogStamp(updatedAt.value, count.value)
})

onMounted(async () => {
  if (!window.hyper?.hasOnboarded) return
  try {
    if (await window.hyper.hasOnboarded()) return
  } catch {
    return
  }
  visible.value = true
})

async function refreshCatalog(): Promise<void> {
  error.value = ''
  const result = await catalogStore.update()
  if (!result.ok) {
    error.value = result.error
    toastStore.error(t('catalog.updateFailed', { error: result.error }))
    return
  }
  toastStore.success(t('catalog.updated', { count: result.count }))
  step.value = 3
}

async function finish(): Promise<void> {
  if (!window.hyper?.markOnboarded || finishing.value) return
  finishing.value = true
  try {
    await window.hyper.markOnboarded()
    visible.value = false
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : t('onboard.finishFailed'))
  } finally {
    finishing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="onboard">
      <div v-if="visible" class="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
        <div class="onboard-panel">
          <div class="onboard-progress" aria-hidden="true">
            <span class="onboard-dot" :class="{ on: step >= 1 }" />
            <span class="onboard-dot" :class="{ on: step >= 2 }" />
            <span class="onboard-dot" :class="{ on: step >= 3 }" />
          </div>
          <div class="onboard-kicker">{{ t('onboard.kicker', { step }) }}</div>

          <template v-if="step === 1">
            <h2 id="onboard-title" class="onboard-title">{{ t('onboard.languageTitle') }}</h2>
            <p class="onboard-desc">{{ t('onboard.languageDesc') }}</p>
            <div class="onboard-locale-menu">
              <SelectMenu :model-value="locale" :options="localeOptions" @update:model-value="localeStore.setLocale" />
            </div>
            <div class="onboard-actions">
              <button class="btn btn-primary" type="button" @click="step = 2">{{ t('onboard.next') }}</button>
            </div>
          </template>

          <template v-else-if="step === 2">
            <h2 id="onboard-title" class="onboard-title">{{ t('onboard.catalogTitle') }}</h2>
            <p class="onboard-desc">{{ t('onboard.catalogDesc') }}</p>
            <div class="onboard-status">{{ catalogHint }}</div>
            <p v-if="error" class="onboard-error">{{ error }}</p>
            <div class="onboard-actions">
              <button class="btn onboard-back" type="button" @click="step = 1">{{ t('common.back') }}</button>
              <button class="btn" type="button" @click="step = 3">{{ t('onboard.skip') }}</button>
              <button class="btn btn-primary" type="button" :disabled="updating" @click="refreshCatalog">
                {{ updating ? t('settings.updating') : t('settings.update') }}
              </button>
            </div>
          </template>

          <template v-else>
            <h2 id="onboard-title" class="onboard-title">{{ t('onboard.howTitle') }}</h2>
            <ol class="onboard-howto">
              <li>
                <span class="onboard-num">1</span>
                <span>{{ t('onboard.step1') }}</span>
              </li>
              <li>
                <span class="onboard-num">2</span>
                <span>{{ t('onboard.step2') }}</span>
              </li>
              <li>
                <span class="onboard-num">3</span>
                <span>{{ t('onboard.step3') }}</span>
              </li>
            </ol>
            <p class="onboard-desc">{{ t('onboard.later') }}</p>
            <div class="onboard-actions">
              <button class="btn onboard-back" type="button" @click="step = 2">{{ t('common.back') }}</button>
              <button class="btn btn-primary" type="button" :disabled="finishing" @click="finish">
                {{ finishing ? t('onboard.starting') : t('onboard.start') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
