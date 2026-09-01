export interface PromptPreset {
  id: string
  name: string
  description: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface HeaderEntry {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface HeaderPreset {
  id: string
  name: string
  description: string
  headers: HeaderEntry[]
  createdAt: string
  updatedAt: string
}

function now(): string {
  return new Date().toISOString()
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function emptyPromptPreset(partial: Partial<PromptPreset> = {}): PromptPreset {
  const created = now()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled',
    description: '',
    content: '',
    createdAt: created,
    updatedAt: created,
    ...partial
  }
}

export const DEFAULT_USER_AGENT = 'claude-cli/2.1.161 (external, cli)'

export function emptyHeaderEntry(partial: Partial<HeaderEntry> = {}): HeaderEntry {
  return {
    id: crypto.randomUUID(),
    key: '',
    value: '',
    enabled: true,
    ...partial
  }
}

export function defaultHeaderEntries(): HeaderEntry[] {
  return [
    emptyHeaderEntry({
      key: 'User-Agent',
      value: DEFAULT_USER_AGENT
    })
  ]
}

export function emptyHeaderPreset(partial: Partial<HeaderPreset> = {}): HeaderPreset {
  const created = now()
  const { headers: incoming, ...rest } = partial
  return {
    id: crypto.randomUUID(),
    name: 'Untitled',
    description: '',
    createdAt: created,
    updatedAt: created,
    ...rest,
    headers: (incoming ?? defaultHeaderEntries()).map((entry) => emptyHeaderEntry(entry))
  }
}

export function enabledHeaderPairs(preset: HeaderPreset): { key: string; value: string }[] {
  return preset.headers
    .filter((entry) => entry.enabled && entry.key.trim())
    .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
}

function asPromptPreset(value: unknown): PromptPreset | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<PromptPreset>
  if (typeof item.id !== 'string' || !item.id) return null
  return emptyPromptPreset({
    id: item.id,
    name: asString(item.name, 'Untitled'),
    description: asString(item.description),
    content: asString(item.content),
    createdAt: asString(item.createdAt, now()),
    updatedAt: asString(item.updatedAt, now())
  })
}

function asHeaderEntry(value: unknown): HeaderEntry | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<HeaderEntry> & { name?: unknown }
  const key = asString(item.key) || asString(item.name)
  return emptyHeaderEntry({
    id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
    key,
    value: asString(item.value),
    enabled: item.enabled !== false
  })
}

function asHeaderPreset(value: unknown): HeaderPreset | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<HeaderPreset>
  if (typeof item.id !== 'string' || !item.id) return null
  const headers = Array.isArray(item.headers)
    ? item.headers.map(asHeaderEntry).filter((entry): entry is HeaderEntry => entry !== null)
    : []
  return emptyHeaderPreset({
    id: item.id,
    name: asString(item.name, 'Untitled'),
    description: asString(item.description),
    headers,
    createdAt: asString(item.createdAt, now()),
    updatedAt: asString(item.updatedAt, now())
  })
}

export function normalizePromptPresets(value: unknown): PromptPreset[] {
  if (!Array.isArray(value)) return []
  return value.map(asPromptPreset).filter((item): item is PromptPreset => item !== null)
}

export function normalizeHeaderPresets(value: unknown): HeaderPreset[] {
  if (!Array.isArray(value)) return []
  return value.map(asHeaderPreset).filter((item): item is HeaderPreset => item !== null)
}

export function promptPreview(preset: PromptPreset): string {
  const description = preset.description.trim()
  if (description) return description
  const content = preset.content.replace(/\s+/g, ' ').trim()
  if (content) return content.length > 48 ? `${content.slice(0, 48)}…` : content
  return ''
}

export function headerPreview(preset: HeaderPreset): string {
  const keys = preset.headers.map((entry) => entry.key.trim()).filter(Boolean)
  if (keys.length === 0) return ''
  return keys.slice(0, 3).join(' · ')
}
