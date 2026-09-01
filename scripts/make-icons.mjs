import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'src/renderer/src/icons/hyperswitch.svg'))

function renderPng(size) {
  return Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(0,0,0,0)'
    })
      .render()
      .asPng()
  )
}

const png1024 = renderPng(1024)
const png512 = renderPng(512)
const png256 = renderPng(256)
const png128 = renderPng(128)
const png64 = renderPng(64)
const png48 = renderPng(48)
const png32 = renderPng(32)
const png24 = renderPng(24)
const png16 = renderPng(16)
const ico = await pngToIco([png16, png24, png32, png48, png64, png128, png256])

await mkdir(join(root, 'build'), { recursive: true })
await mkdir(join(root, 'resources'), { recursive: true })
await mkdir(join(root, 'src/renderer/public'), { recursive: true })

await writeFile(join(root, 'build/icon.png'), png1024)
await writeFile(join(root, 'resources/icon.png'), png512)
await writeFile(join(root, 'build/icon.ico'), ico)
await writeFile(join(root, 'resources/icon.ico'), ico)
await writeFile(join(root, 'src/renderer/public/favicon.svg'), svg)
await writeFile(join(root, 'src/renderer/public/favicon.png'), png32)

console.log('icons written', {
  png1024: png1024.length,
  png512: png512.length,
  ico: ico.length
})
