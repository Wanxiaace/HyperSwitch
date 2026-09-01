import {
  sanitizeModalities,
  sanitizeThinkingLevels,
  type Modality,
  type ThinkingLevel
} from './provider'

export interface CatalogModel {
  id: string
  name: string
  provider: string
  contextWindow: number | null
  maxOutput: number | null
  input: Modality[]
  output: Modality[]
  thinkingLevels: ThinkingLevel[]
}

export interface CatalogFile {
  version: 1
  updatedAt: string
  models: CatalogModel[]
}

export const MODELS_DEV_URL = 'https://models.dev/api.json'

export function emptyCatalog(): CatalogFile {
  return { version: 1, updatedAt: '', models: [] }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function thinkingFromEntry(entry: Record<string, unknown>): ThinkingLevel[] {
  const options = entry.reasoning_options
  if (Array.isArray(options)) {
    for (const option of options) {
      const record = asRecord(option)
      if (record?.type === 'effort' && Array.isArray(record.values)) {
        return sanitizeThinkingLevels(record.values)
      }
    }
  }
  if (entry.reasoning === true) return ['minimal', 'low', 'medium', 'high']
  return []
}

export function parseModelsDev(data: unknown): CatalogModel[] {
  const root = asRecord(data)
  if (!root) return []
  const models: CatalogModel[] = []
  for (const provider of Object.values(root)) {
    const providerRecord = asRecord(provider)
    if (!providerRecord) continue
    const providerId = typeof providerRecord.id === 'string' ? providerRecord.id : ''
    const providerName = typeof providerRecord.name === 'string' ? providerRecord.name : providerId
    const nested = asRecord(providerRecord.models)
    if (!nested) continue
    for (const raw of Object.values(nested)) {
      const entry = asRecord(raw)
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) continue
      const limit = asRecord(entry.limit)
      const modalities = asRecord(entry.modalities)
      models.push({
        id: entry.id.trim(),
        name: typeof entry.name === 'string' ? entry.name : entry.id,
        provider: providerName,
        contextWindow: asNumber(limit?.context),
        maxOutput: asNumber(limit?.output),
        input: sanitizeModalities(modalities?.input ?? ['text']),
        output: sanitizeModalities(modalities?.output ?? ['text']),
        thinkingLevels: thinkingFromEntry(entry)
      })
    }
  }
  return models
}

export function lookupCatalogModel(models: CatalogModel[], id: string): CatalogModel | undefined {
  const raw = id.trim().toLowerCase()
  if (!raw) return undefined
  const last = raw.split(/[/:]/).filter(Boolean).pop() ?? raw
  const exact = models.find((item) => item.id.toLowerCase() === raw)
  if (exact) return exact
  if (last !== raw) {
    const byTail = models.find((item) => item.id.toLowerCase() === last)
    if (byTail) return byTail
  }
  return models.find((item) => {
    const catalogId = item.id.toLowerCase()
    const catalogTail = catalogId.split(/[/:]/).filter(Boolean).pop() ?? catalogId
    return catalogTail === last
  })
}
