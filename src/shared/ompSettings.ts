import { asPromptAction, asRecord, asString, type AgentPromptAction } from './agentPlugin'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  DEFAULT_MODEL_MAX_OUTPUT,
  isProviderKey,
  THINKING_LEVELS,
  type ThinkingLevel
} from './provider'

export const OMP_APIS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai'
] as const
export type OmpApi = (typeof OMP_APIS)[number]

export const OMP_INPUTS = ['text', 'image'] as const
export type OmpInput = (typeof OMP_INPUTS)[number]

export const OMP_THINKING_EFFORTS = THINKING_LEVELS.filter((level) => level !== 'off')

export function isOmpApi(value: string): value is OmpApi {
  return (OMP_APIS as readonly string[]).includes(value)
}

export function sanitizeOmpInput(value: unknown): OmpInput[] {
  if (!Array.isArray(value)) return ['text']
  const allowed = OMP_INPUTS.filter((item) => value.includes(item))
  return allowed.length > 0 ? allowed : ['text']
}

export function toggleOmpInput(list: string[], type: OmpInput): OmpInput[] {
  const current = sanitizeOmpInput(list)
  const enabled = new Set(current)
  if (enabled.has(type)) {
    if (enabled.size === 1) return current
    enabled.delete(type)
  } else {
    enabled.add(type)
  }
  return OMP_INPUTS.filter((item) => enabled.has(item))
}

export function joinOmpDefault(provider: string, model: string): string {
  const route = provider.trim()
  const id = model.trim()
  if (!route) return id
  if (!id) return route
  return `${route}/${id}`
}

export function splitOmpDefault(value: string): { provider: string; model: string } {
  const raw = value.trim()
  const index = raw.indexOf('/')
  if (index <= 0) return { provider: raw, model: '' }
  return { provider: raw.slice(0, index), model: raw.slice(index + 1) }
}

export function isOmpEditableKey(key: string, originalKey: string): boolean {
  const value = key.trim()
  if (!value) return false
  if (originalKey.trim() && originalKey.trim() === value) return true
  return isProviderKey(value)
}

export interface OmpCatalogRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  thinkingLevels: ThinkingLevel[]
  input: string[]
}

export interface OmpProviderView {
  id: string
  key: string
  originalKey: string
  api: string
  apiKey: string
  baseUrl: string
  models: OmpCatalogRow[]
  customHeaders: { key: string; value: string }[]
}

export interface OmpSettingsView {
  defaultModel: string
  thinkingLevel: string
  providers: OmpProviderView[]
}

export interface OmpLoadResult {
  exists: boolean
  path: string
  settings: OmpSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface OmpSavePayload {
  settings: OmpSettingsView
  prompt: AgentPromptAction
}

export function emptyOmpCatalogRow(partial: Partial<OmpCatalogRow> = {}): OmpCatalogRow {
  const row: OmpCatalogRow = {
    id: crypto.randomUUID(),
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    thinkingLevels: [],
    input: ['text'],
    ...partial
  }
  row.input = sanitizeOmpInput(row.input)
  return row
}

export function emptyOmpProvider(partial: Partial<OmpProviderView> = {}): OmpProviderView {
  const key = partial.key?.trim() || ''
  return {
    id: crypto.randomUUID(),
    key,
    originalKey: key,
    api: 'openai-completions',
    apiKey: '',
    baseUrl: '',
    models: [],
    customHeaders: [],
    ...partial
  }
}

export function emptyOmpSettings(): OmpSettingsView {
  return {
    defaultModel: '',
    thinkingLevel: '',
    providers: []
  }
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

function levelsFromThinking(entry: Record<string, unknown>): ThinkingLevel[] {
  const thinking = asRecord(entry.thinking)
  const raw = thinking?.efforts ?? thinking?.levels
  if (!Array.isArray(raw)) return []
  return OMP_THINKING_EFFORTS.filter((level) => raw.includes(level))
}

function catalogFromModels(models: unknown): OmpCatalogRow[] {
  if (!Array.isArray(models)) return []
  return models.flatMap((raw) => {
    const entry = asRecord(raw)
    if (!entry) return []
    const id = asString(entry.id).trim()
    if (!id) return []
    return [
      emptyOmpCatalogRow({
        model: id,
        displayName: asString(entry.name),
        contextWindow: asString(entry.contextWindow),
        maxOutput: asString(entry.maxTokens),
        thinkingLevels: levelsFromThinking(entry),
        input: sanitizeOmpInput(entry.input)
      })
    ]
  })
}

function sanitizeHeaders(value: unknown): { key: string; value: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as { key?: unknown; value?: unknown }
    const key = asString(row.key).trim()
    if (!key) return []
    return [{ key, value: asString(row.value) }]
  })
}

