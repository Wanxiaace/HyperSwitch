export const CLAUDE_ONE_M_MARKER = '[1M]'

export type ClaudeAuthField = 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY'

export interface ClaudeRoleConfig {
  model: string
  name: string
}

export interface ClaudeSettingsView {
  providerId: string
  baseUrl: string
  apiKey: string
  authField: ClaudeAuthField
  sonnet: ClaudeRoleConfig
  opus: ClaudeRoleConfig
  fable: ClaudeRoleConfig
  haiku: ClaudeRoleConfig
  subagentModel: string
  fallbackModel: string
  customHeaders: { key: string; value: string }[]
  maxOutputTokens: string
  hideAttribution: boolean
  teammates: boolean
  enableToolSearch: boolean
  effortMax: boolean
  disableAutoUpgrade: boolean
}

export type ClaudePromptMode = 'none' | 'keep' | 'preset'

export interface ClaudePromptState {
  bakExists: boolean
  content: string
}

export interface ClaudeLoadResult {
  exists: boolean
  path: string
  settings: ClaudeSettingsView
  prompt: ClaudePromptState
}

export interface ClaudeSavePayload {
  settings: ClaudeSettingsView
  prompt: {
    mode: ClaudePromptMode
    content: string
  }
}

export { samePromptText } from './agentPlugin'

export function hasClaudeOneMMarker(model: string): boolean {
  return model.trimEnd().toLowerCase().endsWith('[1m]')
}

export function stripClaudeOneMMarker(model: string): string {
  const trimmed = model.trimEnd()
  if (!trimmed.toLowerCase().endsWith('[1m]')) return model
  return trimmed.slice(0, -CLAUDE_ONE_M_MARKER.length).trimEnd()
}

export function setClaudeOneMMarker(model: string, enabled: boolean): string {
  const base = stripClaudeOneMMarker(model).trim()
  if (!base) return ''
  return enabled ? `${base}${CLAUDE_ONE_M_MARKER}` : base
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function envOf(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const env = (raw as { env?: unknown }).env
  if (!env || typeof env !== 'object' || Array.isArray(env)) return {}
  return env as Record<string, unknown>
}

function isOn(value: unknown, yes: string[]): boolean {
  const text = asString(value).trim().toLowerCase()
  return yes.includes(text)
}

export function parseCustomHeaders(raw: string): { key: string; value: string }[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => {
          const name = key.trim()
          if (!name) return []
          return [{ key: name, value: asString(value) }]
        })
      }
    } catch {
      // Fall through to line parsing.
    }
  }
  return trimmed.split(/\r?\n/).flatMap((line) => {
    const idx = line.indexOf(':')
    if (idx <= 0) return []
    const key = line.slice(0, idx).trim()
    if (!key) return []
    return [{ key, value: line.slice(idx + 1).trim() }]
  })
}

export function serializeCustomHeaders(headers: { key: string; value: string }[]): string {
  return headers
    .filter((entry) => entry.key.trim())
    .map((entry) => `${entry.key.trim()}: ${entry.value}`)
    .join('\n')
}

export function sameHeaderPairs(
  a: { key: string; value: string }[],
  b: { key: string; value: string }[]
): boolean {
  const norm = (list: { key: string; value: string }[]) =>
    list
      .filter((entry) => entry.key.trim())
      .map((entry) => `${entry.key.trim().toLowerCase()}:${entry.value}`)
      .sort()
      .join('\n')
  return norm(a) === norm(b)
}

export function emptyClaudeSettings(): ClaudeSettingsView {
  return {
    providerId: '',
    baseUrl: '',
    apiKey: '',
    authField: 'ANTHROPIC_AUTH_TOKEN',
    sonnet: { model: '', name: '' },
    opus: { model: '', name: '' },
    fable: { model: '', name: '' },
    haiku: { model: '', name: '' },
    subagentModel: '',
    fallbackModel: '',
    customHeaders: [],
    maxOutputTokens: '',
    hideAttribution: false,
    teammates: false,
    enableToolSearch: false,
    effortMax: false,
    disableAutoUpgrade: false
  }
}

