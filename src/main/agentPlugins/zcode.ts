import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  applyZcodeSettings,
  emptyZcodeSettings,
  parseZcodeSettings,
  sanitizeZcodeSavePayload
} from '../../shared/zcodeSettings'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { fileExists, readJsonObject, writeJson } from './fs'
import type { AgentRuntimePlugin } from './types'

function getZcodeDir(): string {
  return join(homedir(), '.zcode')
}

function getZcodeConfigPath(): string {
  return join(getZcodeDir(), 'v2', 'config.json')
}

function getAgentsMdPath(): string {
  return join(getZcodeDir(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(getZcodeDir(), 'agents.md.origin.bak')
}

async function load(): Promise<unknown> {
  const path = getZcodeConfigPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  if (!(await fileExists(path))) {
    return { exists: false, path, settings: emptyZcodeSettings(), prompt }
  }
  const raw = await readJsonObject(path)
  return {
    exists: true,
    path,
    settings: parseZcodeSettings(raw),
    prompt
  }
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizeZcodeSavePayload(payload)
  const path = getZcodeConfigPath()
  const existing = await readJsonObject(path)
  await writeJson(path, applyZcodeSettings(existing, settings))
  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const zcodePlugin: AgentRuntimePlugin = {
  id: 'zcode',
  load,
  save
}
