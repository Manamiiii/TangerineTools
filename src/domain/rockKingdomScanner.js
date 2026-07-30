import {
  MAX_CULTIVATION_LEVEL,
  MAX_CULTIVATION_STARS,
  calculateCultivatedStat,
  cultivationNatureModifier,
} from './rockKingdomStats.js'

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
  { value: 'none', label: '无', fileName: 'none.png' },
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
  partnerMark: { label: '伙伴标记', x: 0.861875, y: 0.188889, width: 0.0225, height: 0.05 },
  bloodline: { label: '血脉', x: 0.9, y: 0.185, width: 0.055, height: 0.06 },
  nature: { label: '性格', x: 0.735, y: 0.755, width: 0.095, height: 0.07 },
  specialty: { label: '特长', x: 0.855, y: 0.755, width: 0.095, height: 0.07 },
  appearance: { label: '外观', x: 0.903125, y: 0.645833, width: 0.04375, height: 0.097222 },
}

export const ROCK_SCANNER_IDENTITY_CROP_PROFILE = {
  level: { label: '等级', x: 0.665, y: 0.275, width: 0.085, height: 0.07 },
  stars: { label: '星级', x: 0.67, y: 0.17, width: 0.14, height: 0.08 },
  trait: { label: '特性', x: 0.68, y: 0.815, width: 0.13, height: 0.055 },
  hp: { label: '生命', x: 0.785, y: 0.35, width: 0.055, height: 0.055 },
  patk: { label: '物攻', x: 0.715, y: 0.43, width: 0.055, height: 0.055 },
  matk: { label: '魔攻', x: 0.865, y: 0.43, width: 0.055, height: 0.055 },
  pdef: { label: '物防', x: 0.715, y: 0.57, width: 0.055, height: 0.055 },
  mdef: { label: '魔防', x: 0.865, y: 0.57, width: 0.055, height: 0.055 },
  spd: { label: '速度', x: 0.785, y: 0.64, width: 0.055, height: 0.055 },
}

export const ROCK_SCANNER_STABILITY_REGION = {
  x: 0.66,
  y: 0.1,
  width: 0.335,
  height: 0.78,
}

export const ROCK_SCANNER_DEVICE_PROFILE = {
  width: 3200,
  height: 1440,
  label: '固定手机 · 3200×1440 横屏',
}

const ROCK_SCANNER_ANCHOR_REGIONS = [
  { x: 0.07, y: 0.02, width: 0.38, height: 0.12, weight: 1.2 },
  { x: 0.57, y: 0.09, width: 0.34, height: 0.13, weight: 1.1 },
  { x: 0.2, y: 0.3, width: 0.7, height: 0.47, weight: 0.8 },
  { x: 0.2, y: 0.82, width: 0.32, height: 0.14, weight: 1 },
  { x: 0.56, y: 0.82, width: 0.34, height: 0.14, weight: 1 },
]

function signatureRegionQuality(signature, width, height, region) {
  const left = Math.max(0, Math.floor(width * region.x))
  const top = Math.max(0, Math.floor(height * region.y))
  const right = Math.min(width - 1, Math.ceil(width * (region.x + region.width)))
  const bottom = Math.min(height - 1, Math.ceil(height * (region.y + region.height)))
  const histogram = new Uint32Array(256)
  let pixelCount = 0
  let edgeCount = 0
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const current = signature[y * width + x]
      const horizontal = Math.abs(current - signature[y * width + x + 1])
      const vertical = Math.abs(current - signature[(y + 1) * width + x])
      const edge = Math.max(horizontal, vertical)
      histogram[edge] += 1
      pixelCount += 1
      if (edge >= 18) edgeCount += 1
    }
  }
  if (!pixelCount) return 0
  const topCount = Math.max(1, Math.ceil(pixelCount * 0.2))
  let remaining = topCount
  let edgeTotal = 0
  for (let edge = 255; edge >= 0 && remaining > 0; edge -= 1) {
    const take = Math.min(remaining, histogram[edge])
    edgeTotal += edge * take
    remaining -= take
  }
  const sharpness = Math.min(1, edgeTotal / topCount / 80)
  const coverage = Math.min(1, edgeCount / pixelCount / 0.08)
  return sharpness * 0.72 + coverage * 0.28
}