export function sanitizeClaudeSettings(value: unknown): ClaudeSettingsView {
  if (!value || typeof value !== 'object') return emptyClaudeSettings()
  const item = value as Partial<ClaudeSettingsView>
  const role = (raw: unknown): ClaudeRoleConfig => {
    if (!raw || typeof raw !== 'object') return { model: '', name: '' }
    const row = raw as Partial<ClaudeRoleConfig>
    return { model: asString(row.model), name: asString(row.name) }
  }
  return {
    providerId: asString(item.providerId),
    baseUrl: asString(item.baseUrl),
    apiKey: asString(item.apiKey),
    authField: item.authField === 'ANTHROPIC_API_KEY' ? 'ANTHROPIC_API_KEY' : 'ANTHROPIC_AUTH_TOKEN',
    sonnet: role(item.sonnet),
    opus: role(item.opus),
    fable: role(item.fable),
    haiku: role(item.haiku),
    subagentModel: asString(item.subagentModel),
    fallbackModel: asString(item.fallbackModel),
    maxOutputTokens: asString(item.maxOutputTokens).replace(/[^\d]/g, ''),
    customHeaders: Array.isArray(item.customHeaders)
      ? item.customHeaders
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const row = entry as { key?: unknown; value?: unknown }
            const key = asString(row.key).trim()
            if (!key) return null
            return { key, value: asString(row.value) }
          })
          .filter((entry): entry is { key: string; value: string } => entry !== null)
      : [],
    hideAttribution: item.hideAttribution === true,
    teammates: item.teammates === true,
    enableToolSearch: item.enableToolSearch === true,
    effortMax: item.effortMax === true,
    disableAutoUpgrade: item.disableAutoUpgrade === true
  }
}

export function sanitizeClaudeSavePayload(value: unknown): ClaudeSavePayload {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const prompt = item.prompt && typeof item.prompt === 'object' ? (item.prompt as Record<string, unknown>) : {}
  const mode: ClaudePromptMode =
    prompt.mode === 'none' || prompt.mode === 'keep' || prompt.mode === 'preset' ? prompt.mode : 'keep'
  return {
    settings: sanitizeClaudeSettings(item.settings ?? item),
    prompt: {
      mode,
      content: typeof prompt.content === 'string' ? prompt.content : ''
    }
  }
}

export function parseClaudeSettings(raw: unknown): ClaudeSettingsView {
  const env = envOf(raw)
  const token = asString(env.ANTHROPIC_AUTH_TOKEN)
  const apiKey = asString(env.ANTHROPIC_API_KEY)
  const fallback = asString(env.ANTHROPIC_MODEL)
  const small = asString(env.ANTHROPIC_SMALL_FAST_MODEL)
  const sonnetModel = asString(env.ANTHROPIC_DEFAULT_SONNET_MODEL) || fallback || small
  const opusModel = asString(env.ANTHROPIC_DEFAULT_OPUS_MODEL) || fallback || small
  const haikuModel = asString(env.ANTHROPIC_DEFAULT_HAIKU_MODEL) || small || fallback
  const fableModel = asString(env.ANTHROPIC_DEFAULT_FABLE_MODEL) || opusModel
  const file = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const attribution =
    file.attribution && typeof file.attribution === 'object'
      ? (file.attribution as { commit?: unknown; pr?: unknown })
      : null

  return {
    providerId: asString(file.hyperswitchProvider),
    baseUrl: asString(env.ANTHROPIC_BASE_URL),
    apiKey: token || apiKey,
    authField: token || !apiKey ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY',
    sonnet: {
      model: sonnetModel,
      name: asString(env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME) || stripClaudeOneMMarker(sonnetModel)
    },
    opus: {
      model: opusModel,
      name: asString(env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME) || stripClaudeOneMMarker(opusModel)
    },
    fable: {
      model: fableModel,
      name: asString(env.ANTHROPIC_DEFAULT_FABLE_MODEL_NAME) || stripClaudeOneMMarker(fableModel)
    },
    haiku: {
      model: haikuModel,
      name: asString(env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME) || stripClaudeOneMMarker(haikuModel)
    },
    subagentModel: asString(env.CLAUDE_CODE_SUBAGENT_MODEL),
    fallbackModel: fallback,
    customHeaders: parseCustomHeaders(asString(env.ANTHROPIC_CUSTOM_HEADERS)),
    maxOutputTokens: asString(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).replace(/[^\d]/g, ''),
    hideAttribution:
      (asString(attribution?.commit) === '' &&
        asString(attribution?.pr) === '' &&
        attribution !== null) ||
      file.includeCoAuthoredBy === false,
    teammates: isOn(env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, ['1', 'true']),
    enableToolSearch: isOn(env.ENABLE_TOOL_SEARCH, ['1', 'true']),
    effortMax: asString(env.CLAUDE_CODE_EFFORT_LEVEL).trim().toLowerCase() === 'max',
    disableAutoUpgrade: isOn(env.DISABLE_AUTOUPDATER, ['1', 'true'])
  }
}

