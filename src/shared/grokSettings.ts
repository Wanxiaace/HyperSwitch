import { asPromptAction, asString, slugify, type AgentPromptAction } from './agentPlugin'
import { DEFAULT_MODEL_MAX_OUTPUT, type ApiFormat } from './provider'

export const GROK_DEFAULT_BACKEND = 'responses'
export const GROK_DEFAULT_CONTEXT_WINDOW = 500000
export const GROK_DEFAULT_MAX_OUTPUT = DEFAULT_MODEL_MAX_OUTPUT

export const GROK_BACKENDS = ['chat_completions', 'responses', 'messages'] as const
export type GrokBackend = (typeof GROK_BACKENDS)[number]

export const GROK_BACKEND_LABELS: Record<GrokBackend, string> = {
  chat_completions: 'OpenAI Chat Completions',
  responses: 'OpenAI Responses',
  messages: 'Anthropic Messages'
}

export interface GrokCatalogRow {
  id: string
  profile: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  reasoningLevels: string[]
}

export interface GrokSettingsView {
  apiKey: string
  baseUrl: string
  providerId: string
  providerName: string
  apiBackend: string
  defaultProfile: string
  reasoningEffort: string
  catalog: GrokCatalogRow[]
  customHeaders: { key: string; value: string }[]
}

export interface GrokLoadResult {
  exists: boolean
  path: string
  settings: GrokSettingsView
  prompt: { bakExists: boolean; content: string }
}

export interface GrokSavePayload {
  settings: GrokSettingsView
  prompt: AgentPromptAction
}

export function grokBackendFromFormat(format: ApiFormat): GrokBackend {
  if (format === 'anthropic-messages') return 'messages'
  if (format === 'openai-completions') return 'chat_completions'
  return 'responses'
}

export function emptyGrokCatalogRow(partial: Partial<GrokCatalogRow> = {}): GrokCatalogRow {
  return {
    id: crypto.randomUUID(),
    profile: '',
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    reasoningLevels: [],
    ...partial
  }
}

export function emptyGrokSettings(): GrokSettingsView {
  return {
    apiKey: '',
    baseUrl: '',
    providerId: '',
    providerName: '',
    apiBackend: GROK_DEFAULT_BACKEND,
    defaultProfile: '',
    reasoningEffort: '',
    catalog: [],
    customHeaders: []
  }
}

export function grokProfileId(providerId: string, model: string): string {
  const modelSlug = slugify(model, '')
  if (!modelSlug) return ''
  const prefix = providerId.trim() || 'custom'
  if (modelSlug === prefix || modelSlug.startsWith(`${prefix}-`)) return modelSlug
  return `${prefix}-${modelSlug}`
}

export function grokMenuName(providerName: string, modelName: string): string {
  const name = modelName.trim()
  const supplier = providerName.trim()
  if (!name) return supplier
  if (!supplier) return name
  const lower = name.toLowerCase()
  const tag = supplier.toLowerCase()
  if (
    lower === tag ||
    lower.startsWith(`${tag} `) ||
    lower.startsWith(`${tag}·`) ||
    lower.startsWith(`${tag} ·`) ||
    lower.includes(`(${tag})`)
  ) {
    return name
  }
  return `${supplier} · ${name}`
}

export function grokProfileFor(
  row: Pick<GrokCatalogRow, 'profile' | 'model'>,
  providerId = ''
): string {
  const auto = grokProfileId(providerId, row.model)
  const current = row.profile.trim()
  if (!current) return auto
  const modelSlug = slugify(row.model, '')
  if (modelSlug && (current === modelSlug || current === row.model.trim())) return auto || current
  return current
}

export function sanitizeGrokSettings(value: unknown): GrokSettingsView {
  if (!value || typeof value !== 'object') return emptyGrokSettings()
  const item = value as Partial<GrokSettingsView>
  const backend = asString(item.apiBackend)
  const catalog = Array.isArray(item.catalog)
    ? item.catalog.map((row) => {
        if (!row || typeof row !== 'object') return emptyGrokCatalogRow()
        const entry = row as Partial<GrokCatalogRow>
        return emptyGrokCatalogRow({
          id: asString(entry.id) || crypto.randomUUID(),
          profile: asString(entry.profile),
          model: asString(entry.model),
          displayName: asString(entry.displayName),
          contextWindow: asString(entry.contextWindow).replace(/[^\d]/g, ''),
          maxOutput: asString(entry.maxOutput).replace(/[^\d]/g, ''),
          reasoningLevels: Array.isArray(entry.reasoningLevels)
            ? entry.reasoningLevels.map((level) => asString(level)).filter(Boolean)
            : []
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
    apiKey: asString(item.apiKey),
    baseUrl: asString(item.baseUrl),
    providerId: asString(item.providerId),
    providerName: asString(item.providerName),
    apiBackend: (GROK_BACKENDS as readonly string[]).includes(backend) ? backend : GROK_DEFAULT_BACKEND,
    defaultProfile: asString(item.defaultProfile),
    reasoningEffort: asString(item.reasoningEffort),
    catalog,
    customHeaders
  }
}

export function sanitizeGrokSavePayload(value: unknown): GrokSavePayload {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    settings: sanitizeGrokSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt)
  }
}
