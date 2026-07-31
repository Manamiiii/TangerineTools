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

export const ROCK_SCANNER_TEXT_LABEL_TEMPLATES = {
  nature: [
    { value: 'practical', label: '踏实', fileName: 'practical.png' },
  ],
  specialty: [
    { value: 'brave', label: '无畏', fileName: 'brave.png' },
    { value: 'raid', label: '奇袭', fileName: 'raid.png' },
  ],
}

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

export const ROCK_SCANNER_CHANGE_REGIONS = [
  { x: 0.1, y: 0.06, width: 0.53, height: 0.73, signatureHeight: 48 },
  ROCK_SCANNER_CROP_PROFILE.name,
  ROCK_SCANNER_CROP_PROFILE.gender,
  ROCK_SCANNER_CROP_PROFILE.partnerMark,
  ROCK_SCANNER_CROP_PROFILE.bloodline,
  ROCK_SCANNER_CROP_PROFILE.nature,
  ROCK_SCANNER_CROP_PROFILE.specialty,
  ROCK_SCANNER_CROP_PROFILE.appearance,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.level,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.trait,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.hp,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.patk,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.matk,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.pdef,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.mdef,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE.spd,
]

export const ROCK_SCANNER_DEVICE_PROFILE = {
  width: 3200,
  height: 1440,
  label: '固定手机 · 3200×1440 横屏',
}

export function parseScannerPanelStat(value) {
  const digits = String(value || '')
    .normalize('NFKC')
    .replace(/\D/g, '')
  if (!digits || digits.length > 4) return 0
  return Number(digits) || 0
}

export function selectScannerPanelStat(rawVariants = [], { trustedVariantCount = 1 } = {}) {
  const parsed = rawVariants
    .map(parseScannerPanelStat)
  const trustedCandidates = [...new Set(parsed
    .slice(0, trustedVariantCount)
    .filter((value) => value > 0))]
  const fallbackValues = parsed
    .slice(trustedVariantCount)
    .filter((value) => value > 0)
  const fallbackCandidates = [...new Set(fallbackValues)]
  const candidates = [...new Set([...trustedCandidates, ...fallbackCandidates])]

  if (trustedCandidates.length === 1) {
    return { value: trustedCandidates[0], candidates, ambiguous: false }
  }
  if (trustedCandidates.length > 1) {
    const fallbackVotes = fallbackValues.filter((value) => trustedCandidates.includes(value))
    const resolved = trustedCandidates.find((candidate) => (
      fallbackVotes.filter((value) => value === candidate).length
      > fallbackVotes.filter((value) => value !== candidate).length
    ))
    return {
      value: resolved || 0,
      candidates,
      ambiguous: !resolved,
    }
  }

  const parsedFallback = fallbackValues
  const candidatesOnly = fallbackCandidates
  if (candidatesOnly.length === 0) {
    return { value: 0, candidates: [], ambiguous: false }
  }

  const counts = new Map(candidatesOnly.map((value) => [
    value,
    parsedFallback.filter((candidate) => candidate === value).length,
  ]))
  const ranked = candidatesOnly
    .map((value, firstIndex) => ({ value, count: counts.get(value), firstIndex }))
    .sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex)
  const ambiguous = ranked.length > 1 && ranked[0].count === ranked[1].count
  return {
    value: ambiguous ? 0 : ranked[0].value,
    candidates: candidatesOnly,
    ambiguous,
  }
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