function sanitizeCatalog(value: unknown): OmpCatalogRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    if (!row || typeof row !== 'object') return emptyOmpCatalogRow()
    const entry = row as Partial<OmpCatalogRow>
    return emptyOmpCatalogRow({
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
      input: sanitizeOmpInput(entry.input)
    })
  })
}

function defaultModelFromConfig(configFile: unknown): string {
  const root = asRecord(configFile) ?? {}
  const roles = asRecord(root.modelRoles) ?? {}
  return asString(roles.default).replace(/:(minimal|low|medium|high|xhigh|max|auto)$/, '')
}

function thinkingFromConfig(configFile: unknown): string {
  const root = asRecord(configFile) ?? {}
  const value = asString(root.defaultThinkingLevel).trim()
  if (value === 'auto') return ''
  return (THINKING_LEVELS as readonly string[]).includes(value) ? value : ''
}

export function parseOmpSettings(modelsFile: unknown, configFile: unknown = {}): OmpSettingsView {
  const root = asRecord(modelsFile) ?? {}
  const nodes = asRecord(root.providers) ?? {}
  const providers = Object.entries(nodes).map(([key, node]) => {
    const entry = asRecord(node) ?? {}
    const apiRaw = asString(entry.api)
    return emptyOmpProvider({
      key,
      originalKey: key,
      api: apiRaw || 'openai-completions',
      apiKey: asString(entry.apiKey),
      baseUrl: asString(entry.baseUrl),
      models: catalogFromModels(entry.models),
      customHeaders: headerPairs(entry.headers)
    })
  })
  return {
    defaultModel: defaultModelFromConfig(configFile),
    thinkingLevel: thinkingFromConfig(configFile),
    providers
  }
}

export function sanitizeOmpSettings(value: unknown): OmpSettingsView {
  if (!value || typeof value !== 'object') return emptyOmpSettings()
  const item = value as Partial<OmpSettingsView>
  const providers = Array.isArray(item.providers)
    ? item.providers.map((row) => {
        if (!row || typeof row !== 'object') return emptyOmpProvider()
        const entry = row as Partial<OmpProviderView>
        const key = asString(entry.key).trim()
        const apiRaw = asString(entry.api)
        return emptyOmpProvider({
          id: asString(entry.id) || crypto.randomUUID(),
          key,
          originalKey: asString(entry.originalKey).trim() || key,
          api: apiRaw || 'openai-completions',
          apiKey: asString(entry.apiKey),
          baseUrl: asString(entry.baseUrl),
          models: sanitizeCatalog(entry.models),
          customHeaders: sanitizeHeaders(entry.customHeaders)
        })
      })
    : []
  return {
    defaultModel: asString(item.defaultModel),
    thinkingLevel: asString(item.thinkingLevel),
    providers
  }
}

