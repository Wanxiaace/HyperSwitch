import { access, copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  applyClaudeSettings,
  emptyClaudeSettings,
  parseClaudeSettings,
  sanitizeClaudeSavePayload,
  type ClaudeLoadResult,
  type ClaudePromptMode
} from '../shared/claudeSettings'

const CLAUDE_MD = 'CLAUDE.md'
const CLAUDE_MD_BAK = 'claude.md.origin.bak'

export function getClaudeDir(): string {
  return join(homedir(), '.claude')
}

export function getClaudeSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json')
}

export function getClaudeMdPath(): string {
  return join(getClaudeDir(), CLAUDE_MD)
}

export function getClaudeMdBakPath(): string {
  return join(getClaudeDir(), CLAUDE_MD_BAK)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readExisting(): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(getClaudeSettingsPath(), 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return {}
    throw error
  }
}

async function loadClaudeMd(): Promise<{ bakExists: boolean; content: string }> {
  const bakExists = await fileExists(getClaudeMdBakPath())
  try {
    return { bakExists, content: await readFile(getClaudeMdPath(), 'utf8') }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return { bakExists, content: '' }
    throw error
  }
}

async function applyClaudePrompt(mode: ClaudePromptMode, content: string): Promise<void> {
  if (mode === 'keep') return

  await mkdir(getClaudeDir(), { recursive: true })
  const mdPath = getClaudeMdPath()
  const bakPath = getClaudeMdBakPath()

  if (mode === 'none') {
    if (!(await fileExists(bakPath))) return
    const original = await readFile(bakPath)
    await writeFile(mdPath, original)
    await unlink(bakPath)
    return
  }

  const hasBak = await fileExists(bakPath)
  if (!hasBak) {
    const exists = await fileExists(mdPath)
    if (!content.replace(/\r\n/g, '\n').trim() && exists) {
      const existing = await readFile(mdPath, 'utf8')
      if (existing.replace(/\r\n/g, '\n').trim()) return
    }
    if (exists) await copyFile(mdPath, bakPath)
    else await writeFile(bakPath, '')
  }
  await writeFile(mdPath, content)
}

export async function loadClaudeSettings(): Promise<ClaudeLoadResult> {
  const path = getClaudeSettingsPath()
  const prompt = await loadClaudeMd()
  try {
    const raw = await readFile(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return { exists: true, path, settings: parseClaudeSettings(parsed), prompt }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { exists: false, path, settings: emptyClaudeSettings(), prompt }
    }
    throw error
  }
}

export async function saveClaudeSettings(input: unknown): Promise<void> {
  const payload = sanitizeClaudeSavePayload(input)
  const existing = await readExisting()
  const next = applyClaudeSettings(existing, payload.settings)
  await mkdir(getClaudeDir(), { recursive: true })
  await writeFile(getClaudeSettingsPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await applyClaudePrompt(payload.prompt.mode, payload.prompt.content)
}