export function scannerFrameSelectionAfterAction(frames = [], currentId = '', { removing = false } = {}) {
  const index = frames.findIndex((frame) => frame.id === currentId)
  if (index < 0) return frames[0]?.id || ''
  if (!removing) return frames[index + 1]?.id || currentId
  return frames[index + 1]?.id || frames[index - 1]?.id || ''
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
  const changeSignature = (sample) => sample.changeSignature || sample.signature
  const selectWithSignature = (signatureFor) => {
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
        && scannerSignatureDifference(
          signatureFor(previous),
          signatureFor(candidate),
        ) <= duplicateThreshold
      ) return
      selected.push(candidate)
    }
    for (let index = windowSize - 1; index < samples.length; index += 1) {
      const window = samples.slice(index - windowSize + 1, index + 1)
      const stable = window.slice(1).every((sample, offset) => (
        scannerSignatureDifference(
          signatureFor(window[offset]),
          signatureFor(sample),
        ) <= stableThreshold
      )) && scannerSignatureDifference(
        signatureFor(window[0]),
        signatureFor(window.at(-1)),
      ) <= stableThreshold
      if (!stable) {
        finishStableRun()
        continue
      }
      stableRun.push(window.at(-1))
    }
    finishStableRun()
    return selected
  }

  const primary = selectWithSignature(changeSignature)
  const panelFallback = selectWithSignature((sample) => sample.signature)
  const sampleIntervals = samples
    .slice(1)
    .map((sample, index) => sample.time - samples[index].time)
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((left, right) => left - right)
  const medianInterval = sampleIntervals[Math.floor(sampleIntervals.length / 2)] || 0.3
  const fallbackTimeGap = medianInterval * (windowSize + 1)
  for (const candidate of panelFallback) {
    if (primary.some((sample) => Math.abs(sample.time - candidate.time) <= fallbackTimeGap)) continue
    primary.push(candidate)
  }
  return primary.sort((left, right) => left.time - right.time)
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

export function normalizedScannerTextLabelMask(
  imageData,
  {
    targetWidth = 96,
    targetHeight = 32,
    contentFraction = 0.62,
  } = {},
) {
  const pixels = imageData?.data || imageData?.pixels
  const width = Number(imageData?.width)
  const height = Number(imageData?.height)
  if (!pixels?.length || !width || !height) return null
  const contentWidth = Math.max(1, Math.round(width * contentFraction))
  const weights = new Float32Array(contentWidth * height)
  let left = contentWidth
  let top = height
  let right = -1
  let bottom = -1
  let evidence = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < contentWidth; x += 1) {
      const offset = (y * width + x) * 4
      const luminance = (
        pixels[offset] * 0.2126
        + pixels[offset + 1] * 0.7152
        + pixels[offset + 2] * 0.0722
      )
      const weight = Math.max(0, Math.min(1, (luminance - 120) / 105))
      weights[y * contentWidth + x] = weight
      evidence += weight
      if (weight < 0.2) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || evidence < 12) return null
  const sourceWidth = Math.max(1, right - left + 1)
  const sourceHeight = Math.max(1, bottom - top + 1)
  const scale = Math.min(
    (targetWidth - 4) / sourceWidth,
    (targetHeight - 4) / sourceHeight,
  )
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale))
  const offsetX = Math.floor((targetWidth - outputWidth) / 2)
  const offsetY = Math.floor((targetHeight - outputHeight) / 2)
  const mask = new Float32Array(targetWidth * targetHeight)
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.min(
        right,
        left + Math.round(x / Math.max(outputWidth - 1, 1) * (sourceWidth - 1)),
      )
      const sourceY = Math.min(
        bottom,
        top + Math.round(y / Math.max(outputHeight - 1, 1) * (sourceHeight - 1)),
      )
      mask[(offsetY + y) * targetWidth + offsetX + x] = weights[sourceY * contentWidth + sourceX]
    }
  }
  return { pixels: mask, width: targetWidth, height: targetHeight, evidence }
}

export function rankScannerTextLabelTemplateMatches(sample, templates = []) {
  if (!sample) return []
  return templates
    .map((template) => ({
      ...template,
      score: partnerMarkMaskSimilarity(sample, template),
    }))
    .sort((left, right) => right.score - left.score)
}

