import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AgentPromptMode } from '../../shared/agentPlugin'
import { fileExists, readText } from './fs'

export async function loadMarkdown(
  filePath: string,
  bakPath: string
): Promise<{ bakExists: boolean; content: string }> {
  return {
    bakExists: await fileExists(bakPath),
    content: (await readText(filePath)) ?? ''
  }
}

export async function applyMarkdownFile(
  mode: AgentPromptMode,
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
