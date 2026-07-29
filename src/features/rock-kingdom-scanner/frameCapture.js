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