export function bestScannerTextLabelTemplateMatch(
  sample,
  templates = [],
  { minimumScore = 0.88, minimumGap = 0.05 } = {},
) {
  const ranked = rankScannerTextLabelTemplateMatches(sample, templates)
  const best = ranked[0]
  if (!best || best.score < minimumScore) return null
  const runnerUp = ranked.find((candidate) => candidate.value !== best.value)
  if (runnerUp && best.score - runnerUp.score < minimumGap) return null
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

export function recognizeScannerStatTone(imageData) {
  const pixels = imageData?.data || imageData?.pixels
  if (!pixels?.length) return { tone: 'unknown', confidence: 0 }
  let whiteEvidence = 0
  let yellowEvidence = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    const maximum = Math.max(red, green, blue)
    const minimum = Math.min(red, green, blue)
    if (minimum >= 165 && maximum - minimum <= 22) {
      whiteEvidence += 1
    }
    if (
      red >= 175
      && green >= 125
      && blue <= 185
      && red - blue >= 45
      && green - blue >= 15
    ) {
      yellowEvidence += 1
    }
  }
  const strongest = Math.max(whiteEvidence, yellowEvidence)
  if (strongest < 8) {
    return { tone: 'unknown', confidence: 0, whiteEvidence, yellowEvidence }
  }
  if (whiteEvidence >= 12 && whiteEvidence >= yellowEvidence * 1.8) {
    return {
      tone: 'white',
      confidence: Math.min(0.99, whiteEvidence / Math.max(whiteEvidence + yellowEvidence, 1)),
      whiteEvidence,
      yellowEvidence,
    }
  }
  if (yellowEvidence >= 8 && yellowEvidence >= whiteEvidence * 0.75) {
    return {
      tone: 'yellow',
      confidence: Math.min(0.99, yellowEvidence / Math.max(whiteEvidence + yellowEvidence, 1)),
      whiteEvidence,
      yellowEvidence,
    }
  }
  return { tone: 'unknown', confidence: 0, whiteEvidence, yellowEvidence }
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
  if (match) return Number(match[1])
  // 等级面板分母固定为 60；部分浏览器 OCR 会把末尾 60 读成 50。
  const compact = source.replace(/\D/g, '').match(/^([1-5]?\d|60)(?:50|60)$/)
  return compact ? Number(compact[1]) : 0
}

export function selectScannerLevel(rawVariants = []) {
  const parsed = rawVariants.map(parseScannerLevel).filter((value) => value > 0)
  const candidates = [...new Set(parsed)]
  if (candidates.length === 0) return { value: 0, candidates: [], ambiguous: false }
  const ranked = candidates
    .map((value, firstIndex) => ({
      value,
      firstIndex,
      count: parsed.filter((candidate) => candidate === value).length,
    }))
    .sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex)
  const ambiguous = ranked.length > 1 && ranked[0].count === ranked[1].count
  return {
    value: ambiguous ? 0 : ranked[0].value,
    candidates,
    ambiguous,
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

export const SCANNER_DUPLICATE_IDENTITY_KEYS = [
  'appearance',
  'nature',
  'gender',
  'specialty',
]

function scannerComparableValue(value) {
  if (Array.isArray(value)) return value.map(String).sort().join('|')
  if (value == null) return ''
  return String(value).trim()
}

export function findScannerDuplicateCandidates(values = {}, rows = []) {
  const reference = scannerComparableValue(values.ref)
  if (!reference) return []
  return rows.flatMap((row) => {
    if (scannerComparableValue(row.values?.ref) !== reference) return []
    const matchingKeys = []
    const conflictingKeys = []
    const missingKeys = []
    for (const key of SCANNER_DUPLICATE_IDENTITY_KEYS) {
      const scannedValue = scannerComparableValue(values[key])
      const existingValue = scannerComparableValue(row.values?.[key])
      if (!scannedValue || !existingValue) {
        missingKeys.push(key)
      } else if (scannedValue === existingValue) {
        matchingKeys.push(key)
      } else {
        conflictingKeys.push(key)
      }
    }
    const rareAppearanceMatch = (
      scannerComparableValue(values.appearance)
      && scannerComparableValue(values.appearance) !== 'none'
      && matchingKeys.includes('appearance')
    )
    const exact = conflictingKeys.length === 0 && missingKeys.length === 0
    const likely = !exact
      && conflictingKeys.length === 0
      && (matchingKeys.length >= 3 || (rareAppearanceMatch && matchingKeys.length >= 2))
    const possible = !exact && !likely && matchingKeys.length >= 2 && conflictingKeys.length <= 1
    if (!exact && !likely && !possible) return []
    return [{
      row,
      level: exact ? 'exact' : likely ? 'likely' : 'possible',
      blocking: exact || likely,
      matchingKeys,
      conflictingKeys,
      missingKeys,
      partnerMarkMatches: (
        scannerComparableValue(values.partnerMark)
        && scannerComparableValue(row.values?.partnerMark)
        && scannerComparableValue(values.partnerMark)
          === scannerComparableValue(row.values?.partnerMark)
      ),
      bloodlineMatches: (
        scannerComparableValue(values.bloodline)
        && scannerComparableValue(row.values?.bloodline)
        && scannerComparableValue(values.bloodline)
          === scannerComparableValue(row.values?.bloodline)
      ),
    }]
  }).sort((left, right) => (
    Number(right.blocking) - Number(left.blocking)
    || right.matchingKeys.length - left.matchingKeys.length
    || left.conflictingKeys.length - right.conflictingKeys.length
  ))
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
    label: String(option.label || '').split(/[（(]/)[0].trim(),
    aliases: option.aliases,
  }))
}

