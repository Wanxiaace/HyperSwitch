import { asPromptAction, asRecord, asString, type AgentPromptAction } from './agentPlugin'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  DEFAULT_MODEL_MAX_OUTPUT,
  PROVIDER_KEY_PATTERN,
  sanitizeModalities,
  type ApiFormat,
  type Modality
} from './provider'

export const OPENCODE_SCHEMA = 'https://opencode.ai/config.json'
export const OPENCODE_KEY_PATTERN = PROVIDER_KEY_PATTERN

export const OPENCODE_NPM_PACKAGES = [
  { value: '@ai-sdk/openai', label: 'OpenAI Responses' },
  { value: '@ai-sdk/openai-compatible', label: 'OpenAI Compatible' },
  { value: '@ai-sdk/anthropic', label: 'Anthropic' },
  { value: '@ai-sdk/google', label: 'Google (Gemini)' }
] as const

export interface OpenCodeModelRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  thinkingLevels: string[]
  input: Modality[]
  output: Modality[]
}

export interface OpenCodeProviderView {
  id: string
  key: string
  originalKey: string
  name: string
  npm: string
  apiKey: string
  baseUrl: string
  models: OpenCodeModelRow[]
  customHeaders: { key: string; value: string }[]
}

export interface OpenCodeSettingsView {
  defaultModel: string
  providers: OpenCodeProviderView[]
}

