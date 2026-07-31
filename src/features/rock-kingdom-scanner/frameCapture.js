function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('无法生成画面图片。'))
    }, type, quality)
  })
}

export async function captureVideoFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) throw new Error('视频画面尚未加载完成。')
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  const blob = await canvasToBlob(canvas)
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    time: video.currentTime,
  }
}

export function waitForVideoSeek(video, time) {
  const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05))
  if (!video.seeking && Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('读取视频画面失败。'))
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = target
  })
}

export async function sampleVideoFramesSequentially(video, {
  stepSeconds,
  playbackRate = 8,
  onSample,
} = {}) {
  if (typeof video?.requestVideoFrameCallback !== 'function') return null
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error('视频画面尚未加载完成。')
  }
  await waitForVideoSeek(video, 0)
  const originalMuted = video.muted
  const originalPlaybackRate = video.playbackRate
  const safeStep = Math.max(0.05, Number(stepSeconds) || 0.3)
  const expectedCount = Math.max(1, Math.ceil(video.duration / safeStep))
  let nextSampleTime = 0
  let sampledCount = 0
  let callbackId = null

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      if (callbackId != null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(callbackId)
      }
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
      video.pause()
      video.muted = originalMuted
      video.playbackRate = originalPlaybackRate
    }
    const finish = (result, error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(result)
    }
    const onEnded = () => finish({ sampledCount, expectedCount })
    const onError = () => finish(null, new Error('顺序读取视频画面失败。'))
    const onFrame = (_now, metadata) => {
      try {
        const mediaTime = Number.isFinite(metadata?.mediaTime) ? metadata.mediaTime : video.currentTime
        if (mediaTime + safeStep * 0.2 >= nextSampleTime) {
          onSample?.(mediaTime, sampledCount, expectedCount)
          sampledCount += 1
          nextSampleTime = (Math.floor(mediaTime / safeStep) + 1) * safeStep
        }
        if (mediaTime >= video.duration - 0.05) {
          finish({ sampledCount, expectedCount })
          return
        }
        callbackId = video.requestVideoFrameCallback(onFrame)
      } catch (error) {
        finish(null, error)
      }
    }

    video.addEventListener('ended', onEnded, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.muted = true
    video.playbackRate = playbackRate
    callbackId = video.requestVideoFrameCallback(onFrame)
    video.play().catch((error) => finish(null, error))
  })
}

export function captureVideoSignature(video, region, width = 120, height = 80) {
  if (!video?.videoWidth || !video?.videoHeight) throw new Error('视频画面尚未加载完成。')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const sourceX = Math.round(video.videoWidth * region.x)
  const sourceY = Math.round(video.videoHeight * region.y)
  const sourceWidth = Math.round(video.videoWidth * region.width)
  const sourceHeight = Math.round(video.videoHeight * region.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  )
  const rgba = context.getImageData(0, 0, width, height).data
  const signature = new Uint8Array(width * height)
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    signature[target] = Math.round(
      rgba[source] * 0.2126 + rgba[source + 1] * 0.7152 + rgba[source + 2] * 0.0722,
    )
  }
  return signature
}

export function captureVideoChangeSignature(video, regions, width = 64, rowHeight = 16) {
  if (!video?.videoWidth || !video?.videoHeight) throw new Error('视频画面尚未加载完成。')
  const heights = regions.map((region) => region.signatureHeight || rowHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = heights.reduce((sum, height) => sum + height, 0)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  let targetY = 0
  regions.forEach((region, index) => {
    context.drawImage(
      video,
      Math.round(video.videoWidth * region.x),
      Math.round(video.videoHeight * region.y),
      Math.round(video.videoWidth * region.width),
      Math.round(video.videoHeight * region.height),
      0,
      targetY,
      width,
      heights[index],
    )
    targetY += heights[index]
  })
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
  const signature = new Uint8Array(canvas.width * canvas.height)
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    signature[target] = Math.round(
      rgba[source] * 0.2126 + rgba[source + 1] * 0.7152 + rgba[source + 2] * 0.0722,
    )
  }
  return signature
}

export async function loadImageSource(source) {
  const image = new Image()
  image.decoding = 'async'
  image.src = source
  await image.decode()
  return image
}

export function cropImageSource(image, crop, scale = 3) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const sx = Math.round(sourceWidth * crop.x)
  const sy = Math.round(sourceHeight * crop.y)
  const sw = Math.max(1, Math.round(sourceWidth * crop.width))
  const sh = Math.max(1, Math.round(sourceHeight * crop.height))
  const canvas = document.createElement('canvas')
  canvas.width = sw * scale
  canvas.height = sh * scale
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

function luminance(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

export function prepareScannerTextCrop(source, { width = 768, height = 128 } = {}) {
  const sourceWidth = source.naturalWidth || source.width
  const sourceHeight = source.naturalHeight || source.height
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = sourceWidth
  sourceCanvas.height = sourceHeight
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  sourceContext.drawImage(source, 0, 0)
  const imageData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight)
  const values = []
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    values.push(luminance(
      imageData.data[offset],
      imageData.data[offset + 1],
      imageData.data[offset + 2],
    ))
  }
  const sorted = [...values].sort((left, right) => left - right)
  const upperQuartile = sorted[Math.floor(sorted.length * 0.75)] || 0
  const threshold = Math.max(120, Math.min(220, upperQuartile + 32))
  let left = sourceWidth
  let top = sourceHeight
  let right = -1
  let bottom = -1
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      if (values[y * sourceWidth + x] < threshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) return sourceCanvas

  const padding = 10
  left = Math.max(0, left - padding)
  top = Math.max(0, top - padding)
  right = Math.min(sourceWidth - 1, right + padding)
  bottom = Math.min(sourceHeight - 1, bottom + padding)
  const cropWidth = right - left + 1
  const cropHeight = bottom - top + 1
  const target = document.createElement('canvas')
  target.width = width
  target.height = height
  const targetContext = target.getContext('2d', { willReadFrequently: true })
  targetContext.fillStyle = '#000'
  targetContext.fillRect(0, 0, width, height)
  const scale = Math.min((width - 20) / cropWidth, (height - 20) / cropHeight)
  const drawWidth = Math.max(1, Math.round(cropWidth * scale))
  const drawHeight = Math.max(1, Math.round(cropHeight * scale))
  const drawX = Math.round((width - drawWidth) / 2)
  const drawY = Math.round((height - drawHeight) / 2)
  targetContext.imageSmoothingEnabled = true
  targetContext.imageSmoothingQuality = 'high'
  targetContext.drawImage(
    sourceCanvas,
    left,
    top,
    cropWidth,
    cropHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  )
  const normalized = targetContext.getImageData(0, 0, width, height)
  for (let offset = 0; offset < normalized.data.length; offset += 4) {
    const value = luminance(
      normalized.data[offset],
      normalized.data[offset + 1],
      normalized.data[offset + 2],
    ) >= threshold ? 0 : 255
    normalized.data[offset] = value
    normalized.data[offset + 1] = value
    normalized.data[offset + 2] = value
    normalized.data[offset + 3] = 255
  }
  targetContext.putImageData(normalized, 0, 0)
  return target
}
