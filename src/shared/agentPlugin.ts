import type { ApiFormat } from './provider'

export const AGENT_PLUGIN_IDS = ['claude', 'codex', 'opencode', 'grok', 'pi', 'dsh', 'zcode', 'omp'] as const

export type AgentPluginId = (typeof AGENT_PLUGIN_IDS)[number]

export type AgentPromptMode = 'none' | 'keep' | 'preset'

export interface AgentPromptState {
  bakExists: boolean
  content: string
}

export interface AgentPromptAction {
  mode: AgentPromptMode
  content: string
  presetId?: string
}

export interface AgentPluginInfo {
  id: AgentPluginId
  name: string
  dirs: string[]
  formats?: ApiFormat[]
  icon: string
  /** When false, the tool is detected but has no live-config editor yet. */
  hasEditor: boolean
}

/**
 * Built-in agent plugins. To add a new agent:
 * 1. Append metadata here
 * 2. Implement load/save in `src/main/agentPlugins/<id>.ts` and register it
 * 3. Add a Vue editor and register it in `src/renderer/src/agents/registry.ts`
 */
export const AGENT_PLUGINS: AgentPluginInfo[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    dirs: ['.claude'],
    formats: ['anthropic-messages'],
    icon: 'claude',
    hasEditor: true
  },
  {
    id: 'codex',
    name: 'Codex',
    dirs: ['.codex'],
    formats: ['openai-responses'],
    icon: 'openai',
    hasEditor: true
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    dirs: ['.opencode', '.config/opencode'],
    icon: 'opencode',
    hasEditor: true
  },
  {
    id: 'grok',
    name: 'Grok Build',
    dirs: ['.grok'],
    formats: ['openai-completions', 'openai-responses', 'anthropic-messages'],
    icon: 'grok',
    hasEditor: true
  },
  {
    id: 'pi',
    name: 'Pi Agent',
    dirs: ['.pi'],
    icon: 'pi',
    hasEditor: true
  },
  {
    id: 'dsh',
    name: 'DeepSeek Harness',
    dirs: ['.dsh'],
    formats: ['openai-completions', 'openai-responses', 'anthropic-messages'],
    icon: 'dsh',
    hasEditor: true
  },
  {
    id: 'zcode',
    name: 'ZCode',
    dirs: ['.zcode'],
    formats: ['openai-completions', 'openai-responses', 'anthropic-messages'],
    icon: 'zcode',
    hasEditor: true
  },
  {
    id: 'omp',
    name: 'oh-my-pi',
    dirs: ['.omp'],
    formats: ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'],
    icon: 'omp',
    hasEditor: true
  }
]

export function getAgentPlugin(id: string): AgentPluginInfo | undefined {
  return AGENT_PLUGINS.find((plugin) => plugin.id === id)
}

export function pluginFormats(id: AgentPluginId): ApiFormat[] | undefined {
  return getAgentPlugin(id)?.formats
}

export function samePromptText(a: string, b: string): boolean {
  return a.replace(/\r\n/g, '\n').trim() === b.replace(/\r\n/g, '\n').trim()
}

export function resolvePromptAction(
  enabled: boolean,
  bakExists: boolean,
  content: string,
  savedContent: string
): AgentPromptAction {
  if (!enabled) {
    return bakExists
      ? { mode: 'none', content: '', presetId: '' }
      : { mode: 'keep', content: '', presetId: '' }
  }
  if (!bakExists && samePromptText(content, '')) {
    return { mode: 'keep', content: '', presetId: '' }
  }
  if (bakExists && samePromptText(content, savedContent)) {
    return { mode: 'keep', content: '', presetId: '' }
  }
  return { mode: 'preset', content, presetId: '' }
}

export function asPromptAction(value: unknown): AgentPromptAction {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const mode: AgentPromptMode =
    item.mode === 'none' || item.mode === 'keep' || item.mode === 'preset' ? item.mode : 'keep'
  return {
    mode,
    content: typeof item.content === 'string' ? item.content : '',
    presetId: typeof item.presetId === 'string' ? item.presetId : ''
  }
}

export function slugify(value: string, fallback = 'custom'): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}
