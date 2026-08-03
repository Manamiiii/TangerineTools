import {
  ROCK_SCANNER_CROP_PROFILE,
  ROCK_SCANNER_TEXT_LABEL_TEMPLATES,
  bestScannerTextLabelTemplateMatch,
  normalizedScannerTextLabelMask,
} from '../../domain/rockKingdomScanner.js'
import { cropImageSource, loadImageSource } from './frameCapture.js'

const templatePromises = new Map()

function canvasImageData(source) {
  const canvas = document.createElement('canvas')
  canvas.width = source.naturalWidth || source.width
  canvas.height = source.naturalHeight || source.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function textMaskOptions(kind) {
  return kind === 'name'
    ? { targetWidth: 160, targetHeight: 32, contentFraction: 0.88 }
    : undefined
}

function textLabelTemplateUrl(kind, fileName) {
  return new URL(
    `icons/rock-kingdom-text-labels/${kind}/${fileName}`,
    document.baseURI,
  ).href
}

async function loadTextLabelTemplates(kind) {
  if (!templatePromises.has(kind)) {
    const promise = Promise.all(
      (ROCK_SCANNER_TEXT_LABEL_TEMPLATES[kind] || []).map(async (template) => {
        const image = await loadImageSource(textLabelTemplateUrl(kind, template.fileName))
        return {
          ...template,
          ...normalizedScannerTextLabelMask(canvasImageData(image), textMaskOptions(kind)),
        }
      }),
    ).catch((error) => {
      templatePromises.delete(kind)
      throw error
    })
    templatePromises.set(kind, promise)
  }
  return templatePromises.get(kind)
}

export async function recognizeRockTextLabel(image, kind) {
  const crop = ROCK_SCANNER_CROP_PROFILE[kind]
  if (!crop) return null
  const sampleImage = cropImageSource(image, crop, 1)
  const sample = normalizedScannerTextLabelMask(canvasImageData(sampleImage), textMaskOptions(kind))
  const templates = await loadTextLabelTemplates(kind)
  return bestScannerTextLabelTemplateMatch(sample, templates, {
    minimumScore: kind === 'name' ? 0.72 : kind === 'bloodline' ? 0.72 : 0.76,
    minimumGap: kind === 'name' ? 0 : kind === 'bloodline' ? 0.02 : 0.03,
  })
}