export function scannerAnchorQuality(signature, width = 120, height = 80) {
  if (!signature?.length || signature.length !== width * height) return 0
  let weightedQuality = 0
  let totalWeight = 0
  for (const region of ROCK_SCANNER_ANCHOR_REGIONS) {
    weightedQuality += signatureRegionQuality(signature, width, height, region) * region.weight
    totalWeight += region.weight
  }
  return weightedQuality / totalWeight
}

export function scannerSignatureDifference(left, right, topFraction = 0.15) {
  if (!left?.length || left.length !== right?.length) return Number.POSITIVE_INFINITY
  const histogram = new Uint32Array(256)
  for (let index = 0; index < left.length; index += 1) {
    histogram[Math.abs(left[index] - right[index])] += 1
  }
  const count = Math.max(1, Math.ceil(left.length * topFraction))
  let total = 0
  let remaining = count
  for (let difference = 255; difference >= 0 && remaining > 0; difference -= 1) {
    const take = Math.min(remaining, histogram[difference])
    total += difference * take
    remaining -= take
  }
  return total / count
}

export function selectStableScannerSamples(
  samples = [],
  {
    windowSize = 3,
    stableThreshold = 7,
    duplicateThreshold = 8,
    minimumAnchorQuality = 0.4,
  } = {},
) {
  const selected = []
  let stableRun = []
  const finishStableRun = () => {
    if (stableRun.length === 0) return
    const candidate = stableRun.reduce((best, sample) => (
      (sample.anchorQuality ?? 1) > (best.anchorQuality ?? 1) ? sample : best
    ))
    stableRun = []
    if (candidate.anchorQuality != null && candidate.anchorQuality < minimumAnchorQuality) return
    const previous = selected.at(-1)
    if (
      previous
      && scannerSignatureDifference(previous.signature, candidate.signature) <= duplicateThreshold
    ) return
    selected.push(candidate)
  }
  for (let index = windowSize - 1; index < samples.length; index += 1) {
    const window = samples.slice(index - windowSize + 1, index + 1)
    const stable = window.slice(1).every((sample, offset) => (
      scannerSignatureDifference(window[offset].signature, sample.signature) <= stableThreshold
    )) && scannerSignatureDifference(window[0].signature, window.at(-1).signature) <= stableThreshold
    if (!stable) {
      finishStableRun()
      continue
    }
    stableRun.push(window.at(-1))
  }
  finishStableRun()
  return selected
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
  let dotProduct = 0
  let sampleMagnitude = 0
  let templateMagnitude = 0
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
      dotProduct += sampleWeight * templateWeight
      sampleMagnitude += sampleWeight ** 2
      templateMagnitude += templateWeight ** 2
    }
  }
  if (union <= 0) return 0
  const overlap = intersection / union
  const cosine = dotProduct / Math.max(Math.sqrt(sampleMagnitude * templateMagnitude), Number.EPSILON)
  return overlap * 0.35 + cosine * 0.65
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
  { minimumScore = 0.68, minimumGap = 0.06 } = {},
) {
  if (!sample) return { value: 'none', label: '无', score: 0.96 }
  const ranked = rankPartnerMarkTemplateMatches(sample, templates)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return null
  if (ranked[1] && best.score - ranked[1].score < minimumGap) return null
  return best
}