export function sanitizeOmpSavePayload(value: unknown): OmpSavePayload {
  const item = asRecord(value) ?? {}
  return {
    settings: sanitizeOmpSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}

export function assertOmpSave(view: OmpSettingsView): void {
  const keys: string[] = []
  for (const item of view.providers) {
    const key = item.key.trim()
    if (!isOmpEditableKey(key, item.originalKey)) {
      throw new Error(key ? `Provider id "${key}" is invalid` : 'Every provider needs a provider id')
    }
    if (keys.includes(key)) throw new Error(`Provider id "${key}" is duplicated`)
    keys.push(key)
    if (!item.baseUrl.trim()) throw new Error(`Provider "${key}" needs a Base URL`)
    if (!item.models.some((row) => row.model.trim())) {
      throw new Error(`Provider "${key}" needs at least one model`)
    }
  }
}

function thinkingFor(levels: ThinkingLevel[]): Record<string, unknown> | undefined {
  const efforts = OMP_THINKING_EFFORTS.filter((level) => levels.includes(level))
  if (efforts.length === 0) return undefined
  return {
    mode: 'effort',
    efforts,
    defaultLevel: efforts.at(-1)
  }
}

function buildModels(rows: OmpCatalogRow[], previous: unknown): Record<string, unknown>[] {
  const prevModels = Array.isArray(previous) ? previous : []
  const prevById = new Map<string, Record<string, unknown>>()
  for (const item of prevModels) {
    const record = asRecord(item)
    const id = asString(record?.id).trim()
    if (record && id && !prevById.has(id)) prevById.set(id, record)
  }
  const seen = new Set<string>()
  const models: Record<string, unknown>[] = []
  for (const row of rows) {
    const id = row.model.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const prevModel = prevById.get(id) ?? {}
    const context = Number(row.contextWindow)
    const maxTokens = Number(row.maxOutput)
    const nextModel: Record<string, unknown> = {
      ...prevModel,
      id,
      name: row.displayName.trim() || id,
      contextWindow:
        Number.isFinite(context) && context > 0 ? context : DEFAULT_MODEL_CONTEXT_WINDOW,
      maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MODEL_MAX_OUTPUT,
      input: sanitizeOmpInput(row.input)
    }
    const thinking = thinkingFor(row.thinkingLevels)
    if (thinking) {
      nextModel.reasoning = true
      nextModel.thinking = thinking
    } else {
      nextModel.reasoning = false
      delete nextModel.thinking
    }
    models.push(nextModel)
  }
  return models
}

export interface OmpAppliedSections {
  providers: Record<string, Record<string, unknown>>
  removed: string[]
  defaultModel: string
  thinkingLevel: string
}

export function applyOmpSections(
  existing: Record<string, unknown>,
  view: OmpSettingsView
): OmpAppliedSections {
  assertOmpSave(view)
  const previous = asRecord(existing.providers) ?? {}
  const providers: Record<string, Record<string, unknown>> = {}
  const keep = new Set<string>()
  for (const item of view.providers) {
    const slug = item.key.trim()
    keep.add(slug)
    const prev = asRecord(previous[item.originalKey]) ?? asRecord(previous[slug]) ?? {}
    const profile: Record<string, unknown> = { ...prev }
    profile.api = item.api.trim() || 'openai-completions'
    profile.baseUrl = item.baseUrl.trim().replace(/\/+$/, '')
    profile.models = buildModels(item.models, prev.models)
    if (item.apiKey.trim()) {
      profile.apiKey = item.apiKey.trim()
      profile.authHeader = true
      if (asString(profile.auth) !== 'oauth') profile.auth = 'apiKey'
    } else {
      delete profile.apiKey
      if (asString(profile.auth) !== 'oauth') profile.auth = 'none'
    }
    const headers = Object.fromEntries(
      item.customHeaders.map((entry) => [entry.key.trim(), entry.value] as const).filter(([name]) => name)
    )
    if (Object.keys(headers).length > 0) profile.headers = headers
    else delete profile.headers
    providers[slug] = profile
  }
  const removed = Object.keys(previous).filter((key) => !keep.has(key))
  const parsed = splitOmpDefault(view.defaultModel)
  const fallback = view.providers[0]
  const provider = parsed.provider || fallback?.key.trim() || ''
  const model = parsed.model || fallback?.models.find((row) => row.model.trim())?.model.trim() || ''
  const thinking = view.thinkingLevel.trim()
  return {
    providers,
    removed,
    defaultModel: joinOmpDefault(provider, model),
    thinkingLevel:
      thinking && (OMP_THINKING_EFFORTS as readonly string[]).includes(thinking) ? thinking : ''
  }
}
