import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  DEFAULT_LOCALE,
  LOCALE_HTML_LANG,
  LOCALE_OPTIONS,
  isAppLocale,
  type AppLocale
} from '@shared/locale'
import { setActiveLocale, t as translate } from '@/i18n'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(DEFAULT_LOCALE)
  const hydrated = ref(false)

  const options = computed(() => LOCALE_OPTIONS)
  const htmlLang = computed(() => LOCALE_HTML_LANG[locale.value])

  function apply(next: AppLocale): void {
    locale.value = next
    setActiveLocale(next)
  }

  function t(key: string, params?: Record<string, string | number>): string {
    void locale.value
    return translate(key, params)
  }

  async function hydrate(): Promise<void> {
    if (!window.hyper?.loadPrefs) {
      apply(DEFAULT_LOCALE)
      hydrated.value = true
      return
    }
    try {
      const prefs = await window.hyper.loadPrefs()
      apply(isAppLocale(prefs.locale) ? prefs.locale : DEFAULT_LOCALE)
    } catch {
      apply(DEFAULT_LOCALE)
    } finally {
      hydrated.value = true
    }
  }

  async function setLocale(next: string): Promise<void> {
    if (!isAppLocale(next) || next === locale.value) return
    apply(next)
    if (!window.hyper?.savePrefs) return
    await window.hyper.savePrefs({ locale: next })
  }

  return { locale, hydrated, options, htmlLang, t, hydrate, setLocale }
})
