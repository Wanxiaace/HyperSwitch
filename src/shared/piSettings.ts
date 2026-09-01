import { asPromptAction, asRecord, asString, slugify, type AgentPromptAction } from './agentPlugin'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  DEFAULT_MODEL_MAX_OUTPUT,
  THINKING_LEVELS,
  type ApiFormat,
  type ThinkingLevel
} from './provider'

export const PI_INPUTS = ['text', 'image'] as const
export type PiInput = (typeof PI_INPUTS)[number]

export function sanitizePiInput(value: unknown): PiInput[] {
  if (!Array.isArray(value)) return ['text']
  const allowed = PI_INPUTS.filter((item) => value.includes(item))
  return allowed.length > 0 ? allowed : ['text']
}

export function togglePiInput(list: string[], type: PiInput): PiInput[] {
  const current = sanitizePiInput(list)
  const enabled = new Set(current)
  if (enabled.has(type)) {
    if (enabled.size === 1) return current
    enabled.delete(type)
  } else {
    enabled.add(type)
  }
  return PI_INPUTS.filter((item) => enabled.has(item))
}

export interface PiCatalogRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  thinkingLevels: ThinkingLevel[]
  input: string[]
}

export interface PiSettingsView {
  providerKey: string
  providerName: string
  api: ApiFormat
  apiKey: string
  baseUrl: string
  model: string
  thinkingLevel: string
  catalog: PiCatalogRow[]
  customHeaders: { key: string; value: string }[]
}

export interface PiLoadResult {
  exists: boolean
  path: string
  settings: PiSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface PiSavePayload {
  settings: PiSettingsView
  prompt: AgentPromptAction
}

export function emptyPiCatalogRow(partial: Partial<PiCatalogRow> = {}): PiCatalogRow {
  const row: PiCatalogRow = {
    id: crypto.randomUUID(),
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    thinkingLevels: [],
    input: ['text'],
    ...partial
  }
  row.input = sanitizePiInput(row.input)
  return row
}

export function emptyPiSettings(): PiSettingsView {
  return {
    providerKey: 'custom',
    providerName: '',
    api: 'openai-completions',
    apiKey: '',
    baseUrl: '',
    model: '',
    thinkingLevel: '',
    catalog: [],
    customHeaders: []
  }
}

export function thinkingMapFromLevels(levels: ThinkingLevel[]): Record<string, string | null> {
  const enabled = new Set(levels)
  const map: Record<string, string | null> = {}
  for (const level of THINKING_LEVELS) {
    map[level] = enabled.has(level) ? level : null
  }
  return map
}

export function levelsFromThinkingMap(value: unknown): ThinkingLevel[] {
  const record = asRecord(value)
  if (!record) return []
  return THINKING_LEVELS.filter((level) => {
    const item = record[level]
    return typeof item === 'string' && item.trim().length > 0
  })
}

export function piProviderKey(name: string, fallback = 'custom'): string {
  return slugify(name, fallback)
}

function headerPairs(value: unknown): { key: string; value: string }[] {
  const record = asRecord(value)
  if (!record) return []
  return Object.entries(record).flatMap(([key, item]) => {
    const name = key.trim()
    if (!name) return []
    return [{ key: name, value: asString(item) }]
  })
}

function catalogFromModels(models: unknown): PiCatalogRow[] {
  if (!Array.isArray(models)) return []
  return models.flatMap((raw) => {
    const entry = asRecord(raw)
    if (!entry) return []
    const id = asString(entry.id).trim()
    if (!id) return []
    return [
      emptyPiCatalogRow({
        model: id,
        displayName: asString(entry.name),
        contextWindow: asString(entry.contextWindow),
        maxOutput: asString(entry.maxTokens),
        thinkingLevels: levelsFromThinkingMap(entry.thinkingLevelMap),
        input: sanitizePiInput(entry.input)
      })
    ]
  })
}

export function parsePiSettings(
  modelsFile: unknown,
  settingsFile: unknown,
  preferredKey = ''
): PiSettingsView {
  const root = asRecord(modelsFile) ?? {}
  const providers = asRecord(root.providers) ?? {}
  const settings = asRecord(settingsFile) ?? {}
  const defaultProvider = asString(settings.defaultProvider)
  const providerKey =
    (preferredKey && providers[preferredKey] ? preferredKey : '') ||
    (defaultProvider && providers[defaultProvider] ? defaultProvider : '') ||
    Object.keys(providers)[0] ||
    'custom'
  const node = asRecord(providers[providerKey]) ?? {}
  const apiRaw = asString(node.api) || 'openai-completions'
  const api: ApiFormat =
    apiRaw === 'openai-responses' ||
    apiRaw === 'anthropic-messages' ||
    apiRaw === 'google-generative-ai'
      ? apiRaw
      : 'openai-completions'
  return {
    providerKey,
    providerName: asString(node.name),
    api,
    apiKey: asString(node.apiKey),
    baseUrl: asString(node.baseUrl),
    model: asString(settings.defaultModel),
    thinkingLevel: asString(settings.defaultThinkingLevel),
    catalog: catalogFromModels(node.models),
    customHeaders: headerPairs(node.headers)
  }
}

export function sanitizePiSettings(value: unknown): PiSettingsView {
  if (!value || typeof value !== 'object') return emptyPiSettings()
  const item = value as Partial<PiSettingsView>
  const apiRaw = asString(item.api)
  const catalog = Array.isArray(item.catalog)
    ? item.catalog.map((row) => {
        if (!row || typeof row !== 'object') return emptyPiCatalogRow()
        const entry = row as Partial<PiCatalogRow>
        return emptyPiCatalogRow({
          id: asString(entry.id) || crypto.randomUUID(),
          model: asString(entry.model),
          displayName: asString(entry.displayName),
          contextWindow: asString(entry.contextWindow).replace(/[^\d]/g, ''),
          maxOutput: asString(entry.maxOutput).replace(/[^\d]/g, ''),
          thinkingLevels: Array.isArray(entry.thinkingLevels)
            ? entry.thinkingLevels.filter((level): level is ThinkingLevel =>
                (THINKING_LEVELS as readonly string[]).includes(level as string)
              )
            : [],
          input: sanitizePiInput(entry.input)
        })
      })
    : []
  const customHeaders = Array.isArray(item.customHeaders)
    ? item.customHeaders.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const row = entry as { key?: unknown; value?: unknown }
        const key = asString(row.key).trim()
        if (!key) return []
        return [{ key, value: asString(row.value) }]
      })
    : []
  return {
    providerKey: asString(item.providerKey).trim() || 'custom',
    providerName: asString(item.providerName),
    api:
      apiRaw === 'openai-responses' ||
      apiRaw === 'anthropic-messages' ||
      apiRaw === 'google-generative-ai'
        ? apiRaw
        : 'openai-completions',
    apiKey: asString(item.apiKey),
    baseUrl: asString(item.baseUrl),
    model: asString(item.model),
    thinkingLevel: asString(item.thinkingLevel),
    catalog,
    customHeaders
  }
}

