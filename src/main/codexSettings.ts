import { access, copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { getDataDir } from './configStore'
import {
  buildCatalogFile,
  CODEX_CATALOG_FILENAME,
  emptyCodexSettings,
  parseCatalogFile,
  sanitizeCodexSavePayload,
  type CodexLoadResult,
  type CodexPromptMode,
  type CodexSettingsView
} from '../shared/codexSettings'
import { isProviderKey } from '../shared/provider'
import {
  getHttpHeaders,
  getTableKey,
  getTopLevel,
  removeTable,
  setHttpHeaders,
  setTableKey,
  setTopLevel
} from './tomlPatch'

function codexProviderId(value: string): string {
  const id = value.trim()
  return id && isProviderKey(id) ? id : 'custom'
}

function providerTable(id: string): string {
  return `model_providers.${codexProviderId(id)}`
}

function removeProviderTable(toml: string, id: string): string {
  const key = id.trim()
  if (!key) return toml
  const table = `model_providers.${key}`
  let next = removeTable(toml, `${table}.http_headers`)
  next = removeTable(next, table)
  return next
}

const AGENTS_MD = 'AGENTS.md'
const AGENTS_MD_BAK = 'agents.md.origin.bak'
const INSTRUCTIONS_BAK = 'model_instructions_file.origin.bak'

export function getCodexDir(): string {
  return join(homedir(), '.codex')
}

export function getCodexConfigPath(): string {
  return join(getCodexDir(), 'config.toml')
}

export function getCodexAuthPath(): string {
  return join(getCodexDir(), 'auth.json')
}

export function getCodexCatalogPath(): string {
  return join(getCodexDir(), CODEX_CATALOG_FILENAME)
}

export function getAgentsMdPath(): string {
  return join(getCodexDir(), AGENTS_MD)
}

export function getAgentsMdBakPath(): string {
  return join(getCodexDir(), AGENTS_MD_BAK)
}

export function getPromptFilePath(presetId: string): string {
  return join(getDataDir(), 'prompt-files', `${presetId}.md`)
}

export function getInstructionsBakPath(): string {
  return join(getCodexDir(), INSTRUCTIONS_BAK)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw error
  }
}

async function readAuthKey(): Promise<string> {
  const raw = await readText(getCodexAuthPath())
  if (!raw) return ''
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return ''
    const key = (parsed as { OPENAI_API_KEY?: unknown }).OPENAI_API_KEY
    return typeof key === 'string' ? key : ''
  } catch {
    return ''
  }
}

