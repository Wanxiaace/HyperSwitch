import {
  AGENT_PLUGIN_IDS,
  AGENT_PLUGINS,
  pluginFormats,
  type AgentPluginId,
  type AgentPluginInfo
} from './agentPlugin'

export const AGENT_TOOL_IDS = AGENT_PLUGIN_IDS
export type AgentToolId = AgentPluginId
export type AgentToolInfo = AgentPluginInfo
export const AGENT_TOOLS = AGENT_PLUGINS
export const toolFormats = pluginFormats

export interface AgentToolStatus {
  id: AgentToolId
  name: string
  found: boolean
  path: string | null
}

export interface AgentToolBinding {
  providerId: string
  modelKey: string
}

export type AgentToolBindings = Partial<Record<AgentToolId, AgentToolBinding[]>>