export function rankPartnerMarkTemplateMatches(sample, templates = []) {
  if (!sample) return []
  return templates
    .map((template) => ({ ...template, score: partnerMarkMaskSimilarity(sample, template) }))
    .sort((left, right) => right.score - left.score)
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

export function recognizeScannerStarCount(imageData) {
  const pixels = imageData?.data || imageData?.pixels
  const width = Number(imageData?.width)
  const height = Number(imageData?.height)
  if (!pixels?.length || !width || !height) return null
  const columnEvidence = new Uint32Array(width)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      if (
        red > 150
        && green > 100
        && blue < 135
        && red - blue > 50
        && green - blue > 20
      ) {
        columnEvidence[x] += 1
      }
    }
  }
  const minimumColumnEvidence = Math.max(2, Math.round(height * 0.035))
  const maximumGap = Math.max(3, Math.round(width * 0.018))
  const minimumRunEvidence = Math.max(18, Math.round(height * width * 0.0015))
  const runs = []
  for (let x = 0; x < width; x += 1) {
    if (columnEvidence[x] < minimumColumnEvidence) continue
    const previous = runs.at(-1)
    if (!previous || x - previous.right > maximumGap) {
      runs.push({ left: x, right: x, evidence: columnEvidence[x] })
    } else {
      previous.right = x
      previous.evidence += columnEvidence[x]
    }
  }
  return Math.min(
    MAX_CULTIVATION_STARS,
    runs.filter((run) => run.evidence >= minimumRunEvidence).length,
  )
}

