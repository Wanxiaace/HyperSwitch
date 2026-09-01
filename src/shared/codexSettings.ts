import { samePromptText } from './claudeSettings'

export const CODEX_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra'
] as const

export type CodexEffort = (typeof CODEX_EFFORTS)[number]

export const CODEX_EFFORT_LABELS: Record<CodexEffort, string> = {
  none: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra'
}

export const CODEX_CATALOG_FILENAME = 'hyperswitch-model-catalog.json'
export const CODEX_INSTRUCTIONS_FILENAME = 'model_instructions.md'

export interface CodexCatalogRow {
  id: string
  model: string
  displayName: string
  contextWindow: string
  maxOutput: string
  input: string[]
  reasoningLevels: CodexEffort[]
  defaultReasoningLevel: string
}

export interface CodexSettingsView {
  apiKey: string
  baseUrl: string
  providerId: string
  providerName: string
  model: string
  contextWindow: string
  maxOutput: string
  reasoningEffort: string
  disableResponseStorage: boolean
  remoteCompaction: boolean
  catalog: CodexCatalogRow[]
  customHeaders: { key: string; value: string }[]
}

export type CodexPromptMode = 'none' | 'keep' | 'preset'

export interface CodexPromptState {
  bakExists: boolean
  content: string
}

export interface CodexInstructionsState extends CodexPromptState {
  path: string
  configured: boolean
}

export interface CodexPromptAction {
  mode: CodexPromptMode
  content: string
  presetId?: string
}

export interface CodexLoadResult {
  exists: boolean
  path: string
  settings: CodexSettingsView
  prompt: CodexPromptState
  instructions: CodexInstructionsState
}

export interface CodexSavePayload {
  settings: CodexSettingsView
  prompt: CodexPromptAction
  instructions: CodexPromptAction
}

