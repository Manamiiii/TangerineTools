import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'docs', 'assets', 'rock-kingdom-scanner', 'baseline-3200x1440')
const outputDir = path.join(root, 'public', 'icons', 'rock-kingdom-text-labels')
const write = process.argv.includes('--write')
const templates = JSON.parse(await readFile(path.join(
  root,
  'scripts',
  'data',
  'rockKingdomScannerTextTemplates.json',
), 'utf8'))

const crops = {
  nature: { x: 0.735, y: 0.755, width: 0.095, height: 0.07 },
  bloodline: { x: 0.918, y: 0.185, width: 0.072, height: 0.06 },
  specialty: { x: 0.855, y: 0.755, width: 0.095, height: 0.07 },
}

function cropPixels(metadata, crop) {
  return {
    left: Math.round(metadata.width * crop.x),
    top: Math.round(metadata.height * crop.y),
    width: Math.max(1, Math.round(metadata.width * crop.width)),
    height: Math.max(1, Math.round(metadata.height * crop.height)),
  }
}

let stale = 0
for (const { kind, value, source: sourceName } of templates) {
  const sourcePath = path.join(sourceDir, sourceName)
  await access(sourcePath)
  const image = sharp(sourcePath)
  const metadata = await image.metadata()
  const buffer = await image
    .extract(cropPixels(metadata, crops[kind]))
    .png()
    .toBuffer()
  const targetDir = path.join(outputDir, kind)
  const targetPath = path.join(targetDir, `fixed-${value}.png`)
  let current = null
  try {
    current = await readFile(targetPath)
  } catch {
    // Missing output is reported below or created in write mode.
  }
  if (current?.equals(buffer)) continue
  stale += 1
  if (!write) continue
  await mkdir(targetDir, { recursive: true })
  await writeFile(targetPath, buffer)
}

if (stale && !write) {
  throw new Error(`${stale} 个固定设备文字模板缺失或已过期；运行 npm run apply:scanner:templates。`)
}

console.log(write
  ? `已生成 ${templates.length} 个固定设备文字模板。`
  : `固定设备文字模板校验通过：${templates.length} 个。`)
