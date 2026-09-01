import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  emptyGrokCatalogRow,
  emptyGrokSettings,
  grokMenuName,
  grokProfileFor,
  GROK_DEFAULT_BACKEND,
  GROK_DEFAULT_CONTEXT_WINDOW,
  GROK_DEFAULT_MAX_OUTPUT,
  sanitizeGrokSavePayload,
  type GrokSettingsView
} from '../../shared/grokSettings'
import {
  getInlineTable,
  getTableArray,
  getTableKey,
  listModelProfiles,
  modelTableName,
  removeTable,
  setInlineTable,
  setTableArray,
  setTableKey
} from '../tomlPatch'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { readText, writeText } from './fs'
import type { AgentRuntimePlugin } from './types'

function getGrokDir(): string {
  return join(homedir(), '.grok')
}

function getGrokConfigPath(): string {
  return join(getGrokDir(), 'config.toml')
}

function getAgentsMdPath(): string {
  return join(getGrokDir(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(getGrokDir(), 'agents.md.origin.bak')
}

function parseSettings(toml: string): GrokSettingsView {
  const profiles = listModelProfiles(toml)
  const catalog = profiles.map((profile) => {
    const table = modelTableName(profile)
    const context = getTableKey(toml, table, 'context_window') || ''
    const maxOutput = getTableKey(toml, table, 'max_completion_tokens') || ''
    return emptyGrokCatalogRow({
      profile,
      model: getTableKey(toml, table, 'model') || '',
      displayName: getTableKey(toml, table, 'name') || '',
      contextWindow: context.replace(/[^\d]/g, ''),
      maxOutput: maxOutput.replace(/[^\d]/g, ''),
      reasoningLevels: getTableArray(toml, table, 'reasoning_efforts')
    })
  })
  const defaultProfile = getTableKey(toml, 'models', 'default') || catalog[0]?.profile || ''
  const selected = catalog.find((row) => row.profile === defaultProfile) ?? catalog[0]
  const table = selected ? modelTableName(selected.profile) : ''
  return {
    apiKey: table ? getTableKey(toml, table, 'api_key') || '' : '',
    baseUrl: table ? getTableKey(toml, table, 'base_url') || '' : '',
    providerId: getTableKey(toml, 'hyperswitch', 'provider') || '',
    providerName: selected?.displayName || '',
    apiBackend: (table && getTableKey(toml, table, 'api_backend')) || GROK_DEFAULT_BACKEND,
    defaultProfile,
    reasoningEffort: getTableKey(toml, 'models', 'default_reasoning_effort') || '',
    catalog,
    customHeaders: getInlineTable(toml, 'models', 'extra_headers')
  }
}

function applySettings(toml: string, view: GrokSettingsView): string {
  let next = toml || ''
  const rows = view.catalog
    .map((row) => ({ ...row, profile: grokProfileFor(row, view.providerId) }))
    .filter((row) => row.model.trim() && row.profile.trim())
  const keep = new Set(rows.map((row) => row.profile))
  for (const profile of listModelProfiles(next)) {
    if (!keep.has(profile)) next = removeTable(next, modelTableName(profile))
  }
  const previousDefault = view.defaultProfile.trim()
  const renamed = view.catalog.find((row) => row.profile.trim() === previousDefault)
  const defaultProfile =
    (renamed ? grokProfileFor(renamed, view.providerId) : previousDefault) || rows[0]?.profile || ''
  next = setTableKey(next, 'models', 'default', defaultProfile || null)
  next = setTableKey(next, 'models', 'default_reasoning_effort', view.reasoningEffort.trim() || null)
  next = setInlineTable(next, 'models', 'extra_headers', view.customHeaders)
  const baseUrl = view.baseUrl.trim().replace(/\/+$/, '')
  const apiKey = view.apiKey.trim()
  const backend = view.apiBackend.trim() || GROK_DEFAULT_BACKEND
  for (const row of rows) {
    const table = modelTableName(row.profile)
    const context = Number(row.contextWindow)
    const maxOutput = Number(row.maxOutput)
    next = setTableKey(next, table, 'model', row.model.trim())
    next = setTableKey(
      next,
      table,
      'name',
      grokMenuName(view.providerName, row.displayName.trim() || row.model.trim())
    )
    next = setTableKey(next, table, 'base_url', baseUrl || null)
    next = setTableKey(next, table, 'api_key', apiKey || null)
    next = setTableKey(next, table, 'api_backend', backend)
    next = setTableKey(
      next,
      table,
      'context_window',
      Number.isFinite(context) && context > 0 ? context : GROK_DEFAULT_CONTEXT_WINDOW
    )
    next = setTableKey(
      next,
      table,
      'max_completion_tokens',
      Number.isFinite(maxOutput) && maxOutput > 0 ? maxOutput : GROK_DEFAULT_MAX_OUTPUT
    )
    const efforts = row.reasoningLevels.filter((level) => level && level !== 'off' && level !== 'none')
    next = setTableArray(next, table, 'reasoning_efforts', efforts.length > 0 ? efforts : null)
  }
  const providerId = view.providerId.trim()
  if (providerId) next = setTableKey(next, 'hyperswitch', 'provider', providerId)
  else next = removeTable(next, 'hyperswitch')
  return next.replace(/\n{3,}/g, '\n\n')
}

async function load(): Promise<unknown> {
  const path = getGrokConfigPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  const toml = await readText(path)
  if (toml === null) {
    return { exists: false, path, settings: emptyGrokSettings(), prompt }
  }
  return { exists: true, path, settings: parseSettings(toml), prompt }
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizeGrokSavePayload(payload)
  const path = getGrokConfigPath()
  const existing = (await readText(path)) ?? ''
  await writeText(path, applySettings(existing, settings))
  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const grokPlugin: AgentRuntimePlugin = {
  id: 'grok',
  load,
  save
}
