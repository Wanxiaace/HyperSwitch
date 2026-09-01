import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { detectAgentTools } from './agentDetect'
import { loadAgentPluginSettings, saveAgentPluginSettings } from './agentPlugins'
import {
  getDataDir,
  hasOnboarded,
  loadAgentBindings,
  loadConfig,
  loadHeaderPresets,
  loadPrefs,
  loadPromptPresets,
  loadProviders,
  markOnboarded,
  saveAgentBindings,
  saveConfig,
  saveHeaderPresets,
  savePrefs,
  savePromptPresets
} from './configStore'
import { loadCatalog, updateCatalog } from './modelCatalog'
import { fetchModels } from './modelFetch'
import { normalizePrefs, type AppPrefs } from '../shared/locale'
import type { HeaderPreset, PromptPreset } from '../shared/presets'
import type { FetchModelsInput, ProviderConfig } from '../shared/provider'

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('log-level', '3')
  app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar')
}

const WINDOW_BG = '#1e1e21'

function nativeIcon(): string {
  const file = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [join(process.resourcesPath, file), join(__dirname, '../../resources', file)]
  return candidates.find((path) => existsSync(path)) ?? candidates[1]
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: WINDOW_BG,
    title: 'HyperSwitch',
    icon: nativeIcon(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 12 },
    ...(process.platform === 'darwin'
      ? {}
      : {
          titleBarOverlay: {
            color: WINDOW_BG,
            symbolColor: '#a1a1aa',
            height: 40
          }
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hyperswitch.app')
  if (process.platform === 'darwin') app.dock?.setIcon(nativeIcon())

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('app:getPath', (_event, name: Parameters<typeof app.getPath>[0]) => {
    return app.getPath(name)
  })
  ipcMain.handle('config:dataDir', () => getDataDir())
  ipcMain.handle('config:load', async () => loadConfig())
  ipcMain.handle('config:loadProviders', async () => loadProviders())
  ipcMain.handle('config:loadBindings', async () => loadAgentBindings())
  ipcMain.handle('config:loadPromptPresets', async () => loadPromptPresets())
  ipcMain.handle('config:loadHeaderPresets', async () => loadHeaderPresets())
  ipcMain.handle('config:save', async (_event, providers: ProviderConfig[]) => {
    await saveConfig(providers)
  })
  ipcMain.handle('app:hasOnboarded', async () => hasOnboarded())
  ipcMain.handle('app:markOnboarded', async () => {
    await markOnboarded()
  })
  ipcMain.handle('prefs:load', async () => loadPrefs())
  ipcMain.handle('prefs:save', async (_event, prefs: AppPrefs) => {
    await savePrefs(normalizePrefs(prefs))
  })
  ipcMain.handle('app:openDataDir', () => shell.openPath(getDataDir()))
  ipcMain.handle('app:openPath', async (_event, target: unknown) => {
    if (typeof target !== 'string' || !target.trim()) return ''
    return shell.openPath(target)
  })
  ipcMain.handle('config:saveBindings', async (_event, bindings) => {
    await saveAgentBindings(bindings)
  })
  ipcMain.handle('config:savePromptPresets', async (_event, list: PromptPreset[]) => {
    await savePromptPresets(list)
  })
  ipcMain.handle('config:saveHeaderPresets', async (_event, list: HeaderPreset[]) => {
    await saveHeaderPresets(list)
  })
  ipcMain.handle('catalog:load', async () => loadCatalog())
  ipcMain.handle('catalog:update', async () => {
    try {
      const file = await updateCatalog()
      return { ok: true, file }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
  ipcMain.handle('agent:loadSettings', async (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Missing agent plugin id')
    return loadAgentPluginSettings(id)
  })
  ipcMain.handle('agent:saveSettings', async (_event, id: unknown, payload: unknown) => {
    if (typeof id !== 'string') throw new Error('Missing agent plugin id')
    await saveAgentPluginSettings(id, payload)
  })
  ipcMain.handle('tools:detect', async () => {
    try {
      return { ok: true, tools: detectAgentTools() }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
  ipcMain.handle('models:fetch', async (_event, input: FetchModelsInput) => {
    try {
      const models = await fetchModels(input)
      return { ok: true, models }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
