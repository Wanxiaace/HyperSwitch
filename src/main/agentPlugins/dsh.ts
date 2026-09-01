import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { Document, parseDocument } from 'yaml'
import {
  applyDshSections,
  parseDshSettings,
  sanitizeDshSavePayload,
  type DshLoadResult
} from '../../shared/dshSettings'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { fileExists, readText } from './fs'
import type { AgentRuntimePlugin } from './types'

function resolveDshHome(): string {
  const configured = process.env.DSH_HOME?.trim()
  if (configured) return configured
  return join(homedir(), '.dsh')
}

function getSettingsPath(): string {
  return join(resolveDshHome(), 'settings.yaml')
}

function getCredentialsPath(): string {
  return join(resolveDshHome(), '.credentials.yaml')
}

function getAgentsMdPath(): string {
  return join(resolveDshHome(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(resolveDshHome(), 'agents.md.origin.bak')
}

function yamlError(path: string, errors: readonly { code: string; linePos?: { line: number; col: number }[] }[]): string {
  const detail = errors
    .map((error) => {
      const at = error.linePos?.[0]
      return `${error.code}${at ? ` at line ${String(at.line)}, column ${String(at.col)}` : ''}`
    })
    .join('; ')
  return `Failed to parse ${path}${detail ? `: ${detail}` : ''}`
}

function parseYamlDocument(text: string | null, path: string): Document {
  if (text == null || !text.trim()) return new Document({})
  const document = parseDocument(text, { prettyErrors: true })
  if (document.errors.length > 0) throw new Error(yamlError(path, document.errors))
  const root = document.toJS() ?? {}
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    throw new TypeError(`${path} must be a YAML object`)
  }
  return document
}

function yamlMap(document: Document): Record<string, unknown> {
  const root = document.toJS() ?? {}
  return typeof root === 'object' && root !== null && !Array.isArray(root)
    ? (root as Record<string, unknown>)
    : {}
}

async function writeYaml(path: string, document: Document, mode?: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const text = document.toString()
  await writeFile(path, text.endsWith('\n') ? text : `${text}\n`, mode === undefined ? 'utf8' : { encoding: 'utf8', mode })
}

async function load(): Promise<DshLoadResult> {
  const path = getSettingsPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  const settingsText = await readText(path)
  const credentialsText = await readText(getCredentialsPath())
  let credentials: Record<string, unknown> = {}
  if (credentialsText != null && credentialsText.trim()) {
    try {
      credentials = yamlMap(parseYamlDocument(credentialsText, getCredentialsPath()))
    } catch {
      credentials = {}
    }
  }
  const settingsDoc = settingsText != null && settingsText.trim() ? parseYamlDocument(settingsText, path) : null
  return {
    exists:
      (await fileExists(path)) ||
      (await fileExists(getCredentialsPath())) ||
      (await fileExists(getAgentsMdPath())),
    path,
    settings: parseDshSettings(settingsDoc ? yamlMap(settingsDoc) : {}, credentials),
    prompt
  }
}

async function patchCredentials(entries: { env: string; apiKey: string }[]): Promise<void> {
  const writes = entries.filter((entry) => entry.env.trim() && entry.apiKey.trim())
  if (writes.length === 0) return
  const path = getCredentialsPath()
  const existing = await readText(path)
  const document = parseYamlDocument(existing, path)
  const root = yamlMap(document)
  const versioned = root.version === 1 || root.refs != null || existing == null || !existing.trim()
  if (versioned && root.version == null) document.setIn(['version'], 1)
  for (const entry of writes) {
    const name = entry.env.trim()
    const value = entry.apiKey.trim()
    if (versioned) document.setIn(['refs', name], value)
    else document.setIn([name], value)
  }
  await writeYaml(path, document, 0o600)
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizeDshSavePayload(payload)
  const path = getSettingsPath()
  const existing = await readText(path)
  const document = parseYamlDocument(existing, path)
  const applied = applyDshSections(yamlMap(document), settings)
  for (const key of applied.removed) document.deleteIn(['llm-pi-ai', 'providers', key])
  for (const [slug, profile] of Object.entries(applied.providers)) {
    document.setIn(['llm-pi-ai', 'providers', slug], profile)
  }
  if (Object.keys(applied.providers).length === 0) {
    document.setIn(['llm-pi-ai', 'providers'], {})
  }
  document.setIn(['agent-default-model'], applied.defaultModel)
  await writeYaml(path, document)
  await patchCredentials(applied.credentials)
  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const dshPlugin: AgentRuntimePlugin = {
  id: 'dsh',
  load,
  save
}
