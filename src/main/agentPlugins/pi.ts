import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  applyPiModelsFile,
  applyPiSettingsFile,
  parsePiSettings,
  sanitizePiSavePayload
} from '../../shared/piSettings'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { fileExists, readJsonObject, writeJson } from './fs'
import type { AgentRuntimePlugin } from './types'

function getPiAgentDir(): string {
  return join(homedir(), '.pi', 'agent')
}

function getModelsPath(): string {
  return join(getPiAgentDir(), 'models.json')
}

function getSettingsPath(): string {
  return join(getPiAgentDir(), 'settings.json')
}

function getAgentsMdPath(): string {
  return join(getPiAgentDir(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(getPiAgentDir(), 'agents.md.origin.bak')
}

async function load(): Promise<unknown> {
  const path = getModelsPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  const modelsExists = await fileExists(path)
  const settingsExists = await fileExists(getSettingsPath())
  const modelsFile = await readJsonObject(path)
  const settingsFile = await readJsonObject(getSettingsPath())
  return {
    exists: modelsExists || settingsExists,
    path,
    settings: parsePiSettings(modelsFile, settingsFile),
    prompt
  }
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizePiSavePayload(payload)
  const modelsPath = getModelsPath()
  const settingsPath = getSettingsPath()
  const modelsFile = await readJsonObject(modelsPath)
  const settingsFile = await readJsonObject(settingsPath)
  await writeJson(modelsPath, applyPiModelsFile(modelsFile, settings))
  await writeJson(settingsPath, applyPiSettingsFile(settingsFile, settings))
  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const piPlugin: AgentRuntimePlugin = {
  id: 'pi',
  load,
  save
}
