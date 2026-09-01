import { asPromptAction, asRecord, asString, type AgentPromptAction } from './agentPlugin'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  DEFAULT_MODEL_MAX_OUTPUT,
  isProviderKey,
  sanitizeModalities,
  type ApiFormat,
  type Modality
} from './provider'

export const ZCODE_KINDS = ['openai-compatible', 'openai', 'anthropic'] as const
export type ZcodeKind = (typeof ZCODE_KINDS)[number]

export const ZCODE_APIS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const
export type ZcodeApi = (typeof ZCODE_APIS)[number]

export const ZCODE_KIND_LABELS: Record<ZcodeKind, string> = {
  'openai-compatible': 'OpenAI Chat Completions',
  openai: 'OpenAI Responses',
  anthropic: 'Anthropic Messages'
}

export function isZcodeKind(value: string): value is ZcodeKind {
  return (ZCODE_KINDS as readonly string[]).includes(value)
}

export function isZcodeApi(value: string): value is ZcodeApi {
  return (ZCODE_APIS as readonly string[]).includes(value)
}

export function isZcodeBuiltinKey(key: string): boolean {
  return key.trim().startsWith('builtin:')
}

export function kindFromFormat(format: ApiFormat): ZcodeKind {
  if (format === 'anthropic-messages') return 'anthropic'
  if (format === 'openai-responses') return 'openai'
  return 'openai-compatible'
}

export interface ZcodeModelRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  thinkingLevels: string[]
  input: Modality[]
  output: Modality[]
}

export interface ZcodeProviderView {
  id: string
  key: string
  originalKey: string
  name: string
  kind: ZcodeKind
  apiKey: string
  baseUrl: string
  models: ZcodeModelRow[]
  customHeaders: { key: string; value: string }[]
}

export interface ZcodeSettingsView {
  providers: ZcodeProviderView[]
}