export interface OpenCodeLoadResult {
  exists: boolean
  path: string
  settings: OpenCodeSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface OpenCodeSavePayload {
  settings: OpenCodeSettingsView
  prompt: AgentPromptAction
}

export function npmFromFormat(format: ApiFormat): string {
  if (format === 'openai-responses') return '@ai-sdk/openai'
  if (format === 'anthropic-messages') return '@ai-sdk/anthropic'
  if (format === 'google-generative-ai') return '@ai-sdk/google'
  return '@ai-sdk/openai-compatible'
}

export function emptyOpenCodeModelRow(partial: Partial<OpenCodeModelRow> = {}): OpenCodeModelRow {
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

export function emptyOpenCodeProvider(partial: Partial<OpenCodeProviderView> = {}): OpenCodeProviderView {
  const key = partial.key?.trim() || 'custom'
  return {
    id: crypto.randomUUID(),
    key,
    originalKey: key,
    name: '',
    npm: '@ai-sdk/openai-compatible',
    apiKey: '',
    baseUrl: '',
    models: [],
    customHeaders: [],
    ...partial
  }
}

export function emptyOpenCodeSettings(): OpenCodeSettingsView {
  return { defaultModel: '', providers: [] }
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

function modelsFromNode(models: unknown): OpenCodeModelRow[] {
  const record = asRecord(models)
  if (!record) return []
  return Object.entries(record).flatMap(([id, raw]) => {
    const modelId = id.trim()
    if (!modelId) return []
    const entry = asRecord(raw) ?? {}
    const limit = asRecord(entry.limit)
    const modalities = asRecord(entry.modalities)
    const variants = asRecord(entry.variants)
    const thinkingLevels = variants
      ? Object.keys(variants).filter((key) => key.trim())
      : entry.thinking === true || entry.reasoning === true
        ? ['low', 'medium', 'high']
        : []
    return [
      emptyOpenCodeModelRow({
        model: modelId,
        displayName: asString(entry.name),
        contextWindow: asString(limit?.context),
        maxOutput: asString(limit?.output),
        thinkingLevels,
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

function sanitizeModels(value: unknown): OpenCodeModelRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    if (!row || typeof row !== 'object') return emptyOpenCodeModelRow()
    const entry = row as Partial<OpenCodeModelRow>
    return emptyOpenCodeModelRow({
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

export function parseOpenCodeSettings(raw: unknown): OpenCodeSettingsView {
  const root = asRecord(raw) ?? {}
  const nodes = asRecord(root.provider) ?? {}
  const providers = Object.entries(nodes).map(([key, node]) => {
    const entry = asRecord(node) ?? {}
    const options = asRecord(entry.options) ?? {}
    return emptyOpenCodeProvider({
      key,
      originalKey: key,
      name: asString(entry.name),
      npm: asString(entry.npm) || '@ai-sdk/openai-compatible',
      apiKey: asString(options.apiKey),
      baseUrl: asString(options.baseURL),
      models: modelsFromNode(entry.models),
      customHeaders: headerPairs(options.headers)
    })
  })
  return {
    defaultModel: asString(root.model),
    providers
  }
}

export function sanitizeOpenCodeSettings(value: unknown): OpenCodeSettingsView {
  if (!value || typeof value !== 'object') return emptyOpenCodeSettings()
  const item = value as Partial<OpenCodeSettingsView>
  const providers = Array.isArray(item.providers)
    ? item.providers.map((row) => {
        if (!row || typeof row !== 'object') return emptyOpenCodeProvider()
        const entry = row as Partial<OpenCodeProviderView>
        const key = asString(entry.key).trim() || 'custom'
        return emptyOpenCodeProvider({
          id: asString(entry.id) || crypto.randomUUID(),
          key,
          originalKey: asString(entry.originalKey).trim() || key,
          name: asString(entry.name),
          npm: asString(entry.npm) || '@ai-sdk/openai-compatible',
          apiKey: asString(entry.apiKey),
          baseUrl: asString(entry.baseUrl),
          models: sanitizeModels(entry.models),
          customHeaders: sanitizeHeaders(entry.customHeaders)
        })
      })
    : []
  return {
    defaultModel: asString(item.defaultModel),
    providers
  }
}

export function sanitizeOpenCodeSavePayload(value: unknown): OpenCodeSavePayload {
  const item = asRecord(value) ?? {}
  return {
    settings: sanitizeOpenCodeSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}

function variantsFor(npm: string, levels: string[]): Record<string, unknown> | undefined {
  const efforts = levels.filter((level) => level && level !== 'off')
  if (efforts.length === 0) return undefined
  if (npm === '@ai-sdk/openai' || npm === '@ai-sdk/openai-compatible') {
    const variants: Record<string, unknown> = {}
    for (const effort of efforts) {
      variants[effort] = {
        reasoningEffort: effort,
        reasoningSummary: 'auto',
        textVerbosity: 'medium'
      }
    }
    return variants
  }
  if (npm === '@ai-sdk/google') {
    const variants: Record<string, unknown> = {}
    for (const effort of efforts) {
      variants[effort] = {
        thinkingConfig: { includeThoughts: true, thinkingLevel: effort }
      }
    }
    return variants
  }
  return undefined
}

function buildModels(
  rows: OpenCodeModelRow[],
  npm: string,
  previous: Record<string, unknown>
): Record<string, unknown> {
  const models: Record<string, unknown> = {}
  for (const row of rows) {
    const id = row.model.trim()
    if (!id) continue
    const prevModel = asRecord(previous[id]) ?? {}
    const context = Number(row.contextWindow)
    const output = Number(row.maxOutput)
    const variants = variantsFor(npm, row.thinkingLevels)
    const entry: Record<string, unknown> = {
      ...prevModel,
      name: row.displayName.trim() || id,
      limit: {
        context: Number.isFinite(context) && context > 0 ? context : DEFAULT_MODEL_CONTEXT_WINDOW,
        output: Number.isFinite(output) && output > 0 ? output : DEFAULT_MODEL_MAX_OUTPUT
      },
      modalities: {
        input: row.input.length > 0 ? row.input : ['text'],
        output: row.output.length > 0 ? row.output : ['text']
      }
    }
    if (variants) {
      entry.variants = variants
      entry.thinking = true
      entry.reasoning = true
    }
    models[id] = entry
  }
  return models
}

export function applyOpenCodeSettings(
  existing: Record<string, unknown>,
  view: OpenCodeSettingsView
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing }
  if (!next.$schema) next.$schema = OPENCODE_SCHEMA
  const previous = asRecord(next.provider) ?? {}
  const providers: Record<string, unknown> = {}
  const used = new Set<string>()
  for (const item of view.providers) {
    const key = item.key.trim()
    if (!key || used.has(key)) continue
    used.add(key)
    const prev = asRecord(previous[item.originalKey]) ?? asRecord(previous[key]) ?? {}
    const prevOptions = asRecord(prev.options) ?? {}
    const options: Record<string, unknown> = { ...prevOptions }
    const baseUrl = item.baseUrl.trim().replace(/\/+$/, '')
    if (baseUrl) options.baseURL = baseUrl
    else delete options.baseURL
    if (item.apiKey.trim()) options.apiKey = item.apiKey.trim()
    else delete options.apiKey
    if (item.customHeaders.length > 0) {
      options.headers = Object.fromEntries(
        item.customHeaders.map((entry) => [entry.key.trim(), entry.value])
      )
    } else {
      delete options.headers
    }
    const node: Record<string, unknown> = {
      ...prev,
      npm: item.npm,
      options,
      models: buildModels(item.models, item.npm, asRecord(prev.models) ?? {})
    }
    if (item.name.trim()) node.name = item.name.trim()
    providers[key] = node
  }
  next.provider = providers
  const defaultModel = view.defaultModel.trim()
  if (defaultModel) next.model = defaultModel
  else delete next.model
  return next
}
