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
  { value: 's1-colorful', label: 'S1 炫彩', fileName: 's1-colorful.png' },
  { value: 's1-shiny-colorful', label: 'S1 异色炫彩', fileName: 's1-shiny-colorful.png' },
  { value: 's2-colorful', label: 'S2 炫彩', fileName: 's2-colorful.png' },
  { value: 's2-shiny-colorful', label: 'S2 异色炫彩', fileName: 's2-shiny-colorful.png' },
  { value: 's3-colorful', label: 'S3 炫彩', fileName: 's3-colorful.png' },
]

export const ROCK_PARTNER_MARK_TEMPLATES = [
  { value: 'fruit', label: '果实', fileName: 'fruit.png' },
  { value: 'lightning', label: '闪电', fileName: 'lightning.png' },
  { value: 'home', label: '房屋', fileName: 'home.png' },
  { value: 'hp', label: '生命', fileName: 'hp.png' },
  { value: 'patk', label: '物攻', fileName: 'patk.png' },
  { value: 'matk', label: '魔攻', fileName: 'matk.png' },
  { value: 'pdef', label: '物防', fileName: 'pdef.png' },
  { value: 'mdef', label: '魔防', fileName: 'mdef.png' },
  { value: 'spd', label: '速度', fileName: 'spd.png' },
]

export const ROCK_SCANNER_CROP_PROFILE = {
  // 根据用户提供的 1280 × 576 总览图标定。坐标使用比例，允许等比例缩放。
  name: { label: '名称', x: 0.688, y: 0.125, width: 0.105, height: 0.06 },
  gender: { label: '性别', x: 0.688, y: 0.12, width: 0.112, height: 0.075 },
  partnerMark: { label: '伙伴标记', x: 0.858, y: 0.185, width: 0.03, height: 0.06 },
  bloodline: { label: '血脉', x: 0.9, y: 0.185, width: 0.055, height: 0.06 },
  nature: { label: '性格', x: 0.735, y: 0.755, width: 0.095, height: 0.07 },
  specialty: { label: '特长', x: 0.855, y: 0.755, width: 0.095, height: 0.07 },
  appearance: { label: '外观', x: 0.903125, y: 0.645833, width: 0.04375, height: 0.097222 },
}

function partnerMarkForeground(red, green, blue) {
  const redBlueGap = Math.max(0, red - blue - 18) / 80
  const greenBlueGap = Math.max(0, green - blue - 8) / 65
  const brightness = Math.max(0, Math.max(red, green) - 70) / 110
  return Math.min(1, redBlueGap, greenBlueGap, brightness)
}

export function normalizedPartnerMarkMask(imageData, targetSize = 28) {
  const pixels = imageData?.data || imageData?.pixels
  const width = Number(imageData?.width)
  const height = Number(imageData?.height)
  if (!pixels?.length || !width || !height) return null
  const weights = new Float32Array(width * height)
  let evidence = 0
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4
      const weight = partnerMarkForeground(
        pixels[pixelOffset],
        pixels[pixelOffset + 1],
        pixels[pixelOffset + 2],
      )
      weights[y * width + x] = weight
      evidence += weight
      if (weight < 0.2) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || evidence < Math.max(4, width * height * 0.004)) return null
  const sourceWidth = Math.max(1, right - left + 1)
  const sourceHeight = Math.max(1, bottom - top + 1)
  const mask = new Float32Array(targetSize * targetSize)
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.min(right, left + Math.round(x / Math.max(targetSize - 1, 1) * (sourceWidth - 1)))
      const sourceY = Math.min(bottom, top + Math.round(y / Math.max(targetSize - 1, 1) * (sourceHeight - 1)))
      mask[y * targetSize + x] = weights[sourceY * width + sourceX]
    }
  }
  return { pixels: mask, width: targetSize, height: targetSize, evidence }
}

function shiftedPartnerMarkSimilarity(sample, template, shiftX, shiftY) {
  let intersection = 0
  let union = 0
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const sampleWeight = sample.pixels[y * sample.width + x]
      const templateX = x + shiftX
      const templateY = y + shiftY
      const templateWeight = templateX >= 0 && templateY >= 0
        && templateX < template.width && templateY < template.height
        ? template.pixels[templateY * template.width + templateX]
        : 0
      intersection += Math.min(sampleWeight, templateWeight)
      union += Math.max(sampleWeight, templateWeight)
    }
  }
  return union > 0 ? intersection / union : 0
}

