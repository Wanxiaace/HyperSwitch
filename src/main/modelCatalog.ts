import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  emptyCatalog,
  MODELS_DEV_URL,
  parseModelsDev,
  type CatalogFile
} from '../shared/catalog'
import { getDataDir } from './configStore'

export function getCatalogPath(): string {
  return join(getDataDir(), 'models-dev.json')
}

export async function loadCatalog(): Promise<CatalogFile> {
  try {
    const raw = await readFile(getCatalogPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyCatalog()
    const file = parsed as Partial<CatalogFile>
    if (!Array.isArray(file.models)) return emptyCatalog()
    return {
      version: 1,
      updatedAt: typeof file.updatedAt === 'string' ? file.updatedAt : '',
      models: file.models
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return emptyCatalog()
    throw error
  }
}

export async function updateCatalog(): Promise<CatalogFile> {
  const response = await fetch(MODELS_DEV_URL, {
    signal: AbortSignal.timeout(60_000),
    headers: { accept: 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data: unknown = await response.json()
  const file: CatalogFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    models: parseModelsDev(data)
  }
  await mkdir(getDataDir(), { recursive: true })
  await writeFile(getCatalogPath(), `${JSON.stringify(file)}\n`, 'utf8')
  return file
}
