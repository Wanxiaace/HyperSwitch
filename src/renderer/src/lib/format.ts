import { t, localeTag } from '@/i18n'

export function formatCatalogStamp(updatedAt: string, count: number): string {
  if (!updatedAt) return t('catalog.never')
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return t('catalog.never')
  return t('catalog.stamp', { time: date.toLocaleString(localeTag()), count })
}

export function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000
    return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}M`
  }
  if (value >= 1000) {
    const scaled = value / 1000
    return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}K`
  }
  return String(value)
}

export function fetchModelsErrorMessage(error: string): string {
  if (error.includes('HTTP 401') || error.includes('HTTP 403')) {
    return t('fetch.auth')
  }
  if (error.includes('All candidates failed') || error.includes('HTTP 404') || error.includes('HTTP 405')) {
    return t('fetch.notFound')
  }
  if (error.toLowerCase().includes('timeout') || error.toLowerCase().includes('timed out')) {
    return t('fetch.timeout')
  }
  if (error.includes('Failed to parse')) {
    return t('fetch.parse')
  }
  if (error.includes('Base URL is empty')) {
    return t('fetch.emptyUrl')
  }
  if (error.includes('API Key')) {
    return t('fetch.emptyKey')
  }
  return t('fetch.failed')
}