const SCANNER_SHAPE_STAT_KEYS = ['patk', 'matk', 'pdef', 'mdef', 'spd']
const SCANNER_FORMULA_STAT_KEYS = ['hp', ...SCANNER_SHAPE_STAT_KEYS]
const SCANNER_INDIVIDUAL_VALUES = [7, 8, 9, 10]

export function scannerLegalPanelStatValues(
  candidates = [],
  key,
  {
    level = 0,
    stars = null,
    nature = null,
    tone = 'unknown',
  } = {},
) {
  const normalizedLevel = Number(level)
  const normalizedStars = Number(stars)
  if (
    !SCANNER_FORMULA_STAT_KEYS.includes(key)
    || normalizedLevel < 1
    || normalizedLevel > MAX_CULTIVATION_LEVEL
    || stars == null
    || !Number.isInteger(normalizedStars)
    || normalizedStars < 0
    || normalizedStars > MAX_CULTIVATION_STARS
    || !nature?.raise
    || !nature?.lower
  ) return []
  const individualValues = tone === 'white'
    ? [0]
    : tone === 'yellow'
      ? SCANNER_INDIVIDUAL_VALUES
      : [0, ...SCANNER_INDIVIDUAL_VALUES]
  const values = new Set()
  for (const candidate of candidates) {
    const baseStat = Number(candidate.stats?.[key])
    if (baseStat <= 0) continue
    for (const individualDisplayValue of individualValues) {
      values.add(calculateCultivatedStat(baseStat, key, {
        level: normalizedLevel,
        stars: normalizedStars,
        individualDisplayValue,
        natureModifier: cultivationNatureModifier(key, nature, normalizedStars),
      }))
    }
  }
  return [...values].sort((left, right) => left - right)
}

export function reconcileScannerPanelStat(result = {}, legalValues = []) {
  const legal = new Set(legalValues.map(Number).filter((value) => value > 0))
  const currentValue = Number(result.value) || 0
  if (currentValue === 0 && (result.candidates || []).length === 0) return result
  if (legal.size === 0) return result

  const exactRepairs = new Set(
    (result.candidates || []).map(Number).filter((value) => legal.has(value)),
  )
  if (exactRepairs.size === 1) {
    const repairedValue = [...exactRepairs][0]
    return {
      ...result,
      value: repairedValue,
      ambiguous: false,
      formulaRepaired: repairedValue !== currentValue,
    }
  }
  if (legal.has(currentValue)) return result

  const repairs = new Set()
  for (const candidate of result.candidates || []) {
    const recognized = String(candidate)
    for (const legalValue of legal) {
      const expected = String(legalValue)
      if (recognized.length > expected.length && (
        recognized.startsWith(expected) || recognized.endsWith(expected)
      )) {
        repairs.add(legalValue)
      }
    }
  }
  if (repairs.size === 1) {
    return {
      ...result,
      value: [...repairs][0],
      ambiguous: false,
      formulaRepaired: true,
    }
  }
  return {
    ...result,
    value: 0,
    ambiguous: (result.candidates || []).length > 0,
    rejectedByFormula: true,
  }
}

