import {
  ROCK_SCANNER_PORTRAIT_GRID,
} from '../../domain/rockKingdomScanner.js'
import fixedPortraitSamples from './fixedPortraitSamples.json' with { type: 'json' }

export const ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE = 24
const CACHE_KEY = 'tangerine-tools:rock-scanner:portrait-samples:v3'
const fixedDescriptorCache = new Map()

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
  return selectedPortraitRingMetricsRegion(imageData, {
    x: 0,
    y: 0,
    width: imageData?.width || 0,
    height: imageData?.height || 0,
  }).score
}

function selectedPortraitRingMetricsRegion(imageData, rect) {
  const { data, width: imageWidth, height: imageHeight } = imageData
  const width = Math.max(0, Math.min(rect.width, imageWidth - rect.x))
  const height = Math.max(0, Math.min(rect.height, imageHeight - rect.y))
  if (!data?.length || width < 3 || height < 3) return { score: 0, outlineScore: 0 }
  let ringTotal = 0
  let selectionOutline = 0
  let ringEdges = 0
  let ringPixels = 0
  let innerTotal = 0
  let innerPixels = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const normalizedX = (x + 0.5) / width * 2 - 1
      const normalizedY = (y + 0.5) / height * 2 - 1
      const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2)
      const sourceX = rect.x + x
      const sourceY = rect.y + y
      const offset = (sourceY * imageWidth + sourceX) * 4
      const luminance = pixelLuminance(data, offset)
      if (radius >= 0.72 && radius <= 0.98 && !(normalizedX < -0.25 && normalizedY < -0.2)) {
        const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2])
        const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2])
        const horizontal = Math.abs(
          pixelLuminance(data, offset - 4) - pixelLuminance(data, offset + 4),
        )
        const vertical = Math.abs(
          pixelLuminance(data, offset - imageWidth * 4)
          - pixelLuminance(data, offset + imageWidth * 4),
        )
        ringTotal += Math.max(0, luminance - 130) / 125
        const chroma = (maximum - minimum) / 255
        const edge = Math.min(1, Math.max(horizontal, vertical) / 70)
        ringEdges += edge
        const whiteOutline = Math.max(0, Math.min(1, (luminance - 190) / 55))
          * Math.max(0, 1 - chroma * 1.8)
        selectionOutline += whiteOutline * (0.45 + edge * 0.55)
        ringPixels += 1
      } else if (radius <= 0.58) {
        innerTotal += luminance
        innerPixels += 1
      }
    }
  }
  if (!ringPixels || !innerPixels) return { score: 0, outlineScore: 0 }
  const brightRing = ringTotal / ringPixels
  const outlinedRing = selectionOutline / ringPixels
  const edgeRing = ringEdges / ringPixels
  const contrast = Math.max(0, brightRing - innerTotal / innerPixels / 255)
  const score = brightRing * 0.05
    + edgeRing * 0.08
    + contrast * 0.07
    + outlinedRing * 0.8
  return { score, outlineScore: outlinedRing }
}

export function detectSelectedPortraitCellFromImageData(
  imageData,
  {
    sourceWidth = imageData?.width || 0,
    sourceHeight = imageData?.height || 0,
    minimumScore = 0.012,
    minimumGap = 0.0015,
  } = {},
) {
  const width = Number(imageData?.width) || 0
  const height = Number(imageData?.height) || 0
  if (!imageData?.data?.length || !width || !height || !sourceWidth || !sourceHeight) return null
  const ranked = []
  for (let row = 0; row < ROCK_SCANNER_PORTRAIT_GRID.rows.length; row += 1) {
    for (let column = 0; column < ROCK_SCANNER_PORTRAIT_GRID.columns.length; column += 1) {
      const metrics = selectedPortraitRingMetricsRegion(
        imageData,
        cellRect(width, height, column, row),
      )
      ranked.push({
        row,
        column,
        rect: cellRect(sourceWidth, sourceHeight, column, row),
        ...metrics,
      })
    }
  }
  ranked.sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const gap = best ? best.score - (ranked[1]?.score || 0) : 0
  if (
    best
    && best.score >= minimumScore
    && (
      best.outlineScore >= 0.03
      || (best.outlineScore >= 0.025 && gap >= Math.max(0.01, minimumGap))
    )
  ) return { ...best, key: `${best.row}:${best.column}`, ranked }

  return null
}

