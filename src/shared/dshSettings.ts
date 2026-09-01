import { asPromptAction, asRecord, asString, type AgentPromptAction } from './agentPlugin'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  DEFAULT_MODEL_MAX_OUTPUT,
  isProviderKey,
  THINKING_LEVELS,
  type ThinkingLevel
} from './provider'

export const DSH_APIS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const
export type DshApi = (typeof DSH_APIS)[number]

export const DSH_INPUTS = ['text', 'image'] as const
export type DshInput = (typeof DSH_INPUTS)[number]

export const DSH_RESERVED_ROUTES = ['deepseek-official'] as const

export function isDshApi(value: string): value is DshApi {
  return (DSH_APIS as readonly string[]).includes(value)
}

export function sanitizeDshInput(value: unknown): DshInput[] {
  if (!Array.isArray(value)) return ['text']
  const allowed = DSH_INPUTS.filter((item) => value.includes(item))
  return allowed.length > 0 ? allowed : ['text']
}

export function toggleDshInput(list: string[], type: DshInput): DshInput[] {
  const current = sanitizeDshInput(list)
  const enabled = new Set(current)
  if (enabled.has(type)) {
    if (enabled.size === 1) return current
    enabled.delete(type)
  } else {
    enabled.add(type)
  }
  return DSH_INPUTS.filter((item) => enabled.has(item))
}

export function dshApiKeyEnv(slug: string): string {
  const base = slug.trim().replace(/-/g, '_').toUpperCase() || 'CUSTOM'
  const name = `${base}_API_KEY`
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : 'HYPERSWITCH_API_KEY'
}

export function reasoningEffortsFromLevels(
  levels: ThinkingLevel[]
): Record<string, string | null> | undefined {
  const enabled = THINKING_LEVELS.filter((level) => levels.includes(level))
  if (enabled.length === 0) return undefined
  const efforts: Record<string, string | null> = {}
  for (const level of enabled) efforts[level] = level === 'off' ? null : level
  return efforts
}

export function levelsFromReasoningEfforts(value: unknown): ThinkingLevel[] {
  if (value === false || value == null) return []
  const record = asRecord(value)
  if (!record) return []
  return THINKING_LEVELS.filter((level) => Object.prototype.hasOwnProperty.call(record, level))
}

export function joinDshDefault(provider: string, model: string): string {
  const route = provider.trim()
  const id = model.trim()
  if (!route) return id
  if (!id) return route
  return `${route}/${id}`
}

export function splitDshDefault(value: string): { provider: string; model: string } {
  const raw = value.trim()
  const index = raw.indexOf('/')
  if (index <= 0) return { provider: raw, model: '' }
  return { provider: raw.slice(0, index), model: raw.slice(index + 1) }
}

export interface DshCatalogRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  thinkingLevels: ThinkingLevel[]
  input: string[]
}

export interface DshProviderView {
  id: string
  key: string
  originalKey: string
  displayName: string
  api: DshApi
  apiKey: string
  apiKeyEnv: string
  baseUrl: string
  models: DshCatalogRow[]
  customHeaders: { key: string; value: string }[]
}

export interface DshSettingsView {
  defaultModel: string
  thinkingLevel: string
  providers: DshProviderView[]
}