export function sanitizePiSavePayload(value: unknown): PiSavePayload {
  const item = asRecord(value) ?? {}
  return {
    settings: sanitizePiSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}

export function applyPiModelsFile(
  existing: Record<string, unknown>,
  view: PiSettingsView
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing }
  const providers = { ...(asRecord(next.providers) ?? {}) }
  const key = view.providerKey.trim() || 'custom'
  const prev = asRecord(providers[key]) ?? {}
  const prevModels = Array.isArray(prev.models) ? prev.models : []
  const prevById = new Map<string, Record<string, unknown>>()
  for (const item of prevModels) {
    const record = asRecord(item)
    const id = asString(record?.id).trim()
    if (record && id) prevById.set(id, record)
  }
  const models = view.catalog.flatMap((row) => {
    const id = row.model.trim()
    if (!id) return []
    const prevModel = prevById.get(id) ?? {}
    const context = Number(row.contextWindow)
    const maxTokens = Number(row.maxOutput)
    const nextModel: Record<string, unknown> = {
      ...prevModel,
      id,
      name: row.displayName.trim() || id
    }
    nextModel.contextWindow =
      Number.isFinite(context) && context > 0 ? context : DEFAULT_MODEL_CONTEXT_WINDOW
    nextModel.maxTokens =
      Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MODEL_MAX_OUTPUT
    nextModel.input = sanitizePiInput(row.input)
    nextModel.reasoning = row.thinkingLevels.some((level) => level !== 'off')
    nextModel.thinkingLevelMap = thinkingMapFromLevels(row.thinkingLevels)
    return [nextModel]
  })
  const node: Record<string, unknown> = {
    ...prev,
    name: view.providerName.trim() || key,
    baseUrl: view.baseUrl.trim().replace(/\/+$/, ''),
    api: view.api,
    models
  }
  if (view.apiKey.trim()) node.apiKey = view.apiKey.trim()
  else delete node.apiKey
  if (view.customHeaders.length > 0) {
    node.headers = Object.fromEntries(
      view.customHeaders.map((entry) => [entry.key.trim(), entry.value])
    )
  } else {
    delete node.headers
  }
  providers[key] = node
  next.providers = providers
  return next
}

export function applyPiSettingsFile(
  existing: Record<string, unknown>,
  view: PiSettingsView
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing }
  const key = view.providerKey.trim()
  const model = view.model.trim()
  if (key) next.defaultProvider = key
  else delete next.defaultProvider
  if (model) next.defaultModel = model
  else delete next.defaultModel
  if (view.thinkingLevel.trim()) next.defaultThinkingLevel = view.thinkingLevel.trim()
  else delete next.defaultThinkingLevel
  return next
}
