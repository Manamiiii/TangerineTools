import {
  ROCK_PARTNER_MARK_TEMPLATES,
  ROCK_SCANNER_CROP_PROFILE,
  bestPartnerMarkTemplateMatch,
  normalizedPartnerMarkMask,
} from '../../domain/rockKingdomScanner.js'
import { cropImageSource, loadImageSource } from './frameCapture.js'

let templatePromise

function canvasImageData(source) {
  const canvas = document.createElement('canvas')
  canvas.width = source.naturalWidth || source.width
  canvas.height = source.naturalHeight || source.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function partnerMarkTemplateUrl(fileName) {
  return new URL(`icons/rock-kingdom-partner-marks/${fileName}`, document.baseURI).href
}

async function loadPartnerMarkTemplates() {
  if (!templatePromise) {
    templatePromise = Promise.all(ROCK_PARTNER_MARK_TEMPLATES.map(async (template) => {
      const image = await loadImageSource(partnerMarkTemplateUrl(template.fileName))
      return {
        ...template,
        ...normalizedPartnerMarkMask(canvasImageData(image)),
      }
    })).catch((error) => {
      templatePromise = undefined
      throw error
    })
  }
  return templatePromise
}

export async function recognizeRockPartnerMark(image) {
  const crop = cropImageSource(image, ROCK_SCANNER_CROP_PROFILE.partnerMark, 1)
  const sample = normalizedPartnerMarkMask(canvasImageData(crop))
  const templates = await loadPartnerMarkTemplates()
  return bestPartnerMarkTemplateMatch(sample, templates)
}
