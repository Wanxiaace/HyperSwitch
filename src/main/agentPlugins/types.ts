import type { AgentPluginId } from '../../shared/agentPlugin'

export interface AgentRuntimePlugin {
  id: AgentPluginId
  load(): Promise<unknown>
  save(payload: unknown): Promise<void>
}