export function detectSelectedPortraitCell(source, { minimumScore = 0.012, minimumGap = 0.0015 } = {}) {
  const { width, height } = sourceDimensions(source)
  if (!width || !height) return null
  const scale = Math.min(1, 640 / width)
  const detectionWidth = Math.max(1, Math.round(width * scale))
  const detectionHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = detectionWidth
  canvas.height = detectionHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0, width, height, 0, 0, detectionWidth, detectionHeight)
  const imageData = context.getImageData(0, 0, detectionWidth, detectionHeight)
  return detectSelectedPortraitCellFromImageData(imageData, {
    sourceWidth: width,
    sourceHeight: height,
    minimumScore,
    minimumGap,
  })
}

export function captureRockPortraitSelection(source) {
  const selected = detectSelectedPortraitCell(source)
  return selected
    ? {
        key: selected.key,
        score: selected.score,
      }
    : null
}

function descriptorCanvas(source, rect = null) {
  const { width, height } = sourceDimensions(source)
  const canvas = document.createElement('canvas')
  canvas.width = ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE
  canvas.height = ROCK_SCANNER_PORTRAIT_DESCRIPTOR_SIZE
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

export function portraitEdgeDescriptorFromImageData({ data, width, height }) {
  const edges = new Uint8Array(width * height)
  const luminanceValues = new Uint8Array(width * height)
  const redGreenValues = new Int16Array(width * height)
  const blueYellowValues = new Int16Array(width * height)
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
      const index = y * width + x
      const luminance = pixelLuminance(data, offset)
      const foreground = Math.max(0, Math.min(1, (luminance - 55) / 70))
      edges[index] = Math.min(
        255,
        Math.round(Math.sqrt(horizontal ** 2 + vertical ** 2) * foreground),
      )
      luminanceValues[index] = Math.round(Math.max(0, luminance - 55))
      redGreenValues[index] = Math.round((data[offset] - data[offset + 1]) * foreground)
      blueYellowValues[index] = Math.round(
        (data[offset + 2] - (data[offset] + data[offset + 1]) / 2) * foreground,
      )
    }
  }
  return [...edges, ...luminanceValues, ...redGreenValues, ...blueYellowValues]
}

export function portraitEdgeDescriptor(source, rect = null) {
  const canvas = descriptorCanvas(source, rect)
  return portraitEdgeDescriptorFromImageData(
    canvas.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height),
  )
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

function normalizedPortraitLabel(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
}

function fixedSampleDescriptor(sample) {
  if (fixedDescriptorCache.has(sample.source)) return fixedDescriptorCache.get(sample.source)
  if (!sample.descriptorBase64 || typeof atob !== 'function') return []
  const binary = atob(sample.descriptorBase64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const descriptor = [...new Int16Array(bytes.buffer)]
  fixedDescriptorCache.set(sample.source, descriptor)
  return descriptor
}

function fixedSamplesForCandidate(candidate) {
  const labels = [candidate.label, ...(candidate.aliases || [])]
    .map(normalizedPortraitLabel)
  return fixedPortraitSamples
    .filter((sample) => labels.includes(normalizedPortraitLabel(sample.label)))
    .map(fixedSampleDescriptor)
    .filter((descriptor) => descriptor.length)
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
    .map((candidate) => ({
      candidate,
      samples: [
        ...(learnedSamples[candidate.value] || []),
        ...fixedSamplesForCandidate(candidate),
      ],
    }))
    .filter(({ samples }) => samples.length)
    .map(({ candidate, samples }) => ({
      ...candidate,
      visualScore: Math.max(
        ...samples.map((sample) => portraitDescriptorSimilarity(descriptor, sample)),
      ),
      visualSource: learnedSamples[candidate.value]?.length ? 'learned' : 'fixed',
    }))
    .sort((left, right) => right.visualScore - left.visualScore)
  return {
    descriptor,
    selectedCell,
    ranked: learnedRanked,
  }
}
