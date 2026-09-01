import { app } from 'electron'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentToolBinding, AgentToolBindings } from '../shared/agentTools'
import {
  normalizeHeaderPresets,
  normalizePromptPresets,
  type HeaderPreset,
  type PromptPreset
} from '../shared/presets'
import { emptyPrefs, normalizePrefs, type AppPrefs } from '../shared/locale'
import { emptyModel, type AppConfigFile, type ProviderConfig } from '../shared/provider'

const EMPTY: AppConfigFile = {
  version: 1,
  providers: [],
  agentBindings: {},
  promptPresets: [],
  headerPresets: []
}

export function getDataDir(): string {
  return join(homedir(), '.hyperswitch')
}

function providersPath(): string {
  return join(getDataDir(), 'providers.json')
}

function bindingsPath(): string {
  return join(getDataDir(), 'agent-bindings.json')
}

function promptsPath(): string {
  return join(getDataDir(), 'prompt-presets.json')
}

function headersPath(): string {
  return join(getDataDir(), 'header-presets.json')
}

function onboardedPath(): string {
  return join(getDataDir(), 'onboarded')
}

function prefsPath(): string {
  return join(getDataDir(), 'prefs.json')
}

function combinedPath(): string {
  return join(getDataDir(), 'config.json')
}

function combinedLegacyPath(): string {
  return join(getDataDir(), 'config.legacy.json')
}

function electronLegacyPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function isProvider(value: unknown): value is ProviderConfig {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ProviderConfig>
  return typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.models)
}

function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    slug: typeof provider.slug === 'string' ? provider.slug.trim() : '',
    icon: typeof provider.icon === 'string' ? provider.icon : '',
    models: provider.models.map((model) => emptyModel(model))
  }
}

function asBinding(value: unknown): AgentToolBinding | null {
  if (!value || typeof value !== 'object') return null
  const item = value as { providerId?: unknown; modelKey?: unknown }
  if (typeof item.providerId !== 'string' || typeof item.modelKey !== 'string') return null
  return { providerId: item.providerId, modelKey: item.modelKey }
}

function normalizeBindings(value: unknown): AgentToolBindings {
  if (!value || typeof value !== 'object') return {}
  const result: AgentToolBindings = {}
  for (const [id, binding] of Object.entries(value as Record<string, unknown>)) {
    const list = Array.isArray(binding) ? binding : [binding]
    const items = list.map(asBinding).filter((item): item is AgentToolBinding => item !== null)
    if (items.length > 0) result[id as keyof AgentToolBindings] = items
  }
  return result
}

function normalizeProviders(value: unknown): ProviderConfig[] {
  if (!Array.isArray(value)) return []
  return value.filter(isProvider).map(normalizeProvider)
}