export function partnerMarkMaskSimilarity(sample, template, maximumShift = 2) {
  if (!sample?.pixels || !template?.pixels) return 0
  if (sample.width !== template.width || sample.height !== template.height) return 0
  let best = 0
  for (let shiftY = -maximumShift; shiftY <= maximumShift; shiftY += 1) {
    for (let shiftX = -maximumShift; shiftX <= maximumShift; shiftX += 1) {
      best = Math.max(best, shiftedPartnerMarkSimilarity(sample, template, shiftX, shiftY))
    }
  }
  return best
}

export function bestPartnerMarkTemplateMatch(
  sample,
  templates = [],
  { minimumScore = 0.42, minimumGap = 0.035 } = {},
) {
  if (!sample) return { value: 'none', label: '无', score: 0.96 }
  const ranked = templates
    .map((template) => ({ ...template, score: partnerMarkMaskSimilarity(sample, template) }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return null
  if (ranked[1] && best.score - ranked[1].score < minimumGap) return null
  return best
}

export function recognizeGenderColor(imageData) {
  const pixels = imageData?.data || imageData?.pixels
  if (!pixels?.length) return null
  let maleEvidence = 0
  let femaleEvidence = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    if (blue >= 105) {
      maleEvidence += Math.max(0, blue - red - 20) * Math.min(1, (blue - 90) / 100)
    }
    if (red >= 120) {
      femaleEvidence += Math.max(0, red - green - 25, red - blue - 15)
        * Math.min(1, (red - 105) / 100)
    }
  }
  const strongest = Math.max(maleEvidence, femaleEvidence)
  const weakest = Math.min(maleEvidence, femaleEvidence)
  if (strongest < 320 || strongest < weakest * 1.45) return null
  const dominance = strongest / Math.max(strongest + weakest, 1)
  return {
    value: maleEvidence > femaleEvidence ? 'male' : 'female',
    confidence: Math.min(0.99, 0.72 + dominance * 0.22),
  }
}

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

export function isScannerFrameReady(frame) {
  return Boolean(frame?.reviewed && frame?.values?.ref)
}

export function normalizeScanText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
}

function editDistance(left, right) {
  const a = [...left]
  const b = [...right]
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[b.length]
}

function candidateSearchTerms(candidate) {
  const label = String(candidate.label || '')
  const baseLabel = label.split(/[（(]/)[0].trim()
  const terms = [baseLabel, label, ...(candidate.aliases || [])]
  if (baseLabel.endsWith('系')) terms.push(baseLabel.slice(0, -1))
  return [...new Set(terms.map(normalizeScanText).filter(Boolean))]
}

export function rankScanCandidates(rawText, candidates = []) {
  const source = normalizeScanText(rawText)
  if (!source) return []
  const ranked = []
  for (const candidate of candidates) {
    let bestScore = 0
    let bestTerm = ''
    for (const term of candidateSearchTerms(candidate)) {
      const contains = source.includes(term) || term.includes(source)
      const distance = editDistance(source, term)
      const score = contains
        ? Math.min(1, 0.82 + Math.min(source.length, term.length) / Math.max(source.length, term.length) * 0.18)
        : 1 - distance / Math.max(source.length, term.length)
      if (score > bestScore) {
        bestScore = score
        bestTerm = term
      }
    }
    ranked.push({ ...candidate, score: bestScore, term: bestTerm })
  }
  return ranked.sort((left, right) => right.score - left.score)
}

export function bestScanMatch(rawText, candidates = [], minimumScore = 0.48) {
  const best = rankScanCandidates(rawText, candidates)[0]
  return best && best.score >= minimumScore ? best : null
}

export function catalogNameCandidates(rows = [], fields = []) {
  const nameField = fields.find((field) => field.key === 'name' && field.type === 'text')
    || fields.find((field) => field.type === 'text')
  if (!nameField) return []
  return rows
    .map((row) => ({
      value: row.id,
      label: String(row.values?.[nameField.key] || '').trim(),
    }))
    .filter((candidate) => candidate.label)
}

export function scannerOptionCandidates(field) {
  return (field?.options || []).map((option) => ({
    value: option.value,
    label: option.label,
  }))
}