async function writeAuthKey(apiKey: string): Promise<void> {
  await mkdir(getCodexDir(), { recursive: true })
  let existing: Record<string, unknown> = {}
  const raw = await readText(getCodexAuthPath())
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>
      }
    } catch {
      existing = {}
    }
  }
  if (apiKey.trim()) existing.OPENAI_API_KEY = apiKey.trim()
  else delete existing.OPENAI_API_KEY
  await writeFile(getCodexAuthPath(), `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
}

async function loadAgentsMd(): Promise<{ bakExists: boolean; content: string }> {
  const bakExists = await fileExists(getAgentsMdBakPath())
  return { bakExists, content: (await readText(getAgentsMdPath())) ?? '' }
}

async function applyMarkdownFile(
  mode: CodexPromptMode,
  content: string,
  filePath: string,
  bakPath: string
): Promise<void> {
  if (mode === 'keep') return
  await mkdir(dirname(filePath), { recursive: true })
  if (mode === 'none') {
    if (!(await fileExists(bakPath))) return
    await writeFile(filePath, await readFile(bakPath))
    await unlink(bakPath)
    return
  }
  const hasBak = await fileExists(bakPath)
  if (!hasBak) {
    const existing = await readText(filePath)
    if (!content.replace(/\r\n/g, '\n').trim() && existing?.replace(/\r\n/g, '\n').trim()) return
    if (existing !== null) await copyFile(filePath, bakPath)
    else await writeFile(bakPath, '')
  }
  await writeFile(filePath, content)
}

async function loadCatalog(toml: string): Promise<CodexSettingsView['catalog']> {
  const pointer = getTopLevel(toml, 'model_catalog_json')
  if (!pointer) return []
  const fileName = pointer.replace(/\\/g, '/').split('/').pop() ?? pointer
  const path = join(getCodexDir(), fileName)
  const raw = await readText(path)
  if (!raw) return []
  try {
    return parseCatalogFile(JSON.parse(raw))
  } catch {
    return []
  }
}

function parseSettings(toml: string, apiKey: string, catalog: CodexSettingsView['catalog']): CodexSettingsView {
  const providerId = getTopLevel(toml, 'model_provider') || ''
  const table = providerTable(providerId)
  const name = getTableKey(toml, table, 'name') || providerId || 'custom'
  return {
    apiKey,
    baseUrl: getTableKey(toml, table, 'base_url') || '',
    providerId,
    providerName: name,
    model: getTopLevel(toml, 'model') || '',
    contextWindow: getTopLevel(toml, 'model_context_window') || '',
    maxOutput: getTopLevel(toml, 'model_max_output_tokens') || '',
    reasoningEffort: getTopLevel(toml, 'model_reasoning_effort') || 'high',
    disableResponseStorage: getTopLevel(toml, 'disable_response_storage') !== 'false',
    remoteCompaction: name.trim().toLowerCase() === 'openai',
    catalog,
    customHeaders: getHttpHeaders(toml, table)
  }
}

function applySettings(toml: string, view: CodexSettingsView, catalogName: string | null): string {
  const previousId = getTopLevel(toml, 'model_provider') || 'custom'
  const nextId = codexProviderId(view.providerId)
  const table = providerTable(nextId)
  let next = toml || ''
  next = setTopLevel(next, 'model_provider', nextId)
  next = setTopLevel(next, 'model', view.model.trim() || null)
  const context = Number(view.contextWindow)
  const maxOutput = Number(view.maxOutput)
  next = setTopLevel(
    next,
    'model_context_window',
    Number.isFinite(context) && context > 0 ? context : null
  )
  next = setTopLevel(
    next,
    'model_max_output_tokens',
    Number.isFinite(maxOutput) && maxOutput > 0 ? maxOutput : null
  )
  next = setTopLevel(next, 'model_reasoning_effort', view.reasoningEffort.trim() || null)
  next = setTopLevel(next, 'disable_response_storage', view.disableResponseStorage)
  next = setTopLevel(next, 'model_catalog_json', catalogName)
  const displayName = view.remoteCompaction ? 'OpenAI' : view.providerName.trim() || nextId
  next = setTableKey(next, table, 'name', displayName)
  next = setTableKey(next, table, 'base_url', view.baseUrl.trim() || null)
  next = setTableKey(next, table, 'wire_api', 'responses')
  next = setTableKey(next, table, 'requires_openai_auth', true)
  next = setHttpHeaders(next, table, view.customHeaders)
  if (previousId !== nextId) next = removeProviderTable(next, previousId)
  return next.replace(/\n{3,}/g, '\n\n')
}

async function loadInstructions(toml: string): Promise<CodexLoadResult['instructions']> {
  const pointer = getTopLevel(toml, 'model_instructions_file')?.trim() ?? ''
  const bakExists = await fileExists(getInstructionsBakPath())
  return {
    path: pointer,
    configured: pointer.length > 0,
    bakExists,
    content: pointer ? ((await readText(pointer)) ?? '') : ''
  }
}

async function applyInstructionsField(
  toml: string,
  mode: CodexPromptMode,
  content: string,
  presetId: string
): Promise<string> {
  if (mode === 'keep') return toml
  await mkdir(getCodexDir(), { recursive: true })
  const bakPath = getInstructionsBakPath()
  if (mode === 'none') {
    if (!(await fileExists(bakPath))) return toml
    const original = (await readFile(bakPath, 'utf8')).trim()
    await unlink(bakPath)
    return setTopLevel(toml, 'model_instructions_file', original || null)
  }
  const id = presetId.trim() || 'current'
  const presetPath = getPromptFilePath(id)
  if (!(await fileExists(bakPath))) {
    const current = getTopLevel(toml, 'model_instructions_file')?.trim() ?? ''
    await writeFile(bakPath, current)
  }
  await mkdir(dirname(presetPath), { recursive: true })
  await writeFile(presetPath, content)
  return setTopLevel(toml, 'model_instructions_file', presetPath)
}

export async function loadCodexSettings(): Promise<CodexLoadResult> {
  const path = getCodexConfigPath()
  const prompt = await loadAgentsMd()
  const toml = await readText(path)
  const apiKey = await readAuthKey()
  const emptyInstructions = {
    path: '',
    configured: false,
    bakExists: false,
    content: ''
  }
  if (toml === null) {
    return {
      exists: false,
      path,
      settings: { ...emptyCodexSettings(), apiKey },
      prompt,
      instructions: emptyInstructions
    }
  }
  const catalog = await loadCatalog(toml)
  return {
    exists: true,
    path,
    settings: parseSettings(toml, apiKey, catalog),
    prompt,
    instructions: await loadInstructions(toml)
  }
}

export async function saveCodexSettings(input: unknown): Promise<void> {
  const payload = sanitizeCodexSavePayload(input)
  await mkdir(getCodexDir(), { recursive: true })
  const existing = (await readText(getCodexConfigPath())) ?? ''
  const catalog = buildCatalogFile(payload.settings.catalog)
  const catalogPath = getCodexCatalogPath()
  const currentPointer = getTopLevel(existing, 'model_catalog_json')
  const ownsPointer = !currentPointer || currentPointer.replace(/\\/g, '/').endsWith(CODEX_CATALOG_FILENAME)
  let catalogName: string | null = currentPointer
  if (catalog) {
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
    catalogName = CODEX_CATALOG_FILENAME
  } else if (ownsPointer) {
    catalogName = null
    if (await fileExists(catalogPath)) await unlink(catalogPath)
  }
  let next = applySettings(existing, payload.settings, catalogName)
  next = await applyInstructionsField(
    next,
    payload.instructions.mode,
    payload.instructions.content,
    payload.instructions.presetId ?? ''
  )
  await writeFile(getCodexConfigPath(), next.endsWith('\n') ? next : `${next}\n`, 'utf8')
  await writeAuthKey(payload.settings.apiKey)
  await applyMarkdownFile(payload.prompt.mode, payload.prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}
