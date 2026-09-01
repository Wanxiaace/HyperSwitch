import type { FetchedModel, FetchModelsInput } from '../shared/provider'

const FETCH_TIMEOUT_MS = 15_000
const ERROR_BODY_MAX_CHARS = 512

const KNOWN_COMPAT_SUFFIXES = [
  '/api/claudecode',
  '/api/anthropic',
  '/apps/anthropic',
  '/api/coding',
  '/claudecode',
  '/anthropic',
  '/step_plan',
  '/coding',
  '/claude'
]

function endsWithVersionSegment(url: string): boolean {
  const last = url.split('/').pop() ?? ''
  return /^v\d+$/.test(last)
}

function stripCompatSuffix(baseUrl: string): string | null {
  for (const suffix of KNOWN_COMPAT_SUFFIXES) {
    if (baseUrl.endsWith(suffix)) {
      return baseUrl.slice(0, -suffix.length)
    }
  }
  return null
}

export function buildModelsUrlCandidates(
  baseUrl: string,
  modelsUrlOverride?: string
): string[] {
  const override = modelsUrlOverride?.trim()
  if (override) return [override]

  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error('Base URL is empty')
  }

  const candidates: string[] = []
  if (endsWithVersionSegment(trimmed)) {
    candidates.push(`${trimmed}/models`)
    if (!trimmed.endsWith('/v1')) {
      candidates.push(`${trimmed}/v1/models`)
    }
  } else {
    candidates.push(`${trimmed}/v1/models`)
  }

  const stripped = stripCompatSuffix(trimmed)
  if (stripped) {
    const root = stripped.replace(/\/+$/, '')
    if (root.includes('://')) {
      candidates.push(`${root}/v1/models`)
      candidates.push(`${root}/models`)
    }
  }

  return candidates.filter((url, index) => candidates.indexOf(url) === index)
}

function authHeaders(input: FetchModelsInput): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const key = input.apiKey.trim()
  if (!key) {
    throw new Error('API Key or request headers are required to fetch models')
  }

  if (input.apiFormat === 'anthropic-messages') {
    headers['x-api-key'] = key
  } else if (input.apiFormat === 'google-generative-ai') {
    headers['x-goog-api-key'] = key
  } else {
    headers.Authorization = `Bearer ${key}`
  }
  return headers
}

function redact(body: string, secret: string): string {
  const trimmed = secret.trim()
  const redacted = trimmed ? body.split(trimmed).join('[REDACTED]') : body
  if ([...redacted].length <= ERROR_BODY_MAX_CHARS) return redacted
  return `${[...redacted].slice(0, ERROR_BODY_MAX_CHARS).join('')}…`
}

function parseModels(payload: unknown): FetchedModel[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Failed to parse response')
  }

  const record = payload as Record<string, unknown>
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : Array.isArray(payload)
        ? payload
        : null

  if (!rows) {
    throw new Error('Failed to parse response')
  }

  const models: FetchedModel[] = []
  for (const row of rows) {
    if (typeof row === 'string' && row.trim()) {
      models.push({ id: row.trim(), ownedBy: null })
      continue
    }
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const rawId =
      (typeof item.id === 'string' && item.id) ||
      (typeof item.name === 'string' && item.name) ||
      ''
    const id = rawId.replace(/^models\//, '').trim()
    if (!id) continue
    const ownedBy =
      typeof item.owned_by === 'string'
        ? item.owned_by
        : typeof item.ownedBy === 'string'
          ? item.ownedBy
          : null
    models.push({ id, ownedBy })
  }

  models.sort((a, b) => a.id.localeCompare(b.id))
  return models
}

export async function fetchModels(input: FetchModelsInput): Promise<FetchedModel[]> {
  const candidates = buildModelsUrlCandidates(input.baseUrl, input.modelsUrl)
  const headers = authHeaders(input)
  let lastNotFound: string | null = null

  for (const url of candidates) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        throw new Error('Request timed out')
      }
      throw new Error(`Request failed: ${message}`)
    })

    if (response.ok) {
      const payload: unknown = await response.json().catch(() => {
        throw new Error('Failed to parse response')
      })
      return parseModels(payload)
    }

    const body = redact(await response.text().catch(() => ''), input.apiKey)
    if (response.status === 404 || response.status === 405) {
      lastNotFound = `HTTP ${response.status}: ${body}`
      continue
    }
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  throw new Error(`All candidates failed: ${lastNotFound ?? 'no candidates'}`)
}
