import type { Component } from 'vue'
import ClaudeSettingsEditor from '@/components/ClaudeSettingsEditor.vue'
import CodexSettingsEditor from '@/components/CodexSettingsEditor.vue'
import DshSettingsEditor from '@/components/DshSettingsEditor.vue'
import GrokSettingsEditor from '@/components/GrokSettingsEditor.vue'
import OmpSettingsEditor from '@/components/OmpSettingsEditor.vue'
import OpenCodeSettingsEditor from '@/components/OpenCodeSettingsEditor.vue'
import PiSettingsEditor from '@/components/PiSettingsEditor.vue'
import ZcodeSettingsEditor from '@/components/ZcodeSettingsEditor.vue'
import type { AgentPluginId } from '@shared/agentPlugin'

/**
 * Renderer editors for agent plugins that implement live-config UI.
 * Add a Vue editor here when introducing a new agent.
 */
export const AGENT_EDITORS: Partial<Record<AgentPluginId, Component>> = {
  claude: ClaudeSettingsEditor,
  codex: CodexSettingsEditor,
  opencode: OpenCodeSettingsEditor,
  grok: GrokSettingsEditor,
  pi: PiSettingsEditor,
  dsh: DshSettingsEditor,
  zcode: ZcodeSettingsEditor,
  omp: OmpSettingsEditor
}