function normalizeCombined(parsed: unknown): AppConfigFile {
  if (!parsed || typeof parsed !== 'object') return { ...EMPTY }
  const file = parsed as Partial<AppConfigFile> & { providers?: unknown }
  return {
    version: 1,
    providers: normalizeProviders(file.providers),
    agentBindings: normalizeBindings(file.agentBindings),
    promptPresets: normalizePromptPresets(file.promptPresets),
    headerPresets: normalizeHeaderPresets(file.headerPresets)
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw error
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(getDataDir(), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const writeQueues = new Map<string, Promise<void>>()

function enqueueWrite(path: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(path) ?? Promise.resolve()
  const next = previous.then(task, task)
  writeQueues.set(
    path,
    next.then(
      () => undefined,
      () => undefined
    )
  )
  return next
}

async function archiveCombined(path: string): Promise<void> {
  try {
    await rename(path, combinedLegacyPath())
    return
  } catch {
    // Destination already exists, or rename is unavailable.
  }
  try {
    await unlink(path)
  } catch {
    // Leave the combined file if it cannot be moved or removed.
  }
}

let migratePromise: Promise<void> | null = null

async function migrateToSplitFiles(): Promise<void> {
  await mkdir(getDataDir(), { recursive: true })

  const hasSplit = (
    await Promise.all([
      fileExists(providersPath()),
      fileExists(bindingsPath()),
      fileExists(promptsPath()),
      fileExists(headersPath())
    ])
  ).some(Boolean)

  if (!(await fileExists(combinedPath())) && !hasSplit && (await fileExists(electronLegacyPath()))) {
    try {
      await writeFile(combinedPath(), await readFile(electronLegacyPath(), 'utf8'), 'utf8')
    } catch {
      // Ignore a unreadable Electron userData config.
    }
  }

  if (!(await fileExists(combinedPath()))) return

  let parsed: AppConfigFile
  try {
    parsed = normalizeCombined(await readJson(combinedPath()))
  } catch {
    return
  }

  if (!(await fileExists(providersPath()))) {
    await writeJson(providersPath(), { version: 1, providers: parsed.providers })
  }
  if (!(await fileExists(bindingsPath()))) {
    await writeJson(bindingsPath(), { version: 1, agentBindings: parsed.agentBindings ?? {} })
  }
  if (!(await fileExists(promptsPath()))) {
    await writeJson(promptsPath(), { version: 1, promptPresets: parsed.promptPresets ?? [] })
  }
  if (!(await fileExists(headersPath()))) {
    await writeJson(headersPath(), { version: 1, headerPresets: parsed.headerPresets ?? [] })
  }
  await archiveCombined(combinedPath())
}

function ensureMigrated(): Promise<void> {
  if (!migratePromise) migratePromise = migrateToSplitFiles()
  return migratePromise
}

export async function loadProviders(): Promise<ProviderConfig[]> {
  await ensureMigrated()
  const parsed = await readJson(providersPath())
  if (!parsed || typeof parsed !== 'object') return []
  return normalizeProviders((parsed as { providers?: unknown }).providers)
}

export async function loadAgentBindings(): Promise<AgentToolBindings> {
  await ensureMigrated()
  const parsed = await readJson(bindingsPath())
  if (!parsed || typeof parsed !== 'object') return {}
  return normalizeBindings((parsed as { agentBindings?: unknown }).agentBindings)
}

export async function loadPromptPresets(): Promise<PromptPreset[]> {
  await ensureMigrated()
  const parsed = await readJson(promptsPath())
  if (!parsed || typeof parsed !== 'object') return []
  return normalizePromptPresets((parsed as { promptPresets?: unknown }).promptPresets)
}

export async function loadHeaderPresets(): Promise<HeaderPreset[]> {
  await ensureMigrated()
  const parsed = await readJson(headersPath())
  if (!parsed || typeof parsed !== 'object') return []
  return normalizeHeaderPresets((parsed as { headerPresets?: unknown }).headerPresets)
}

export async function loadConfig(): Promise<AppConfigFile> {
  const [providers, agentBindings, promptPresets, headerPresets] = await Promise.all([
    loadProviders(),
    loadAgentBindings(),
    loadPromptPresets(),
    loadHeaderPresets()
  ])
  return { version: 1, providers, agentBindings, promptPresets, headerPresets }
}

export async function saveConfig(providers: ProviderConfig[]): Promise<void> {
  await ensureMigrated()
  const list = normalizeProviders(providers)
  return enqueueWrite(providersPath(), () =>
    writeJson(providersPath(), { version: 1, providers: list })
  )
}

export async function saveAgentBindings(agentBindings: AgentToolBindings): Promise<void> {
  await ensureMigrated()
  const bindings = normalizeBindings(agentBindings)
  return enqueueWrite(bindingsPath(), () =>
    writeJson(bindingsPath(), { version: 1, agentBindings: bindings })
  )
}

export async function savePromptPresets(promptPresets: PromptPreset[]): Promise<void> {
  await ensureMigrated()
  const list = normalizePromptPresets(promptPresets)
  return enqueueWrite(promptsPath(), () =>
    writeJson(promptsPath(), { version: 1, promptPresets: list })
  )
}

export async function saveHeaderPresets(headerPresets: HeaderPreset[]): Promise<void> {
  await ensureMigrated()
  const list = normalizeHeaderPresets(headerPresets)
  return enqueueWrite(headersPath(), () =>
    writeJson(headersPath(), { version: 1, headerPresets: list })
  )
}

export async function hasOnboarded(): Promise<boolean> {
  return fileExists(onboardedPath())
}

export async function markOnboarded(): Promise<void> {
  await mkdir(getDataDir(), { recursive: true })
  await writeFile(onboardedPath(), `${new Date().toISOString()}\n`, 'utf8')
}

export async function loadPrefs(): Promise<AppPrefs> {
  const parsed = await readJson(prefsPath())
  if (!parsed) return emptyPrefs()
  return normalizePrefs(parsed)
}

export async function savePrefs(prefs: AppPrefs): Promise<void> {
  const next = normalizePrefs(prefs)
  return enqueueWrite(prefsPath(), () => writeJson(prefsPath(), { version: 1, locale: next.locale }))
}