function scannerConstrainedStatChoices(result = {}, legalValues = []) {
  const legal = [...new Set(legalValues.map(Number).filter((value) => value > 0))]
  const recognizedValues = [...new Set([
    Number(result.value) || 0,
    ...(result.candidates || []).map(Number),
  ].filter((value) => value > 0))]
  if (recognizedValues.length === 0 || legal.length === 0) return []
  const choices = new Map()
  const addChoice = (value, repairCost, recognizedValue) => {
    const previous = choices.get(value)
    if (previous && previous.repairCost <= repairCost) return
    choices.set(value, { value, repairCost, recognizedValue })
  }
  for (const recognizedValue of recognizedValues) {
    if (legal.includes(recognizedValue)) addChoice(recognizedValue, 0, recognizedValue)
    const recognized = String(recognizedValue)
    for (const legalValue of legal) {
      const expected = String(legalValue)
      if (
        recognized.length > expected.length
        && (recognized.startsWith(expected) || recognized.endsWith(expected))
      ) {
        addChoice(
          legalValue,
          0.35 + (recognized.length - expected.length) * 0.1,
          recognizedValue,
        )
      }
      if (
        expected.length > recognized.length
        && expected.length - recognized.length <= 1
        && (expected.startsWith(recognized) || expected.endsWith(recognized))
      ) {
        addChoice(
          legalValue,
          0.8 + (expected.length - recognized.length) * 0.2,
          recognizedValue,
        )
      }
    }
  }
  return [...choices.values()]
    .sort((left, right) => left.repairCost - right.repairCost || left.value - right.value)
    .slice(0, 8)
}