export interface DshLoadResult {
  exists: boolean
  path: string
  settings: DshSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface DshSavePayload {
  settings: DshSettingsView
  prompt: AgentPromptAction
}

export function emptyDshCatalogRow(partial: Partial<DshCatalogRow> = {}): DshCatalogRow {
  const row: DshCatalogRow = {
    id: crypto.randomUUID(),
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    thinkingLevels: [],
    input: ['text'],
    ...partial
  }
  row.input = sanitizeDshInput(row.input)
  return row
}

export function emptyDshProvider(partial: Partial<DshProviderView> = {}): DshProviderView {
  const key = partial.key?.trim() || ''
  return {
    id: crypto.randomUUID(),
    key,
    originalKey: key,
    displayName: '',
    api: 'openai-completions',
    apiKey: '',
    apiKeyEnv: key ? dshApiKeyEnv(key) : '',
    baseUrl: '',
    models: [],
    customHeaders: [],
    ...partial
  }
}

export function emptyDshSettings(): DshSettingsView {
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

function catalogFromModels(models: unknown): DshCatalogRow[] {
  if (!Array.isArray(models)) return []
  return models.flatMap((raw) => {
    const entry = asRecord(raw)
    if (!entry) return []
    const id = asString(entry.id).trim()
    if (!id) return []
    return [
      emptyDshCatalogRow({
        model: id,
        displayName: asString(entry.name),
        contextWindow: asString(entry.contextWindow),
        maxOutput: asString(entry.maxTokens),
        thinkingLevels: levelsFromReasoningEfforts(entry.reasoningEfforts),
        input: sanitizeDshInput(entry.input)
      })
    ]
  })
}

export function credentialValue(credentials: unknown, envName: string): string {
  const name = envName.trim()
  if (!name) return ''
  const root = asRecord(credentials)
  if (!root) return ''
  const refs = asRecord(root.refs)
  if (refs && typeof refs[name] === 'string') return refs[name]
  if (typeof root[name] === 'string') return root[name]
  return ''
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

function sanitizeCatalog(value: unknown): DshCatalogRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    if (!row || typeof row !== 'object') return emptyDshCatalogRow()
    const entry = row as Partial<DshCatalogRow>
    return emptyDshCatalogRow({
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
      input: sanitizeDshInput(entry.input)
    })
  })
}

export function parseDshSettings(
  settingsFile: unknown,
  credentialsFile: unknown = {}
): DshSettingsView {
  const root = asRecord(settingsFile) ?? {}
  const pi = asRecord(root['llm-pi-ai']) ?? {}
  const nodes = asRecord(pi.providers) ?? {}
  const providers = Object.entries(nodes).map(([key, node]) => {
    const entry = asRecord(node) ?? {}
    const apiRaw = asString(entry.api)
    const apiKeyEnv = asString(entry.apiKeyEnv).trim() || dshApiKeyEnv(key)
    return emptyDshProvider({
      key,
      originalKey: key,
      displayName: asString(entry.displayName),
      api: isDshApi(apiRaw) ? apiRaw : 'openai-completions',
      apiKey: credentialValue(credentialsFile, apiKeyEnv),
      apiKeyEnv,
      baseUrl: asString(entry.baseURL),
      models: catalogFromModels(entry.models),
      customHeaders: headerPairs(entry.headers)
    })
  })
  const defaultModel = asRecord(root['agent-default-model']) ?? {}
  return {
    defaultModel: joinDshDefault(asString(defaultModel.provider), asString(defaultModel.model)),
    thinkingLevel: asString(defaultModel.reasoningEffort),
    providers
  }
}

