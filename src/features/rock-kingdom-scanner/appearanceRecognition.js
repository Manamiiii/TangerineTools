import {
  ROCK_APPEARANCE_TEMPLATES,
  ROCK_SCANNER_CROP_PROFILE,
  bestAppearanceTemplateMatch,
} from '../../domain/rockKingdomScanner.js'
import { cropImageSource, loadImageSource } from './frameCapture.js'

const TEMPLATE_SIZE = 56
let templatePromise

function normalizedImagePixels(source) {
  const canvas = document.createElement('canvas')
  canvas.width = TEMPLATE_SIZE
  canvas.height = TEMPLATE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE)
  return {
    pixels: context.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data,
    width: TEMPLATE_SIZE,
    height: TEMPLATE_SIZE,
  }
}

function appearanceTemplateUrl(fileName) {
  return new URL(`icons/rock-kingdom-appearance/${fileName}`, document.baseURI).href
}

async function loadAppearanceTemplates() {
  if (!templatePromise) {
    templatePromise = Promise.all(ROCK_APPEARANCE_TEMPLATES.map(async (template) => {
      const image = await loadImageSource(appearanceTemplateUrl(template.fileName))
      return {
        ...template,
        ...normalizedImagePixels(image),
      }
    })).catch((error) => {
      templatePromise = undefined
      throw error
    })
  }
  return templatePromise
}

export async function recognizeRockAppearance(image) {
  const crop = cropImageSource(image, ROCK_SCANNER_CROP_PROFILE.appearance, 1)
  const sample = normalizedImagePixels(crop)
  const templates = await loadAppearanceTemplates()
  return bestAppearanceTemplateMatch(sample, templates)
}
