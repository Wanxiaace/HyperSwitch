import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  applyOpenCodeSettings,
  emptyOpenCodeSettings,
  parseOpenCodeSettings,
  sanitizeOpenCodeSavePayload
} from '../../shared/opencodeSettings'
import { applyMarkdownFile, loadMarkdown } from './markdown'
import { fileExists, readJsonObject, writeJson } from './fs'
import type { AgentRuntimePlugin } from './types'

function getOpenCodeDir(): string {
  return join(homedir(), '.config', 'opencode')
}

function getOpenCodeConfigPath(): string {
  return join(getOpenCodeDir(), 'opencode.json')
}

function getAgentsMdPath(): string {
  return join(getOpenCodeDir(), 'AGENTS.md')
}

function getAgentsMdBakPath(): string {
  return join(getOpenCodeDir(), 'agents.md.origin.bak')
}

async function load(): Promise<unknown> {
  const path = getOpenCodeConfigPath()
  const prompt = await loadMarkdown(getAgentsMdPath(), getAgentsMdBakPath())
  if (!(await fileExists(path))) {
    return { exists: false, path, settings: emptyOpenCodeSettings(), prompt }
  }
  const raw = await readJsonObject(path)
  return {
    exists: true,
    path,
    settings: parseOpenCodeSettings(raw),
    prompt
  }
}

async function save(payload: unknown): Promise<void> {
  const { settings, prompt } = sanitizeOpenCodeSavePayload(payload)
  const path = getOpenCodeConfigPath()
  const existing = await readJsonObject(path)
  await writeJson(path, applyOpenCodeSettings(existing, settings))
  await applyMarkdownFile(prompt.mode, prompt.content, getAgentsMdPath(), getAgentsMdBakPath())
}

export const opencodePlugin: AgentRuntimePlugin = {
  id: 'opencode',
  load,
  save
}
