import type { AppLocale } from '@shared/locale'
import { DEFAULT_LOCALE, LOCALE_HTML_LANG } from '@shared/locale'
import { de } from './de'
import { en, type Messages } from './en'
import { es } from './es'
import { fr } from './fr'
import { ja } from './ja'
import { ko } from './ko'
import { zh } from './zh'
import { zhTW } from './zh-TW'

export type { Messages }

const catalogs: Record<AppLocale, Messages> = {
  en,
  zh,
  'zh-TW': zhTW,
  ja,
  ko,
  es,
  fr,
  de
}

let current: AppLocale = DEFAULT_LOCALE

export function setActiveLocale(locale: AppLocale): void {
  current = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LOCALE_HTML_LANG[locale]
  }
}

export function activeLocale(): AppLocale {
  return current
}

export function localeTag(locale: AppLocale = current): string {
  return LOCALE_HTML_LANG[locale]
}

function lookup(tree: unknown, path: string): string | undefined {
  let node: unknown = tree
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

export function translate(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] == null ? `{${name}}` : String(params[name])
  )
}

export function t(key: string, params?: Record<string, string | number>): string {
  return translate(current, key, params)
}
