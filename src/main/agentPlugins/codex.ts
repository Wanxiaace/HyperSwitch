import { loadCodexSettings, saveCodexSettings } from '../codexSettings'
import type { AgentRuntimePlugin } from './types'

export const codexPlugin: AgentRuntimePlugin = {
  id: 'codex',
  load: () => loadCodexSettings(),
  save: (payload) => saveCodexSettings(payload)
}