export function parseScannerLevel(value) {
  const source = String(value || '').trim()
  const match = source.match(/(?:^|\D)([1-5]?\d|60)\s*\/\s*60(?:\D|$)/)
    || source.match(/^([1-5]?\d|60)$/)
  return match ? Number(match[1]) : 0
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

export function bestScanMatch(rawText, candidates = [], options = 0.48) {
  const { minimumScore, minimumGap } = typeof options === 'number'
    ? { minimumScore: options, minimumGap: 0 }
    : { minimumScore: 0.48, minimumGap: 0, ...options }
  const ranked = rankScanCandidates(rawText, candidates)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return null
  if (best.score === 1 && best.term === normalizeScanText(rawText)) return best
  const distinctRunnerUp = ranked.find((candidate) => candidate.term !== best.term)
  if (distinctRunnerUp && best.score - distinctRunnerUp.score < minimumGap) return null
  return best
}

export function scannerCharacterWhitelist(candidates = []) {
  const characters = new Set()
  for (const candidate of candidates) {
    const terms = [candidate.label, ...(candidate.aliases || [])]
    for (const term of terms) {
      for (const character of String(term || '').normalize('NFKC')) {
        if (/[\p{Script=Han}\p{Letter}\p{Number}]/u.test(character)) characters.add(character)
      }
    }
  }
  return [...characters].join('')
}

export function catalogNameCandidates(rows = [], fields = []) {
  const nameField = fields.find((field) => field.key === 'name' && field.type === 'text')
    || fields.find((field) => field.type === 'text')
  if (!nameField) return []
  return rows
    .map((row) => ({
      value: row.id,
      label: String(row.values?.[nameField.key] || '').trim(),
      traitName: String(row.values?.traitName || '').trim(),
      stats: Object.fromEntries(
        ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
          .map((key) => [key, Number(row.values?.[key]) || 0]),
      ),
    }))
    .filter((candidate) => candidate.label)
}

export function scannerOptionCandidates(field) {
  return (field?.options || []).map((option) => ({
    value: option.value,
    label: option.label,
    aliases: option.aliases,
  }))
}

const SCANNER_SHAPE_STAT_KEYS = ['patk', 'matk', 'pdef', 'mdef', 'spd']
const SCANNER_FORMULA_STAT_KEYS = ['hp', ...SCANNER_SHAPE_STAT_KEYS]
const SCANNER_INDIVIDUAL_VALUES = [7, 8, 9, 10]

export function scannerStatShapeSimilarity(panelStats = {}, baseStats = {}) {
  // 等级和升星主要改变整体尺度；去均值后的相关性只比较五维轮廓。
  // 生命使用不同成长公式，因此不参与形态自动判别。
  const pairs = SCANNER_SHAPE_STAT_KEYS
    .map((key) => [Number(panelStats[key]), Number(baseStats[key])])
    .filter(([panel, base]) => panel > 0 && base > 0)
  if (pairs.length < 4) return 0
  const panelMean = pairs.reduce((sum, [panel]) => sum + panel, 0) / pairs.length
  const baseMean = pairs.reduce((sum, [, base]) => sum + base, 0) / pairs.length
  let covariance = 0
  let panelMagnitude = 0
  let baseMagnitude = 0
  for (const [panel, base] of pairs) {
    const centeredPanel = panel - panelMean
    const centeredBase = base - baseMean
    covariance += centeredPanel * centeredBase
    panelMagnitude += centeredPanel ** 2
    baseMagnitude += centeredBase ** 2
  }
  const correlation = covariance / Math.max(
    Math.sqrt(panelMagnitude * baseMagnitude),
    Number.EPSILON,
  )
  return Math.max(0, Math.min(1, (correlation + 1) / 2))
}

function scannerIndividualAllocations() {
  const allocations = []
  const visit = (index, selected, values) => {
    if (index === SCANNER_FORMULA_STAT_KEYS.length) {
      if (selected >= 1 && selected <= 3) allocations.push({ ...values })
      return
    }
    const remaining = SCANNER_FORMULA_STAT_KEYS.length - index
    if (selected + remaining < 1 || selected > 3) return
    const key = SCANNER_FORMULA_STAT_KEYS[index]
    values[key] = 0
    visit(index + 1, selected, values)
    if (selected < 3) {
      for (const individualValue of SCANNER_INDIVIDUAL_VALUES) {
        values[key] = individualValue
        visit(index + 1, selected + 1, values)
      }
    }
    delete values[key]
  }
  visit(0, 0, {})
  return allocations
}

const SCANNER_INDIVIDUAL_ALLOCATIONS = scannerIndividualAllocations()

export function scannerCultivationFit(
  panelStats = {},
  baseStats = {},
  {
    level = 0,
    stars = null,
    nature = null,
  } = {},
) {
  const normalizedLevel = Number(level)
  const normalizedStars = Number(stars)
  const comparableKeys = SCANNER_FORMULA_STAT_KEYS.filter((key) => (
    Number(panelStats[key]) > 0 && Number(baseStats[key]) > 0
  ))
  if (
    comparableKeys.length < 5
    || normalizedLevel < 1
    || normalizedLevel > MAX_CULTIVATION_LEVEL
    || !Number.isInteger(normalizedStars)
    || normalizedStars < 0
    || normalizedStars > MAX_CULTIVATION_STARS
    || !nature?.raise
    || !nature?.lower
  ) return null
  let best = null
  for (const individualStats of SCANNER_INDIVIDUAL_ALLOCATIONS) {
    let squaredError = 0
    let absoluteError = 0
    const predictedStats = {}
    for (const key of comparableKeys) {
      const predicted = calculateCultivatedStat(baseStats[key], key, {
        level: normalizedLevel,
        stars: normalizedStars,
        individualDisplayValue: individualStats[key],
        natureModifier: cultivationNatureModifier(key, nature, normalizedStars),
      })
      predictedStats[key] = predicted
      const difference = predicted - Number(panelStats[key])
      squaredError += difference ** 2
      absoluteError += Math.abs(difference)
    }
    const rmse = Math.sqrt(squaredError / comparableKeys.length)
    if (best && rmse >= best.rmse) continue
    best = {
      rmse,
      mae: absoluteError / comparableKeys.length,
      score: Math.exp(-rmse / 6),
      predictedStats,
      individualStats: { ...individualStats },
    }
  }
  return best
}

function distinctCandidateRunnerUp(ranked, best) {
  return ranked.find((candidate) => candidate.term !== best.term)
}

function nameCandidatePool(rawName, candidates, minimumScore = 0.62, minimumGap = 0.08) {
  const ranked = rankScanCandidates(rawName, candidates)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return { pool: [], score: 0 }
  const exactVisibleName = best.score === 1 && best.term === normalizeScanText(rawName)
  const runnerUp = distinctCandidateRunnerUp(ranked, best)
  if (!exactVisibleName && runnerUp && best.score - runnerUp.score < minimumGap) {
    return { pool: [], score: best.score }
  }
  return {
    pool: ranked.filter((candidate) => candidate.term === best.term && candidate.score === best.score),
    score: best.score,
  }
}

function traitCandidatePool(rawTrait, candidates) {
  if (!rawTrait) return []
  const traits = [...new Map(candidates
    .filter((candidate) => candidate.traitName)
    .map((candidate) => [
      candidate.traitName,
      { value: candidate.traitName, label: candidate.traitName },
    ])).values()]
  const match = bestScanMatch(rawTrait, traits, { minimumScore: 0.62, minimumGap: 0.08 })
  if (!match) return []
  return candidates.filter((candidate) => normalizeScanText(candidate.traitName) === normalizeScanText(match.label))
}

export function resolveScannerReference({
  rawName = '',
  rawTrait = '',
  panelStats = {},
  level = 0,
  stars = null,
  nature = null,
  candidates = [],
  minimumShapeScore = 0.82,
  minimumShapeGap = 0.06,
  maximumFormulaRmse = 2.5,
  minimumFormulaRmseGap = 1.5,
} = {}) {
  const nameMatch = nameCandidatePool(rawName, candidates)
  let pool = nameMatch.pool
  let source = 'name'
  if (pool.length === 1) {
    return { value: pool[0].value, score: nameMatch.score, source, candidates: pool }
  }
  const traitPool = traitCandidatePool(rawTrait, candidates)
  if (pool.length > 1 && traitPool.length > 0) {
    const traitIds = new Set(traitPool.map((candidate) => candidate.value))
    const intersection = pool.filter((candidate) => traitIds.has(candidate.value))
    if (intersection.length > 0) pool = intersection
  } else if (pool.length === 0 && traitPool.length > 0) {
    pool = traitPool
    source = 'trait'
  }
  if (pool.length === 1) {
    return { value: pool[0].value, score: Math.max(nameMatch.score, 0.82), source, candidates: pool }
  }
  if (pool.length === 0) {
    return { value: '', score: 0, source: 'unresolved', candidates: [] }
  }
  const ranked = pool
    .map((candidate) => ({
      ...candidate,
      shapeScore: scannerStatShapeSimilarity(panelStats, candidate.stats),
      cultivationFit: scannerCultivationFit(panelStats, candidate.stats, {
        level,
        stars,
        nature,
      }),
    }))
    .sort((left, right) => {
      if (left.cultivationFit && right.cultivationFit) {
        return left.cultivationFit.rmse - right.cultivationFit.rmse
      }
      if (left.cultivationFit) return -1
      if (right.cultivationFit) return 1
      return right.shapeScore - left.shapeScore
    })
  const best = ranked[0]
  const runnerUp = ranked[1]
  if (
    best?.cultivationFit
    && best.cultivationFit.rmse <= maximumFormulaRmse
    && (
      !runnerUp?.cultivationFit
      || runnerUp.cultivationFit.rmse - best.cultivationFit.rmse >= minimumFormulaRmseGap
    )
  ) {
    return {
      value: best.value,
      score: best.cultivationFit.score,
      source: source === 'name' ? 'name+formula' : 'trait+formula',
      candidates: ranked,
      level: Number(level),
      stars: Number(stars),
    }
  }
  if (
    !best
    || best.shapeScore < minimumShapeScore
    || (runnerUp && best.shapeScore - runnerUp.shapeScore < minimumShapeGap)
  ) {
    return {
      value: '',
      score: best?.shapeScore || nameMatch.score,
      source: 'ambiguous',
      candidates: ranked,
    }
  }
  return {
    value: best.value,
    score: best.shapeScore,
    source: source === 'name' ? 'name+stats' : 'trait+stats',
    candidates: ranked,
  }
}