function setEnv(env: Record<string, unknown>, key: string, value: string): void {
  const trimmed = value.trim()
  if (trimmed) env[key] = trimmed
  else delete env[key]
}

export function applyClaudeSettings(
  existing: Record<string, unknown>,
  view: ClaudeSettingsView
): Record<string, unknown> {
  const envRaw = existing.env
  const env: Record<string, unknown> =
    envRaw && typeof envRaw === 'object' && !Array.isArray(envRaw)
      ? { ...(envRaw as Record<string, unknown>) }
      : {}

  setEnv(env, 'ANTHROPIC_BASE_URL', view.baseUrl)

  if (view.authField === 'ANTHROPIC_API_KEY') {
    setEnv(env, 'ANTHROPIC_API_KEY', view.apiKey)
    delete env.ANTHROPIC_AUTH_TOKEN
  } else {
    setEnv(env, 'ANTHROPIC_AUTH_TOKEN', view.apiKey)
    delete env.ANTHROPIC_API_KEY
  }

  const haikuModel = stripClaudeOneMMarker(view.haiku.model)
  setEnv(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL', view.sonnet.model)
  setEnv(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME', view.sonnet.name)
  setEnv(env, 'ANTHROPIC_DEFAULT_OPUS_MODEL', view.opus.model)
  setEnv(env, 'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME', view.opus.name)
  setEnv(env, 'ANTHROPIC_DEFAULT_FABLE_MODEL', view.fable.model)
  setEnv(env, 'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME', view.fable.name)
  setEnv(env, 'ANTHROPIC_DEFAULT_HAIKU_MODEL', haikuModel)
  setEnv(env, 'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME', view.haiku.name)
  setEnv(env, 'CLAUDE_CODE_SUBAGENT_MODEL', view.subagentModel)
  setEnv(env, 'ANTHROPIC_MODEL', view.fallbackModel)
  setEnv(env, 'ANTHROPIC_CUSTOM_HEADERS', serializeCustomHeaders(view.customHeaders))
  setEnv(env, 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', view.maxOutputTokens.replace(/[^\d]/g, ''))

  if (view.teammates) env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
  else delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
  if (view.enableToolSearch) env.ENABLE_TOOL_SEARCH = 'true'
  else delete env.ENABLE_TOOL_SEARCH
  if (view.effortMax) env.CLAUDE_CODE_EFFORT_LEVEL = 'max'
  else delete env.CLAUDE_CODE_EFFORT_LEVEL
  if (view.disableAutoUpgrade) env.DISABLE_AUTOUPDATER = '1'
  else delete env.DISABLE_AUTOUPDATER

  const next: Record<string, unknown> = { ...existing, env }
  if (Object.keys(env).length === 0) delete next.env
  const providerId = view.providerId.trim()
  if (providerId) next.hyperswitchProvider = providerId
  else delete next.hyperswitchProvider

  if (view.hideAttribution) {
    next.attribution = { commit: '', pr: '' }
    next.includeCoAuthoredBy = false
  } else {
    delete next.attribution
    delete next.includeCoAuthoredBy
  }

  return next
}