function asPromptAction(value: unknown): CodexPromptAction {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const mode: CodexPromptMode =
    item.mode === 'none' || item.mode === 'keep' || item.mode === 'preset' ? item.mode : 'keep'
  return {
    mode,
    content: typeof item.content === 'string' ? item.content : '',
    presetId: typeof item.presetId === 'string' ? item.presetId : ''
  }
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function asEffort(value: string): CodexEffort | null {
  return (CODEX_EFFORTS as readonly string[]).includes(value) ? (value as CodexEffort) : null
}

export function emptyCodexCatalogRow(partial: Partial<CodexCatalogRow> = {}): CodexCatalogRow {
  return {
    id: crypto.randomUUID(),
    model: '',
    displayName: '',
    contextWindow: '',
    maxOutput: '',
    input: ['text'],
    reasoningLevels: [],
    defaultReasoningLevel: '',
    ...partial
  }
}

export function emptyCodexSettings(): CodexSettingsView {
  return {
    apiKey: '',
    baseUrl: '',
    providerId: '',
    providerName: 'custom',
    model: '',
    contextWindow: '',
    maxOutput: '',
    reasoningEffort: 'high',
    disableResponseStorage: true,
    remoteCompaction: false,
    catalog: [],
    customHeaders: []
  }
}

export function sanitizeCodexSettings(value: unknown): CodexSettingsView {
  if (!value || typeof value !== 'object') return emptyCodexSettings()
  const item = value as Partial<CodexSettingsView>
  const catalog = Array.isArray(item.catalog)
    ? item.catalog.map((row) => {
        if (!row || typeof row !== 'object') return emptyCodexCatalogRow()
        const entry = row as Partial<CodexCatalogRow>
        const levels = Array.isArray(entry.reasoningLevels)
          ? entry.reasoningLevels
              .map((level) => asEffort(asString(level)))
              .filter((level): level is CodexEffort => level !== null)
          : []
        return emptyCodexCatalogRow({
          id: asString(entry.id) || crypto.randomUUID(),
          model: asString(entry.model),
          displayName: asString(entry.displayName),
          contextWindow: asString(entry.contextWindow).replace(/[^\d]/g, ''),
          maxOutput: asString(entry.maxOutput).replace(/[^\d]/g, ''),
          input: Array.isArray(entry.input)
            ? entry.input.map((item) => asString(item)).filter(Boolean)
            : ['text'],
          reasoningLevels: levels,
          defaultReasoningLevel: asString(entry.defaultReasoningLevel)
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
    providerName: asString(item.providerName) || 'custom',
    model: asString(item.model),
    contextWindow: asString(item.contextWindow).replace(/[^\d]/g, ''),
    maxOutput: asString(item.maxOutput).replace(/[^\d]/g, ''),
    reasoningEffort: asString(item.reasoningEffort) || 'high',
    disableResponseStorage: item.disableResponseStorage !== false,
    remoteCompaction: item.remoteCompaction === true,
    catalog,
    customHeaders
  }
}

export function sanitizeCodexSavePayload(value: unknown): CodexSavePayload {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    settings: sanitizeCodexSettings(item.settings ?? item),
    prompt: asPromptAction(item.prompt),
    instructions: asPromptAction(item.instructions)
  }
}

export function parseCatalogFile(raw: unknown): CodexCatalogRow[] {
  if (!raw || typeof raw !== 'object') return []
  const models = (raw as { models?: unknown }).models
  if (!Array.isArray(models)) return []
  return models.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    const model = asString(entry.slug || entry.model)
    if (!model) return []
    const levelsRaw = entry.supported_reasoning_levels
    const levels: CodexEffort[] = []
    if (Array.isArray(levelsRaw)) {
      for (const level of levelsRaw) {
        const effort =
          typeof level === 'string'
            ? asEffort(level)
            : asEffort(asString((level as { effort?: unknown })?.effort))
        if (effort && !levels.includes(effort)) levels.push(effort)
      }
    }
    return [
      emptyCodexCatalogRow({
        model,
        displayName: asString(entry.display_name || entry.displayName),
        contextWindow: asString(entry.context_window || entry.contextWindow).replace(/[^\d]/g, ''),
        maxOutput: asString(entry.max_output_tokens || entry.maxOutput).replace(/[^\d]/g, ''),
        input: Array.isArray(entry.input_modalities)
          ? (entry.input_modalities as unknown[]).map((item) => asString(item)).filter(Boolean)
          : ['text'],
        reasoningLevels: levels,
        defaultReasoningLevel: asString(entry.default_reasoning_level || entry.defaultReasoningLevel)
      })
    ]
  })
}

const CATALOG_TEMPLATE = {
  description: '',
  base_instructions:
    'You are Codex, a coding agent. You and the user share the same workspace and collaborate to achieve the user\'s goals.',
  shell_type: 'shell_command',
  visibility: 'list',
  supported_in_api: true,
  supports_reasoning_summaries: true,
  default_reasoning_summary: 'none',
  support_verbosity: false,
  truncation_policy: { mode: 'bytes', limit: 10000 },
  supports_parallel_tool_calls: false,
  supports_image_detail_original: false,
  effective_context_window_percent: 95,
  experimental_supported_tools: [],
  input_modalities: ['text'],
  supports_search_tool: false
}

export function buildCatalogFile(rows: CodexCatalogRow[]): { models: Record<string, unknown>[] } | null {
  const models = rows
    .filter((row) => row.model.trim())
    .map((row, index) => {
      const name = row.displayName.trim() || row.model.trim()
      const context = Number(row.contextWindow)
      const window = Number.isFinite(context) && context > 0 ? context : 128000
      const maxOutput = Number(row.maxOutput)
      const levels =
        row.reasoningLevels.length > 0
          ? row.reasoningLevels.map((effort) => ({
              effort,
              description: CODEX_EFFORT_LABELS[effort]
            }))
          : [
              { effort: 'none', description: CODEX_EFFORT_LABELS.none },
              { effort: 'high', description: CODEX_EFFORT_LABELS.high }
            ]
      const defaultLevel =
        row.defaultReasoningLevel && row.reasoningLevels.includes(row.defaultReasoningLevel as CodexEffort)
          ? row.defaultReasoningLevel
          : (levels[levels.length - 1]?.effort ?? 'high')
      return {
        ...CATALOG_TEMPLATE,
        slug: row.model.trim(),
        display_name: name,
        description: name,
        default_reasoning_level: defaultLevel,
        supported_reasoning_levels: levels,
        priority: 1000 + index,
        context_window: window,
        max_context_window: window,
        ...(Number.isFinite(maxOutput) && maxOutput > 0 ? { max_output_tokens: maxOutput } : {}),
        input_modalities: row.input.length > 0 ? row.input : ['text']
      }
    })
  return models.length > 0 ? { models } : null
}

export { samePromptText }