function scannerConstrainedPanelCombinations(
  panelStatOcr,
  candidates,
  { level, stars, nature, statTones },
) {
  let combinations = [{
    panelStats: {},
    panelStatOcr: {},
    repairCost: 0,
    evidenceCount: 0,
  }]
  for (const key of SCANNER_FORMULA_STAT_KEYS) {
    const result = panelStatOcr[key] || { value: 0, candidates: [], ambiguous: false }
    const choices = scannerConstrainedStatChoices(
      result,
      scannerLegalPanelStatValues(candidates, key, {
        level,
        stars,
        nature,
        tone: statTones[key]?.tone,
      }),
    )
    const alternatives = choices.length > 0 ? choices : [{ value: 0, repairCost: 0 }]
    combinations = combinations.flatMap((combination) => alternatives.map((choice) => ({
      panelStats: { ...combination.panelStats, [key]: choice.value },
      panelStatOcr: {
        ...combination.panelStatOcr,
        [key]: choice.value > 0
          ? {
              ...result,
              value: choice.value,
              ambiguous: false,
              formulaRepaired: choice.value !== Number(result.value || 0),
            }
          : {
              ...result,
              value: 0,
              rejectedByFormula: (result.candidates || []).length > 0,
            },
      },
      repairCost: combination.repairCost + choice.repairCost,
      evidenceCount: combination.evidenceCount + (choice.value > 0 ? 1 : 0),
    })))
      .sort((left, right) => (
        right.evidenceCount - left.evidenceCount || left.repairCost - right.repairCost
      ))
      .slice(0, 96)
  }
  return combinations
}

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
    statTones = {},
  } = {},
) {
  const normalizedLevel = Number(level)
  const normalizedStars = Number(stars)
  const comparableKeys = SCANNER_FORMULA_STAT_KEYS.filter((key) => (
    Number(panelStats[key]) > 0 && Number(baseStats[key]) > 0
  ))
  const whiteStatKeys = comparableKeys.filter((key) => statTones[key]?.tone === 'white')
  const useWhiteStats = whiteStatKeys.length >= 3
  const useMixedEvidence = !useWhiteStats && whiteStatKeys.length >= 2 && comparableKeys.length >= 4
  const formulaStatKeys = useWhiteStats ? whiteStatKeys : comparableKeys
  if (
    formulaStatKeys.length < (useWhiteStats ? 3 : useMixedEvidence ? 4 : 5)
    || normalizedLevel < 1
    || normalizedLevel > MAX_CULTIVATION_LEVEL
    || stars == null
    || !Number.isInteger(normalizedStars)
    || normalizedStars < 0
    || normalizedStars > MAX_CULTIVATION_STARS
    || !nature?.raise
    || !nature?.lower
  ) return null
  let best = null
  for (const individualStats of SCANNER_INDIVIDUAL_ALLOCATIONS) {
    if ((useWhiteStats || useMixedEvidence) && whiteStatKeys.some((key) => individualStats[key] > 0)) continue
    let squaredError = 0
    let absoluteError = 0
    const predictedStats = {}
    for (const key of formulaStatKeys) {
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
    const rmse = Math.sqrt(squaredError / formulaStatKeys.length)
    if (best && rmse >= best.rmse) continue
    best = {
      rmse,
      mae: absoluteError / formulaStatKeys.length,
      score: Math.exp(-rmse / 6),
      predictedStats,
      individualStats: { ...individualStats },
      mode: useWhiteStats ? 'white-first' : useMixedEvidence ? 'mixed-evidence' : 'all-stats',
      statKeys: [...formulaStatKeys],
      whiteStatKeys: [...whiteStatKeys],
    }
  }
  return best
}

function formulaFailureCode({
  level,
  stars,
  nature,
  panelStats,
  statTones,
  best,
  runnerUp,
  maximumFormulaRmse,
  minimumFormulaRmseGap,
}) {
  const recognizedStatKeys = SCANNER_FORMULA_STAT_KEYS.filter((key) => Number(panelStats[key]) > 0)
  const whiteStatKeys = recognizedStatKeys.filter((key) => statTones[key]?.tone === 'white')
  if (Number(level) < 1 || Number(level) > MAX_CULTIVATION_LEVEL) return 'missing-level'
  if (stars == null || !Number.isInteger(Number(stars))) return 'missing-stars'
  if (!nature?.raise || !nature?.lower) return 'missing-nature'
  const hasMixedEvidence = recognizedStatKeys.length >= 4 && whiteStatKeys.length >= 2
  if (recognizedStatKeys.length < 5 && whiteStatKeys.length < 3 && !hasMixedEvidence) {
    return 'insufficient-stats'
  }
  if (!best?.cultivationFit) return 'formula-unavailable'
  if (best.cultivationFit.rmse > maximumFormulaRmse) return 'best-error-too-high'
  if (
    runnerUp?.cultivationFit
    && runnerUp.cultivationFit.rmse - best.cultivationFit.rmse < minimumFormulaRmseGap
  ) return 'candidate-gap-too-small'
  return 'resolved'
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
  statTones = {},
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
        statTones,
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
  const formulaFailure = formulaFailureCode({
    level,
    stars,
    nature,
    panelStats,
    statTones,
    best,
    runnerUp,
    maximumFormulaRmse,
    minimumFormulaRmseGap,
  })
  const recognizedStatKeys = SCANNER_FORMULA_STAT_KEYS.filter((key) => Number(panelStats[key]) > 0)
  const whiteStatKeys = recognizedStatKeys.filter((key) => statTones[key]?.tone === 'white')
  const diagnostics = {
    failure: formulaFailure,
    recognizedStatKeys,
    whiteStatKeys,
    yellowStatKeys: recognizedStatKeys.filter((key) => statTones[key]?.tone === 'yellow'),
    mode: best?.cultivationFit?.mode || (whiteStatKeys.length >= 3 ? 'white-first' : 'unavailable'),
    maximumFormulaRmse,
    minimumFormulaRmseGap,
    rmseGap: best?.cultivationFit && runnerUp?.cultivationFit
      ? runnerUp.cultivationFit.rmse - best.cultivationFit.rmse
      : null,
  }
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
      diagnostics,
    }
  }
  if (best?.cultivationFit && formulaFailure !== 'resolved') {
    return {
      value: '',
      score: best.cultivationFit.score,
      source: 'ambiguous',
      candidates: ranked,
      diagnostics,
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
      diagnostics,
    }
  }
  return {
    value: best.value,
    score: best.shapeScore,
    source: source === 'name' ? 'name+stats' : 'trait+stats',
    candidates: ranked,
    diagnostics,
  }
}

