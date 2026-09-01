const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const electronDir = path.dirname(require.resolve('electron/package.json'))
const pathFile = path.join(electronDir, 'path.txt')
const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron'
const distExe = path.join(electronDir, 'dist', exeName)

if (fs.existsSync(distExe) && fs.existsSync(pathFile)) {
  process.exit(0)
}

process.env.ELECTRON_MIRROR ||= 'https://npmmirror.com/mirrors/electron/'
const result = spawnSync(process.execPath, [path.join(electronDir, 'install.js')], {
  stdio: 'inherit',
  env: process.env
})
process.exit(result.status ?? 1)
