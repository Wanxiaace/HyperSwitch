import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { Document, parseDocument } from 'yaml'
import {
  applyOmpSections,
  parseOmpSettings,
  sanitizeOmpSavePayload,
  type OmpLoadResult
} from '../../shared/ompSettings'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { fileExists, readText } from './fs'
import type { AgentRuntimePlugin } from './types'

function getAgentDir(): string {
  const configured = process.env.PI_CODING_AGENT_DIR?.trim()
  if (configured) return configured
  return join(homedir(), '.omp', 'agent')
}

async function pickPath(preferred: string, fallback: string): Promise<string> {
  if (await fileExists(preferred)) return preferred
  if (await fileExists(fallback)) return fallback
  return preferred
}

function getModelsPath(): Promise<string> {
  const dir = getAgentDir()
  return pickPath(join(dir, 'models.yml'), join(dir, 'models.yaml'))
}

function getConfigPath(): Promise<string> {
  const dir = getAgentDir()
  return pickPath(join(dir, 'config.yml'), join(dir, 'config.yaml'))
}

function getAgentsMdPath(): string {
  return join(getAgentDir(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(getAgentDir(), 'agents.md.origin.bak')
}

function yamlError(
  path: string,
  errors: readonly { code: string; linePos?: { line: number; col: number }[] }[]
): string {
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

async function writeYaml(path: string, document: Document): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const text = document.toString()
  await writeFile(path, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
}

async function load(): Promise<OmpLoadResult> {
  const path = await getModelsPath()
  const configPath = await getConfigPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  const modelsText = await readText(path)
  const configText = await readText(configPath)
  const modelsDoc =
    modelsText != null && modelsText.trim() ? parseYamlDocument(modelsText, path) : null
  const configDoc =
    configText != null && configText.trim() ? parseYamlDocument(configText, configPath) : null
  return {
    exists:
      (await fileExists(path)) ||
      (await fileExists(configPath)) ||
      (await fileExists(getAgentsMdPath())),
    path,
    settings: parseOmpSettings(modelsDoc ? yamlMap(modelsDoc) : {}, configDoc ? yamlMap(configDoc) : {}),
    prompt
  }
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizeOmpSavePayload(payload)
  const modelsPath = await getModelsPath()
  const configPath = await getConfigPath()
  const modelsExisting = await readText(modelsPath)
  const modelsDoc = parseYamlDocument(modelsExisting, modelsPath)
  const applied = applyOmpSections(yamlMap(modelsDoc), settings)
  for (const key of applied.removed) modelsDoc.deleteIn(['providers', key])
  for (const [slug, profile] of Object.entries(applied.providers)) {
    modelsDoc.setIn(['providers', slug], profile)
  }
  if (Object.keys(applied.providers).length === 0) {
    modelsDoc.setIn(['providers'], {})
  }
  await writeYaml(modelsPath, modelsDoc)

  const configExisting = await readText(configPath)
  const configDoc = parseYamlDocument(configExisting, configPath)
  if (applied.defaultModel) configDoc.setIn(['modelRoles', 'default'], applied.defaultModel)
  else configDoc.deleteIn(['modelRoles', 'default'])
  if (applied.thinkingLevel) configDoc.setIn(['defaultThinkingLevel'], applied.thinkingLevel)
  else configDoc.deleteIn(['defaultThinkingLevel'])
  await writeYaml(configPath, configDoc)

  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const ompPlugin: AgentRuntimePlugin = {
  id: 'omp',
  load,
  save
}
