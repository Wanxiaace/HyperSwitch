export const API_FORMATS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai'
] as const

export type ApiFormat = (typeof API_FORMATS)[number]

export const API_FORMAT_LABELS: Record<ApiFormat, string> = {
  'openai-completions': 'OpenAI Chat Completions',
  'openai-responses': 'OpenAI Responses',
  'anthropic-messages': 'Anthropic Messages',
  'google-generative-ai': 'Google Generative AI'
}

export const THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max'
}

export const MODALITIES = ['text', 'image', 'audio', 'video'] as const

export type Modality = (typeof MODALITIES)[number]

export const MODALITY_LABELS: Record<Modality, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video'
}

export interface ModelConfig {
  key: string
  id: string
  name: string
  contextWindow: number | null
  maxOutput: number | null
  thinkingLevels: ThinkingLevel[]
  input: Modality[]
  output: Modality[]
}

export const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export function isProviderKey(value: string): boolean {
  return PROVIDER_KEY_PATTERN.test(value.trim())
}

export interface ProviderConfig {
  id: string
  slug: string
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  websiteUrl: string
  notes: string
  icon: string
  models: ModelConfig[]
  createdAt: string
  updatedAt: string
}

export function findProviderBySlug(
  providers: readonly ProviderConfig[],
  slug: string
): ProviderConfig | undefined {
  const key = slug.trim()
  if (!key) return undefined
  return providers.find((item) => item.slug.trim() === key)
}

export interface AppConfigFile {
  version: 1
  providers: ProviderConfig[]
  agentBindings?: import('./agentTools').AgentToolBindings
  promptPresets?: import('./presets').PromptPreset[]
  headerPresets?: import('./presets').HeaderPreset[]
}

export interface FetchedModel {
  id: string
  ownedBy: string | null
}

export interface FetchModelsInput {
  baseUrl: string
  apiKey: string
  apiFormat?: ApiFormat
  modelsUrl?: string
}

export interface FetchModelsResult {
  ok: true
  models: FetchedModel[]
}

export interface FetchModelsFailure {
  ok: false
  error: string
}

export type FetchModelsResponse = FetchModelsResult | FetchModelsFailure

export function sanitizeModalities(value: unknown): Modality[] {
  if (!Array.isArray(value)) return ['text']
  const allowed = value.filter((item): item is Modality =>
    (MODALITIES as readonly string[]).includes(item as string)
  )
  return allowed.length > 0 ? MODALITIES.filter((item) => allowed.includes(item)) : ['text']
}

export function toggleModality(list: Modality[], type: Modality): Modality[] {
  const enabled = new Set(list)
  if (enabled.has(type)) {
    if (enabled.size === 1) return list
    enabled.delete(type)
  } else {
    enabled.add(type)
  }
  return MODALITIES.filter((item) => enabled.has(item))
}

export function sanitizeThinkingLevels(value: unknown, legacyMap?: unknown): ThinkingLevel[] {
  if (Array.isArray(value)) {
    return THINKING_LEVELS.filter((level) => value.includes(level))
  }
  if (legacyMap && typeof legacyMap === 'object') {
    const map = legacyMap as Record<string, unknown>
    return THINKING_LEVELS.filter(
      (level) => Object.prototype.hasOwnProperty.call(map, level) && map[level] !== null
    )
  }
  return []
}

export function defaultModelDisplayName(id: string): string {
  const last = id.trim().split(/[/:]/).filter(Boolean).pop() ?? ''
  if (!last) return ''
  const special: Record<string, string> = {
    gpt: 'GPT',
    glm: 'GLM',
    qwen: 'Qwen',
    claude: 'Claude',
    grok: 'Grok',
    kimi: 'Kimi',
    gemini: 'Gemini'
  }
  return last
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const key = part.toLowerCase()
      if (special[key]) return special[key]
      if (/^\d/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

export function isAutoModelName(name: string, id: string): boolean {
  const trimmed = name.trim()
  return (
    !trimmed ||
    trimmed === '未命名模型' ||
    trimmed === 'Untitled' ||
    trimmed === 'Untitled model' ||
    trimmed === id ||
    trimmed === defaultModelDisplayName(id)
  )
}

export function toggleThinkingLevel(list: ThinkingLevel[], level: ThinkingLevel): ThinkingLevel[] {
  const enabled = new Set(list)
  if (enabled.has(level)) enabled.delete(level)
  else enabled.add(level)
  return THINKING_LEVELS.filter((item) => enabled.has(item))
}

/** Prefill when models.dev has no matching entry. */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 262144
export const DEFAULT_MODEL_MAX_OUTPUT = 32768

export function capsFromCatalog(
  preset?: {
    contextWindow: number | null
    maxOutput: number | null
    input?: Modality[]
    output?: Modality[]
    thinkingLevels?: ThinkingLevel[]
  } | null
): Pick<ModelConfig, 'contextWindow' | 'maxOutput' | 'input' | 'output' | 'thinkingLevels'> {
  return {
    contextWindow: preset?.contextWindow ?? DEFAULT_MODEL_CONTEXT_WINDOW,
    maxOutput: preset?.maxOutput ?? DEFAULT_MODEL_MAX_OUTPUT,
    input: sanitizeModalities(preset?.input ?? ['text']),
    output: sanitizeModalities(preset?.output ?? ['text']),
    thinkingLevels: sanitizeThinkingLevels(preset?.thinkingLevels)
  }
}

export function emptyModel(
  partial: Partial<ModelConfig> & { thinkingLevelMap?: unknown; reasoning?: unknown } = {}
): ModelConfig {
  const { thinkingLevelMap, reasoning: _reasoning, ...rest } = partial
  return {
    key: crypto.randomUUID(),
    id: '',
    name: '',
    contextWindow: DEFAULT_MODEL_CONTEXT_WINDOW,
    maxOutput: DEFAULT_MODEL_MAX_OUTPUT,
    ...rest,
    input: sanitizeModalities(rest.input ?? ['text']),
    output: sanitizeModalities(rest.output ?? ['text']),
    thinkingLevels: sanitizeThinkingLevels(rest.thinkingLevels, thinkingLevelMap)
  }
}

export function emptyProvider(partial: Partial<ProviderConfig> = {}): ProviderConfig {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    slug: typeof partial.slug === 'string' ? partial.slug : '',
    name: 'Untitled',
    baseUrl: '',
    apiKey: '',
    apiFormat: 'openai-completions',
    websiteUrl: '',
    notes: '',
    icon: '',
    models: [],
    createdAt: now,
    updatedAt: now,
    ...partial
  }
}


