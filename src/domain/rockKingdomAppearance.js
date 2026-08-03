export const ROCK_APPEARANCE_OPTIONS = [
  { value: 'none', label: '无', color: '#94a3b8' },
  { value: 'shiny', label: '异色', color: '#db2777' },
  { value: 'colorful', label: '炫彩', color: '#7c3aed' },
  { value: 'shiny-colorful', label: '异色炫彩', color: '#c026d3' },
  { value: 'bw-colorful', label: '黑白炫彩', color: '#475569' },
  { value: 'bw-shiny-colorful', label: '黑白异色炫彩', color: '#334155' },
  { value: 's1-colorful', label: 'S1 炫彩', color: '#0ea5e9' },
  { value: 's1-shiny-colorful', label: 'S1 异色炫彩', color: '#0284c7' },
  { value: 's2-colorful', label: 'S2 炫彩', color: '#e11d48' },
  { value: 's2-shiny-colorful', label: 'S2 异色炫彩', color: '#be123c' },
  { value: 's3-colorful', label: 'S3 炫彩', color: '#10b981' },
  { value: 's3-shiny-colorful', label: 'S3 异色炫彩', color: '#059669' },
]

export const ROCK_APPEARANCE_TEMPLATES = [
  { value: 'shiny', label: '异色', fileName: 'shiny.png' },
  { value: 'colorful', label: '炫彩', fileName: 'colorful.png' },
  { value: 'shiny-colorful', label: '异色炫彩', fileName: 'shiny-colorful.png' },
  { value: 'bw-colorful', label: '黑白炫彩', fileName: 'bw-colorful.png' },
  { value: 'bw-shiny-colorful', label: '黑白异色炫彩', fileName: 'bw-shiny-colorful.png' },
  { value: 's1-colorful', label: 'S1 炫彩', fileName: 's1-colorful.png' },
  { value: 's1-shiny-colorful', label: 'S1 异色炫彩', fileName: 's1-shiny-colorful.png' },
  { value: 's2-colorful', label: 'S2 炫彩', fileName: 's2-colorful.png' },
  { value: 's2-shiny-colorful', label: 'S2 异色炫彩', fileName: 's2-shiny-colorful.png' },
  { value: 's3-colorful', label: 'S3 炫彩', fileName: 's3-colorful.png' },
  { value: 's3-shiny-colorful', label: 'S3 异色炫彩', fileName: 's3-shiny-colorful.png' },
]

function pixelAt(pixels, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return [39, 43, 45]
  const offset = (y * width + x) * 4
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
}

function foregroundWeight([red, green, blue]) {
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const chroma = Math.max(0, maximum - minimum - 10) / 120
  const brightness = Math.max(0, luminance - 62) / 150
  return Math.min(1, Math.max(chroma, brightness))
}

function shiftedAppearanceSimilarity(sample, template, shiftX, shiftY) {
  let weightedDifference = 0
  let totalWeight = 0
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const samplePixel = pixelAt(sample.pixels, sample.width, sample.height, x, y)
      const templatePixel = pixelAt(template.pixels, template.width, template.height, x + shiftX, y + shiftY)
      const weight = 0.06 + Math.max(foregroundWeight(samplePixel), foregroundWeight(templatePixel))
      const difference = Math.sqrt(
        (samplePixel[0] - templatePixel[0]) ** 2
        + (samplePixel[1] - templatePixel[1]) ** 2
        + (samplePixel[2] - templatePixel[2]) ** 2,
      ) / Math.sqrt(3 * 255 ** 2)
      weightedDifference += difference * weight
      totalWeight += weight
    }
  }
  return Math.max(0, 1 - weightedDifference / Math.max(totalWeight, 1))
}

export function appearanceTemplateSimilarity(sample, template, maximumShift = 2) {
  if (!sample?.pixels || !template?.pixels) return 0
  if (sample.width !== template.width || sample.height !== template.height) return 0
  let best = 0
  for (let shiftY = -maximumShift; shiftY <= maximumShift; shiftY += 1) {
    for (let shiftX = -maximumShift; shiftX <= maximumShift; shiftX += 1) {
      best = Math.max(best, shiftedAppearanceSimilarity(sample, template, shiftX, shiftY))
    }
  }
  return best
}

export function bestAppearanceTemplateMatch(
  sample,
  templates = [],
  { minimumScore = 0.78, minimumGap = 0.025 } = {},
) {
  const ranked = templates
    .map((template) => ({
      ...template,
      score: appearanceTemplateSimilarity(sample, template),
    }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return null
  if (ranked[1] && best.score - ranked[1].score < minimumGap) return null
  return best
}

export function appearanceFlags(value) {
  const normalized = String(value || 'none')
  return {
    shiny: normalized === 'shiny' || normalized.includes('shiny-colorful') ? 'yes' : 'no',
    colorful: normalized.includes('colorful') ? 'yes' : 'no',
  }
}

export function valuesWithAppearance(values = {}) {
  return {
    ...values,
    ...appearanceFlags(values.appearance),
  }
}
