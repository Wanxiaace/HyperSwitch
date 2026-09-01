import { getAgentPlugin, type AgentPluginId } from '../../shared/agentPlugin'
import { claudePlugin } from './claude'
import { codexPlugin } from './codex'
import { dshPlugin } from './dsh'
import { grokPlugin } from './grok'
import { ompPlugin } from './omp'
import { opencodePlugin } from './opencode'
import { piPlugin } from './pi'
import { zcodePlugin } from './zcode'
import type { AgentRuntimePlugin } from './types'

const plugins: AgentRuntimePlugin[] = [
  claudePlugin,
  codexPlugin,
  opencodePlugin,
  grokPlugin,
  piPlugin,
  dshPlugin,
  zcodePlugin,
  ompPlugin
]

const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]))

export function getRuntimePlugin(id: string): AgentRuntimePlugin {
  const meta = getAgentPlugin(id)
  if (!meta) throw new Error(`Unknown agent plugin: ${id}`)
  const plugin = byId.get(meta.id as AgentPluginId)
  if (!plugin || !meta.hasEditor) {
    throw new Error(`${meta.name} has no config editor`)
  }
  return plugin
}

export async function loadAgentPluginSettings(id: string): Promise<unknown> {
  return getRuntimePlugin(id).load()
}

export async function saveAgentPluginSettings(id: string, payload: unknown): Promise<void> {
  await getRuntimePlugin(id).save(payload)
}