export function sanitizeDshSettings(value: unknown): DshSettingsView {
  if (!value || typeof value !== 'object') return emptyDshSettings()
  const item = value as Partial<DshSettingsView>
  const providers = Array.isArray(item.providers)
    ? item.providers.map((row) => {
        if (!row || typeof row !== 'object') return emptyDshProvider()
        const entry = row as Partial<DshProviderView>
        const key = asString(entry.key).trim()
        const apiRaw = asString(entry.api)
        return emptyDshProvider({
          id: asString(entry.id) || crypto.randomUUID(),
          key,
          originalKey: asString(entry.originalKey).trim() || key,
          displayName: asString(entry.displayName),
          api: isDshApi(apiRaw) ? apiRaw : 'openai-completions',
          apiKey: asString(entry.apiKey),
          apiKeyEnv: asString(entry.apiKeyEnv).trim() || (key ? dshApiKeyEnv(key) : ''),
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

export function sanitizeDshSavePayload(value: unknown): DshSavePayload {
  const item = asRecord(value) ?? {}
  return {
    settings: sanitizeDshSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}

export function assertDshSave(view: DshSettingsView): void {
  const keys: string[] = []
  for (const item of view.providers) {
    const key = item.key.trim()
    if (!isProviderKey(key)) throw new Error(key ? `Provider id "${key}" is invalid` : 'Every provider needs a provider id')
    if ((DSH_RESERVED_ROUTES as readonly string[]).includes(key)) {
      throw new Error(`${key} is an official route and cannot be written into llm-pi-ai`)
    }
    if (keys.includes(key)) throw new Error(`Provider id "${key}" is duplicated`)
    keys.push(key)
    if (!item.baseUrl.trim()) throw new Error(`Provider "${key}" needs a Base URL`)
    if (!item.models.some((row) => row.model.trim())) throw new Error(`Provider "${key}" needs at least one model`)
  }
}

function buildModels(
  rows: DshCatalogRow[],
  previous: unknown
): Record<string, unknown>[] {
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
      input: sanitizeDshInput(row.input)
    }
    const efforts = reasoningEffortsFromLevels(row.thinkingLevels)
    if (efforts) nextModel.reasoningEfforts = efforts
    else delete nextModel.reasoningEfforts
    models.push(nextModel)
  }
  return models
}

export interface DshAppliedSections {
  providers: Record<string, Record<string, unknown>>
  removed: string[]
  defaultModel: Record<string, unknown>
  credentials: { env: string; apiKey: string }[]
}

export function applyDshSections(
  existing: Record<string, unknown>,
  view: DshSettingsView
): DshAppliedSections {
  assertDshSave(view)
  const pi = asRecord(existing['llm-pi-ai']) ?? {}
  const previous = asRecord(pi.providers) ?? {}
  const providers: Record<string, Record<string, unknown>> = {}
  const credentials: { env: string; apiKey: string }[] = []
  const keep = new Set<string>()
  for (const item of view.providers) {
    const slug = item.key.trim()
    keep.add(slug)
    const prev = asRecord(previous[item.originalKey]) ?? asRecord(previous[slug]) ?? {}
    const apiKeyEnv = item.apiKeyEnv.trim() || dshApiKeyEnv(slug)
    const profile: Record<string, unknown> = { ...prev }
    delete profile.apiKey
    delete profile.modelOverrides
    delete profile.provider
    profile.displayName = item.displayName.trim() || slug
    profile.apiKeyEnv = apiKeyEnv
    profile.api = item.api
    profile.baseURL = item.baseUrl.trim().replace(/\/+$/, '')
    profile.models = buildModels(item.models, prev.models)
    if (item.customHeaders.length > 0) {
      profile.headers = Object.fromEntries(
        item.customHeaders.map((entry) => [entry.key.trim(), entry.value])
      )
    } else {
      delete profile.headers
    }
    providers[slug] = profile
    if (item.apiKey.trim()) credentials.push({ env: apiKeyEnv, apiKey: item.apiKey })
  }
  const removed = Object.keys(previous).filter((key) => !keep.has(key))
  const parsed = splitDshDefault(view.defaultModel)
  const fallback = view.providers[0]
  const provider = parsed.provider || fallback?.key.trim() || ''
  const model = parsed.model || fallback?.models.find((row) => row.model.trim())?.model.trim() || ''
  const prevDefault = asRecord(existing['agent-default-model']) ?? {}
  const defaultModel: Record<string, unknown> = { ...prevDefault }
  if (provider) defaultModel.provider = provider
  if (model) defaultModel.model = model
  const thinking = view.thinkingLevel.trim()
  if (thinking && (THINKING_LEVELS as readonly string[]).includes(thinking)) {
    defaultModel.reasoningEffort = thinking
  } else {
    delete defaultModel.reasoningEffort
  }
  return { providers, removed, defaultModel, credentials }
}
