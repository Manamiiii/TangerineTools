import {
  ROCK_SCANNER_PORTRAIT_GRID,
} from '../../domain/rockKingdomScanner.js'

const DESCRIPTOR_SIZE = 24
const CACHE_KEY = 'tangerine-tools:rock-scanner:portrait-samples:v1'

function sourceDimensions(source) {
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  }
}

function cellRect(width, height, column, row) {
  const centerX = ROCK_SCANNER_PORTRAIT_GRID.columns[column] * width
  const centerY = ROCK_SCANNER_PORTRAIT_GRID.rows[row] * height
  return {
    x: Math.round(centerX - ROCK_SCANNER_PORTRAIT_GRID.width * width / 2),
    y: Math.round(centerY - ROCK_SCANNER_PORTRAIT_GRID.height * height / 2),
    width: Math.round(ROCK_SCANNER_PORTRAIT_GRID.width * width),
    height: Math.round(ROCK_SCANNER_PORTRAIT_GRID.height * height),
  }
}

function pixelLuminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
}

export function selectedPortraitRingScore(imageData) {
  const { data, width, height } = imageData
  if (!data?.length || !width || !height) return 0
  let ringTotal = 0
  let ringEdges = 0
  let ringPixels = 0
  let innerTotal = 0
  let innerPixels = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const normalizedX = (x + 0.5) / width * 2 - 1
      const normalizedY = (y + 0.5) / height * 2 - 1
      const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2)
      const offset = (y * width + x) * 4
      const luminance = pixelLuminance(data, offset)
      if (radius >= 0.72 && radius <= 0.98 && !(normalizedX < -0.25 && normalizedY < -0.2)) {
        const horizontal = Math.abs(
          pixelLuminance(data, offset - 4) - pixelLuminance(data, offset + 4),
        )
        const vertical = Math.abs(
          pixelLuminance(data, offset - width * 4) - pixelLuminance(data, offset + width * 4),
        )
        ringTotal += Math.max(0, luminance - 130) / 125
        ringEdges += Math.min(1, Math.max(horizontal, vertical) / 70)
        ringPixels += 1
      } else if (radius <= 0.58) {
        innerTotal += luminance
        innerPixels += 1
      }
    }
  }
  if (!ringPixels || !innerPixels) return 0
  const brightRing = ringTotal / ringPixels
  const edgeRing = ringEdges / ringPixels
  const contrast = Math.max(0, brightRing - innerTotal / innerPixels / 255)
  return brightRing * 0.48 + edgeRing * 0.34 + contrast * 0.18
}

export function detectSelectedPortraitCell(source, { minimumScore = 0.2, minimumGap = 0.015 } = {}) {
  const { width, height } = sourceDimensions(source)
  if (!width || !height) return null
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const ranked = []
  for (let row = 0; row < ROCK_SCANNER_PORTRAIT_GRID.rows.length; row += 1) {
    for (let column = 0; column < ROCK_SCANNER_PORTRAIT_GRID.columns.length; column += 1) {
      const rect = cellRect(width, height, column, row)
      canvas.width = Math.max(1, rect.width)
      canvas.height = Math.max(1, rect.height)
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
      ranked.push({
        row,
        column,
        rect,
        score: selectedPortraitRingScore(context.getImageData(0, 0, canvas.width, canvas.height)),
      })
    }
  }
  ranked.sort((left, right) => right.score - left.score)
  if (
    !ranked[0]
    || ranked[0].score < minimumScore
    || ranked[0].score - (ranked[1]?.score || 0) < minimumGap
  ) return null
  return { ...ranked[0], ranked }
}

export function captureRockPortraitSelection(source) {
  const { width, height } = sourceDimensions(source)
  if (!width || !height) return null
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 288
  canvas.getContext('2d').drawImage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height)
  const selected = detectSelectedPortraitCell(canvas)
  return selected
    ? {
        key: `${selected.row}:${selected.column}`,
        score: selected.score,
      }
    : null
}

function descriptorCanvas(source, rect = null) {
  const { width, height } = sourceDimensions(source)
  const canvas = document.createElement('canvas')
  canvas.width = DESCRIPTOR_SIZE
  canvas.height = DESCRIPTOR_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#101010'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (rect) {
    context.drawImage(
      source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } else {
    context.drawImage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height)
  }
  return canvas
}

export function portraitEdgeDescriptor(source, rect = null) {
  const canvas = descriptorCanvas(source, rect)
  const { data, width, height } = canvas
    .getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, canvas.width, canvas.height)
  const values = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const normalizedX = (x + 0.5) / width * 2 - 1
      const normalizedY = (y + 0.5) / height * 2 - 1
      const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2)
      if (radius > 0.7 || (normalizedX < -0.3 && normalizedY < -0.3)) continue
      const offset = (y * width + x) * 4
      const horizontal = Math.abs(
        pixelLuminance(data, offset - 4) - pixelLuminance(data, offset + 4),
      )
      const vertical = Math.abs(
        pixelLuminance(data, offset - width * 4) - pixelLuminance(data, offset + width * 4),
      )
      values[y * width + x] = Math.min(255, Math.round(Math.sqrt(horizontal ** 2 + vertical ** 2)))
    }
  }
  return [...values]
}

export function portraitDescriptorSimilarity(left = [], right = []) {
  if (!left.length || left.length !== right.length) return 0
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] ** 2
    rightMagnitude += right[index] ** 2
  }
  return dot / Math.max(Math.sqrt(leftMagnitude * rightMagnitude), Number.EPSILON)
}

function loadLearnedSamples() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function rememberRockPortrait(referenceId, descriptor) {
  if (!referenceId || !descriptor?.length) return
  const samples = loadLearnedSamples()
  const current = Array.isArray(samples[referenceId]) ? samples[referenceId] : []
  if (current.some((sample) => portraitDescriptorSimilarity(sample, descriptor) >= 0.985)) return
  samples[referenceId] = [...current, descriptor].slice(-4)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(samples))
  } catch {
    // 识别样本只是可重建缓存；存储空间不足时不影响正式收集记录。
  }
}

export function recognizeRockPortrait(source, candidates) {
  const selectedCell = detectSelectedPortraitCell(source)
  if (!selectedCell) return { descriptor: null, selectedCell: null, ranked: [] }
  const descriptor = portraitEdgeDescriptor(source, selectedCell.rect)
  const learnedSamples = loadLearnedSamples()
  const learnedRanked = candidates
    .filter((candidate) => learnedSamples[candidate.value]?.length)
    .map((candidate) => ({
      ...candidate,
      visualScore: Math.max(
        ...learnedSamples[candidate.value]
          .map((sample) => portraitDescriptorSimilarity(descriptor, sample)),
      ),
      visualSource: 'learned',
    }))
    .sort((left, right) => right.visualScore - left.visualScore)
  return {
    descriptor,
    selectedCell,
    ranked: learnedRanked,
  }
}
