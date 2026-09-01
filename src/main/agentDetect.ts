import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AGENT_TOOLS, type AgentToolStatus } from '../shared/agentTools'

function isDir(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function detectAgentTools(): AgentToolStatus[] {
  const home = homedir()
  return AGENT_TOOLS.map((tool) => {
    const found = tool.dirs.map((dir) => join(home, ...dir.split('/'))).find(isDir) ?? null
    return {
      id: tool.id,
      name: tool.name,
      found: found !== null,
      path: found
    }
  })
}
