import { loadClaudeSettings, saveClaudeSettings } from '../claudeSettings'
import type { AgentRuntimePlugin } from './types'

export const claudePlugin: AgentRuntimePlugin = {
  id: 'claude',
  load: () => loadClaudeSettings(),
  save: (payload) => saveClaudeSettings(payload)
}
