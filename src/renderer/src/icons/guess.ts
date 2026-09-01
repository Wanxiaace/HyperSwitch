import { iconMetadata } from './extracted/metadata'

const MODEL_VENDORS: [string, string][] = [
  ['chatgpt', 'openai'],
  ['openai', 'openai'],
  ['claude', 'claude'],
  ['anthropic', 'anthropic'],
  ['gemini', 'gemini'],
  ['gemma', 'gemma'],
  ['deepseek', 'deepseek'],
  ['mistral', 'mistral'],
  ['minimax', 'minimax'],
  ['hunyuan', 'hunyuan'],
  ['doubao', 'doubao'],
  ['qwen', 'qwen'],
  ['llama', 'meta'],
  ['kimi', 'kimi'],
  ['grok', 'grok'],
  ['glm', 'chatglm'],
  ['gpt', 'openai'],
  ['o1', 'openai'],
  ['o3', 'openai'],
  ['o4', 'openai']
]

export function guessIcon(name: string, url = ''): string {
  const hay = `${name} ${url}`.toLowerCase()
  if (!hay.trim()) return ''

  let best = ''
  let bestLen = 2
  for (const meta of Object.values(iconMetadata)) {
    const candidates = [meta.name, meta.displayName, ...meta.keywords]
    for (const candidate of candidates) {
      const key = candidate.toLowerCase()
      if (key.length > bestLen && hay.includes(key)) {
        best = meta.name
        bestLen = key.length
      }
    }
  }
  return best
}

export function guessModelIcon(id: string, name = '', fallback = ''): string {
  const tokens = `${name} ${id}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  let best = ''
  let bestLen = 1
  for (const [alias, icon] of MODEL_VENDORS) {
    if (alias.length > bestLen && tokens.includes(alias)) {
      best = icon
      bestLen = alias.length
    }
  }
  if (best) return best
  const tokensJoined = id.replace(/[-_/]/g, ' ')
  return guessIcon(`${name} ${id} ${tokensJoined}`) || fallback
}
