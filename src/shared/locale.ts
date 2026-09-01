export const APP_LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'

export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  en: 'en',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de'
}

export const LOCALE_OPTIONS: { value: AppLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' }
]

export interface AppPrefs {
  locale: AppLocale
}

export function emptyPrefs(): AppPrefs {
  return { locale: DEFAULT_LOCALE }
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

export function normalizePrefs(value: unknown): AppPrefs {
  if (!value || typeof value !== 'object') return emptyPrefs()
  const locale = (value as { locale?: unknown }).locale
  return { locale: isAppLocale(locale) ? locale : DEFAULT_LOCALE }
}