export interface ZcodeLoadResult {
  exists: boolean
  path: string
  settings: ZcodeSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface ZcodeSavePayload {
  settings: ZcodeSettingsView
  prompt: AgentPromptAction
}

export function emptyZcodeModelRow(partial: Partial<ZcodeModelRow> = {}): ZcodeModelRow {
  const { input, output, ...rest } = partial
  return {
    id: crypto.randomUUID(),
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    thinkingLevels: [],
    ...rest,
    input: sanitizeModalities(input ?? ['text']),
    output: sanitizeModalities(output ?? ['text'])
  }
}

export function emptyZcodeProvider(partial: Partial<ZcodeProviderView> = {}): ZcodeProviderView {
  const key = partial.key?.trim() || ''
  return {
    id: crypto.randomUUID(),
    key,
    originalKey: key,
    name: '',
    kind: 'openai-compatible',
    apiKey: '',
    baseUrl: '',
    models: [],
    customHeaders: [],
    ...partial
  }
}

export function emptyZcodeSettings(): ZcodeSettingsView {
  return { providers: [] }
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

function thinkingFromReasoning(value: unknown): string[] {
  const record = asRecord(value)
  if (!record) return []
  if (Array.isArray(record.variants)) {
    return record.variants.map((item) => asString(item).trim()).filter(Boolean)
  }
  return []
}

function modelsFromNode(models: unknown): ZcodeModelRow[] {
  const record = asRecord(models)
  if (!record) return []
  return Object.entries(record).flatMap(([id, raw]) => {
    const modelId = id.trim()
    if (!modelId) return []
    const entry = asRecord(raw) ?? {}
    const limit = asRecord(entry.limit)
    const modalities = asRecord(entry.modalities)
    return [
      emptyZcodeModelRow({
        model: modelId,
        displayName: asString(entry.name),
        contextWindow: asString(limit?.context),
        maxOutput: asString(limit?.output),
        thinkingLevels: thinkingFromReasoning(entry.reasoning),
        input: sanitizeModalities(modalities?.input ?? ['text']),
        output: sanitizeModalities(modalities?.output ?? ['text'])
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

function sanitizeModels(value: unknown): ZcodeModelRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    if (!row || typeof row !== 'object') return emptyZcodeModelRow()
    const entry = row as Partial<ZcodeModelRow>
    return emptyZcodeModelRow({
      id: asString(entry.id) || crypto.randomUUID(),
      model: asString(entry.model),
      displayName: asString(entry.displayName),
      contextWindow: asString(entry.contextWindow).replace(/[^\d]/g, ''),
      maxOutput: asString(entry.maxOutput).replace(/[^\d]/g, ''),
      thinkingLevels: Array.isArray(entry.thinkingLevels)
        ? entry.thinkingLevels.map((level) => asString(level)).filter(Boolean)
        : [],
      input: entry.input,
      output: entry.output
    })
  })
}

export function parseZcodeSettings(raw: unknown): ZcodeSettingsView {
  const root = asRecord(raw) ?? {}
  const nodes = asRecord(root.provider) ?? {}
  const providers = Object.entries(nodes).flatMap(([key, node]) => {
    if (isZcodeBuiltinKey(key)) return []
    const entry = asRecord(node) ?? {}
    const options = asRecord(entry.options) ?? {}
    const kindRaw = asString(entry.kind)
    return [
      emptyZcodeProvider({
        key,
        originalKey: key,
        name: asString(entry.name),
        kind: isZcodeKind(kindRaw) ? kindRaw : 'openai-compatible',
        apiKey: asString(options.apiKey),
        baseUrl: asString(options.baseURL),
        models: modelsFromNode(entry.models),
        customHeaders: headerPairs(entry.headers ?? options.headers)
      })
    ]
  })
  return { providers }
}

export function sanitizeZcodeSettings(value: unknown): ZcodeSettingsView {
  if (!value || typeof value !== 'object') return emptyZcodeSettings()
  const item = value as Partial<ZcodeSettingsView>
  const providers = Array.isArray(item.providers)
    ? item.providers.map((row) => {
        if (!row || typeof row !== 'object') return emptyZcodeProvider()
        const entry = row as Partial<ZcodeProviderView>
        const key = asString(entry.key).trim()
        const kindRaw = asString(entry.kind)
        return emptyZcodeProvider({
          id: asString(entry.id) || crypto.randomUUID(),
          key,
          originalKey: asString(entry.originalKey).trim() || key,
          name: asString(entry.name),
          kind: isZcodeKind(kindRaw) ? kindRaw : 'openai-compatible',
          apiKey: asString(entry.apiKey),
          baseUrl: asString(entry.baseUrl),
          models: sanitizeModels(entry.models),
          customHeaders: sanitizeHeaders(entry.customHeaders)
        })
      })
    : []
  return { providers }
}

export function sanitizeZcodeSavePayload(value: unknown): ZcodeSavePayload {
  const item = asRecord(value) ?? {}
  return {
    settings: sanitizeZcodeSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}

export function isZcodeEditableKey(key: string, originalKey: string): boolean {
  const value = key.trim()
  if (!value || isZcodeBuiltinKey(value)) return false
  if (originalKey.trim() && originalKey.trim() === value) return true
  return isProviderKey(value)
}

export function assertZcodeSave(view: ZcodeSettingsView): void {
  const keys: string[] = []
  for (const item of view.providers) {
    const key = item.key.trim()
    if (!isZcodeEditableKey(key, item.originalKey)) {
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

function reasoningFor(levels: string[]): Record<string, unknown> | undefined {
  const variants = levels.map((level) => level.trim()).filter(Boolean)
  if (variants.length === 0) return undefined
  const active = variants.filter((level) => level !== 'off')
  return {
    enabled: active.length > 0,
    variants,
    defaultVariant: active.at(-1) ?? variants.at(-1)
  }
}

function buildModels(
  rows: ZcodeModelRow[],
  previous: Record<string, unknown>
): Record<string, unknown> {
  const models: Record<string, unknown> = {}
  for (const row of rows) {
    const id = row.model.trim()
    if (!id) continue
    const prevModel = asRecord(previous[id]) ?? {}
    const context = Number(row.contextWindow)
    const output = Number(row.maxOutput)
    const reasoning = reasoningFor(row.thinkingLevels)
    const entry: Record<string, unknown> = {
      ...prevModel,
      limit: {
        ...(asRecord(prevModel.limit) ?? {}),
        context: Number.isFinite(context) && context > 0 ? context : DEFAULT_MODEL_CONTEXT_WINDOW,
        output: Number.isFinite(output) && output > 0 ? output : DEFAULT_MODEL_MAX_OUTPUT
      },
      modalities: {
        input: row.input.length > 0 ? row.input : ['text'],
        output: row.output.length > 0 ? row.output : ['text']
      }
    }
    if (row.displayName.trim()) entry.name = row.displayName.trim()
    if (reasoning) entry.reasoning = reasoning
    else delete entry.reasoning
    models[id] = entry
  }
  return models
}

export function applyZcodeSettings(
  existing: Record<string, unknown>,
  view: ZcodeSettingsView
): Record<string, unknown> {
  assertZcodeSave(view)
  const next: Record<string, unknown> = { ...existing }
  const previous = asRecord(next.provider) ?? {}
  const providers: Record<string, unknown> = {}
  for (const [key, node] of Object.entries(previous)) {
    if (isZcodeBuiltinKey(key)) providers[key] = node
  }
  const used = new Set<string>()
  for (const item of view.providers) {
    const key = item.key.trim()
    if (!key || isZcodeBuiltinKey(key) || used.has(key)) continue
    used.add(key)
    const prev = asRecord(previous[item.originalKey]) ?? asRecord(previous[key]) ?? {}
    const prevOptions = asRecord(prev.options) ?? {}
    const options: Record<string, unknown> = { ...prevOptions }
    delete options.headers
    const baseUrl = item.baseUrl.trim().replace(/\/+$/, '')
    if (baseUrl) options.baseURL = baseUrl
    else delete options.baseURL
    if (item.apiKey.trim()) {
      options.apiKey = item.apiKey.trim()
      options.apiKeyRequired = true
    } else {
      delete options.apiKey
    }
    const node: Record<string, unknown> = {
      ...prev,
      kind: item.kind,
      options,
      models: buildModels(item.models, asRecord(prev.models) ?? {})
    }
    if (item.name.trim()) node.name = item.name.trim()
    else if (!asString(node.name).trim()) node.name = key
    if (!('source' in node)) node.source = 'custom'
    if (!('enabled' in node)) node.enabled = true
    const headers = Object.fromEntries(
      item.customHeaders.map((entry) => [entry.key.trim(), entry.value] as const).filter(([name]) => name)
    )
    if (Object.keys(headers).length > 0) node.headers = headers
    else delete node.headers
    providers[key] = node
  }
  next.provider = providers
  return next
}
