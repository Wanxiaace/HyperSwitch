import type { ElectronAPI } from '@electron-toolkit/preload'
import type { AgentToolBindings, AgentToolStatus } from '../shared/agentTools'
import type { CatalogFile } from '../shared/catalog'
import type { AppPrefs } from '../shared/locale'
import type { HeaderPreset, PromptPreset } from '../shared/presets'
import type { AppConfigFile, FetchModelsInput, FetchModelsResponse, ProviderConfig } from '../shared/provider'

export interface CatalogUpdateResult {
  ok: true
  file: CatalogFile
}

export interface CatalogUpdateFailure {
  ok: false
  error: string
}

export interface HyperAPI {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  getPath: (name: string) => Promise<string>
  getDataDir: () => Promise<string>
  hasOnboarded: () => Promise<boolean>
  markOnboarded: () => Promise<void>
  loadPrefs: () => Promise<AppPrefs>
  savePrefs: (prefs: AppPrefs) => Promise<void>
  openDataDir: () => Promise<string>
  openPath: (target: string) => Promise<string>
  loadConfig: () => Promise<AppConfigFile>
  loadProviders: () => Promise<ProviderConfig[]>
  loadBindings: () => Promise<AgentToolBindings>
  loadPromptPresets: () => Promise<PromptPreset[]>
  loadHeaderPresets: () => Promise<HeaderPreset[]>
  saveConfig: (providers: ProviderConfig[]) => Promise<void>
  saveBindings: (bindings: AgentToolBindings) => Promise<void>
  savePromptPresets: (list: PromptPreset[]) => Promise<void>
  saveHeaderPresets: (list: HeaderPreset[]) => Promise<void>
  loadCatalog: () => Promise<CatalogFile>
  updateCatalog: () => Promise<CatalogUpdateResult | CatalogUpdateFailure>
  detectTools: () => Promise<
    { ok: true; tools: AgentToolStatus[] } | { ok: false; error: string }
  >
  loadAgentSettings: (id: string) => Promise<unknown>
  saveAgentSettings: (id: string, payload: unknown) => Promise<void>
  fetchModels: (input: FetchModelsInput) => Promise<FetchModelsResponse>
}

declare global {
  interface Window {
    electron: ElectronAPI
    hyper: HyperAPI
  }
}
