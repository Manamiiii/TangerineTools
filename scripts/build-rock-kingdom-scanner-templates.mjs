import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  detectSelectedPortraitCellFromImageData,
  portraitEdgeDescriptorFromImageData,
  ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE,
} from '../src/features/rock-kingdom-scanner/portraitRecognition.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'docs', 'assets', 'rock-kingdom-scanner', 'baseline-3200x1440')
const outputDir = path.join(root, 'public', 'icons', 'rock-kingdom-text-labels')
const write = process.argv.includes('--write')
const textTemplates = JSON.parse(await readFile(path.join(
  root,
  'scripts',
  'data',
  'rockKingdomScannerTextTemplates.json',
), 'utf8'))
const portraitTemplates = JSON.parse(await readFile(path.join(
  root,
  'scripts',
  'data',
  'rockKingdomScannerPortraitTemplates.json',
), 'utf8'))
const portraitOutputPath = path.join(
  root,
  'src',
  'features',
  'rock-kingdom-scanner',
  'fixedPortraitSamples.json',
)

const crops = {
  name: { x: 0.688, y: 0.125, width: 0.105, height: 0.06 },
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
for (const { kind, value, fileName = `fixed-${value}.png`, source: sourceName } of textTemplates) {
  const sourcePath = path.join(sourceDir, sourceName)
  await access(sourcePath)
  const image = sharp(sourcePath)
  const metadata = await image.metadata()
  const buffer = await image
    .extract(cropPixels(metadata, crops[kind]))
    .png()
    .toBuffer()
  const targetDir = path.join(outputDir, kind)
  const targetPath = path.join(targetDir, fileName)
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

const generatedPortraits = []
const unresolvedPortraitSources = []
for (const { label, source: sourceName } of portraitTemplates) {
  const sourcePath = path.join(sourceDir, sourceName)
  await access(sourcePath)
  const metadata = await sharp(sourcePath).metadata()
  const detection = await sharp(sourcePath)
    .resize({ width: 640 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const selected = detectSelectedPortraitCellFromImageData({
    data: detection.data,
    width: detection.info.width,
    height: detection.info.height,
  }, {
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
  })
  if (!selected) {
    unresolvedPortraitSources.push(sourceName)
    continue
  }
  const portrait = await sharp(sourcePath)
    .extract({
      left: selected.rect.x,
      top: selected.rect.y,
      width: selected.rect.width,
      height: selected.rect.height,
    })
    .resize(
      ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE,
      ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE,
      { fit: 'fill' },
    )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const descriptor = portraitEdgeDescriptorFromImageData({
    data: portrait.data,
    width: portrait.info.width,
    height: portrait.info.height,
  })
  generatedPortraits.push({
    label,
    source: sourceName,
    selectedCell: selected.key,
    selectionScore: Number(selected.score.toFixed(4)),
    selectionGap: Number((selected.score - (selected.ranked[1]?.score || 0)).toFixed(4)),
    outlineScore: Number((selected.outlineScore || 0).toFixed(4)),
    descriptorBase64: Buffer.from(Int16Array.from(descriptor).buffer).toString('base64'),
  })
}

const portraitOutput = `${JSON.stringify(generatedPortraits, null, 2)}\n`
let currentPortraitOutput = ''
try {
  currentPortraitOutput = await readFile(portraitOutputPath, 'utf8')
} catch {
  // Missing output is reported below or created in write mode.
}
if (currentPortraitOutput !== portraitOutput) {
  stale += 1
  if (write) await writeFile(portraitOutputPath, portraitOutput)
}

if (stale && !write) {
  throw new Error(`${stale} 个固定设备文字模板缺失或已过期；运行 npm run apply:scanner:templates。`)
}

console.log(write
  ? `已生成 ${textTemplates.length} 个文字模板和 ${generatedPortraits.length} 个明确选中头像样本。`
  : `固定设备模板校验通过：${textTemplates.length} 个文字模板、${generatedPortraits.length} 个明确选中头像样本。`)
if (unresolvedPortraitSources.length) {
  console.log(`未把 ${unresolvedPortraitSources.length} 张缺少明确选中证据的截图作为头像样本。`)
}
