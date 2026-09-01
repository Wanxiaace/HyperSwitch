import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AgentToolBindings } from '../shared/agentTools'
import type { AppPrefs } from '../shared/locale'
import type { HeaderPreset, PromptPreset } from '../shared/presets'
import type { FetchModelsInput, ProviderConfig } from '../shared/provider'

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  getPath: (name: string): Promise<string> => ipcRenderer.invoke('app:getPath', name),
  getDataDir: (): Promise<string> => ipcRenderer.invoke('config:dataDir'),
  hasOnboarded: (): Promise<boolean> => ipcRenderer.invoke('app:hasOnboarded'),
  markOnboarded: (): Promise<void> => ipcRenderer.invoke('app:markOnboarded'),
  loadPrefs: (): Promise<AppPrefs> => ipcRenderer.invoke('prefs:load'),
  savePrefs: (prefs: AppPrefs): Promise<void> => ipcRenderer.invoke('prefs:save', prefs),
  openDataDir: (): Promise<string> => ipcRenderer.invoke('app:openDataDir'),
  openPath: (target: string): Promise<string> => ipcRenderer.invoke('app:openPath', target),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  loadProviders: () => ipcRenderer.invoke('config:loadProviders'),
  loadBindings: () => ipcRenderer.invoke('config:loadBindings'),
  loadPromptPresets: () => ipcRenderer.invoke('config:loadPromptPresets'),
  loadHeaderPresets: () => ipcRenderer.invoke('config:loadHeaderPresets'),
  saveConfig: (providers: ProviderConfig[]) => ipcRenderer.invoke('config:save', providers),
  saveBindings: (bindings: AgentToolBindings) => ipcRenderer.invoke('config:saveBindings', bindings),
  savePromptPresets: (list: PromptPreset[]) =>
    ipcRenderer.invoke('config:savePromptPresets', list),
  saveHeaderPresets: (list: HeaderPreset[]) =>
    ipcRenderer.invoke('config:saveHeaderPresets', list),
  loadCatalog: () => ipcRenderer.invoke('catalog:load'),
  updateCatalog: () => ipcRenderer.invoke('catalog:update'),
  detectTools: () => ipcRenderer.invoke('tools:detect'),
  loadAgentSettings: (id: string) => ipcRenderer.invoke('agent:loadSettings', id),
  saveAgentSettings: (id: string, payload: unknown) =>
    ipcRenderer.invoke('agent:saveSettings', id, payload),
  fetchModels: (input: FetchModelsInput) => ipcRenderer.invoke('models:fetch', input)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('hyper', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const isolatedWindow = window as typeof window & {
    electron: typeof electronAPI
    hyper: typeof api
  }
  isolatedWindow.electron = electronAPI
  isolatedWindow.hyper = api
}