export function constrainScannerFormulaInputs({
  rawName = '',
  rawTrait = '',
  panelStatOcr = {},
  levelOcr = {},
  stars = null,
  nature = null,
  statTones = {},
  candidates = [],
  minimumAttemptGap = 0.75,
} = {}) {
  if (
    candidates.length < 2
    || stars == null
    || !Number.isInteger(Number(stars))
    || !nature?.raise
    || !nature?.lower
  ) {
    return { applied: false, attempts: [], failure: 'missing-formula-input' }
  }
  const recognizedLevel = Number(levelOcr.value) || 0
  const candidateLevels = [...new Set((levelOcr.candidates || [])
    .map(Number)
    .filter((value) => value >= 1 && value <= MAX_CULTIVATION_LEVEL))]
  const levels = Array.from({ length: MAX_CULTIVATION_LEVEL }, (_, index) => index + 1)
  const levelEvidenceCost = (level) => {
    if (recognizedLevel === level) return 0
    if (candidateLevels.includes(level)) return recognizedLevel ? 0.35 : 0
    if (!recognizedLevel && candidateLevels.length === 0) return 0
    const anchors = recognizedLevel ? [recognizedLevel, ...candidateLevels] : candidateLevels
    const distance = Math.min(...anchors.map((anchor) => Math.abs(anchor - level)))
    return 1.25 + Math.min(1.5, distance * 0.05)
  }
  const attempts = []
  for (const level of levels) {
    const combinations = scannerConstrainedPanelCombinations(panelStatOcr, candidates, {
      level,
      stars: Number(stars),
      nature,
      statTones,
    })
    for (const combination of combinations) {
      const identity = resolveScannerReference({
        rawName,
        rawTrait,
        panelStats: combination.panelStats,
        level,
        stars,
        nature,
        statTones,
        candidates,
      })
      if (!identity.value || !identity.source.endsWith('+formula')) continue
      const selectedCandidate = identity.candidates.find((candidate) => (
        candidate.value === identity.value
      ))
      const rmse = selectedCandidate?.cultivationFit?.rmse
      if (!Number.isFinite(rmse)) continue
      attempts.push({
        level,
        identity,
        panelStats: combination.panelStats,
        panelStatOcr: combination.panelStatOcr,
        evidenceCount: combination.evidenceCount,
        repairCost: combination.repairCost,
        levelEvidenceCost: levelEvidenceCost(level),
        rmse,
        totalCost: rmse + combination.repairCost + levelEvidenceCost(level),
      })
    }
  }
  const distinctAttempts = new Map()
  for (const attempt of attempts.sort((left, right) => (
    right.evidenceCount - left.evidenceCount
    || left.totalCost - right.totalCost
  ))) {
    const key = `${attempt.level}:${attempt.identity.value}`
    if (!distinctAttempts.has(key)) distinctAttempts.set(key, attempt)
  }
  const ranked = [...distinctAttempts.values()]
    .sort((left, right) => (
      right.evidenceCount - left.evidenceCount
      || left.totalCost - right.totalCost
    ))
  const best = ranked[0]
  const runnerUp = ranked[1]
  if (!best) return { applied: false, attempts: [], failure: 'no-legal-attempt' }
  const attemptGap = runnerUp
    ? runnerUp.totalCost - best.totalCost
      + (best.evidenceCount - runnerUp.evidenceCount) * 2
    : null
  const levelWasInferred = recognizedLevel !== best.level
  const decisive = !levelWasInferred || runnerUp == null || attemptGap >= minimumAttemptGap
  const summarizedAttempts = ranked.slice(0, 4).map((attempt) => ({
    level: attempt.level,
    value: attempt.identity.value,
    label: attempt.identity.candidates.find((candidate) => (
      candidate.value === attempt.identity.value
    ))?.label || attempt.identity.value,
    evidenceCount: attempt.evidenceCount,
    repairCost: attempt.repairCost,
    levelEvidenceCost: attempt.levelEvidenceCost,
    rmse: attempt.rmse,
    totalCost: attempt.totalCost,
  }))
  if (!decisive) {
    return {
      applied: false,
      attempts: summarizedAttempts,
      attemptGap,
      minimumAttemptGap,
      failure: 'attempt-gap-too-small',
    }
  }
  return {
    applied: true,
    level: best.level,
    levelInferred: levelWasInferred,
    panelStats: best.panelStats,
    panelStatOcr: best.panelStatOcr,
    identity: {
      ...best.identity,
      diagnostics: {
        ...best.identity.diagnostics,
        constraintAttempts: summarizedAttempts,
        constraintAttemptGap: attemptGap,
        minimumConstraintAttemptGap: minimumAttemptGap,
      },
    },
    attempts: summarizedAttempts,
    attemptGap,
    minimumAttemptGap,
  }
}
