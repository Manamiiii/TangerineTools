let workerPromise = null
let metadataWorkerPromise = null
let progressListener = null

function cleanOcrLine(value) {
  let line = value
  let previous = ''
  while (line !== previous) {
    previous = line
    line = line
      .replace(/([\p{Script=Han}，。！？；：、“”‘’（）《》【】])\s+(?=[\p{Script=Han}，。！？；：、“”‘’（）《》【】])/gu, '$1')
      .replace(/\s+([，。！？；：、”’）》】])/gu, '$1')
      .replace(/([“‘（《【])\s+/gu, '$1')
  }
  return line
    .replace(/([\p{Script=Han}])\s*[.·]\s*(?=[\p{Script=Han}])/gu, '$1·')
    .replace(/[ \t]{2,}/g, ' ')
}

export function normalizeReadingOcrText(value, { preserveLines = false } = {}) {
  if (typeof value !== 'string') return ''
  const lines = value
    .normalize('NFKC')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const cleaned = lines
    .map(cleanOcrLine)
    .join(preserveLines ? '\n' : ' ')
  return (preserveLines
    ? cleaned
    : cleaned.replace(/([\p{Script=Han}，。！？；：、“”‘’（）《》【】])\s+(?=[\p{Script=Han}，。！？；：、“”‘’（）《》【】])/gu, '$1'))
    .trim()
}

function localLanguagePath() {
  return new URL('reader-ocr/', document.baseURI).href.replace(/\/$/, '')
}

async function createReadingOcrWorker() {
  const { createWorker, OEM } = await import('tesseract.js')
  return createWorker(['chi_sim', 'eng'], OEM.LSTM, {
    langPath: localLanguagePath(),
    logger: (message) => {
      if (typeof progressListener === 'function') progressListener(message)
    },
  })
}

async function createReadingMetadataOcrWorker() {
  const worker = await createReadingOcrWorker()
  await worker.setParameters({ tessedit_pageseg_mode: '6' })
  return worker
}

export async function recognizeReadingImage(image, onProgress, options) {
  if (!image) throw new Error('请先选择一张截图')
  progressListener = onProgress
  if (!workerPromise) {
    workerPromise = createReadingOcrWorker().catch((error) => {
      workerPromise = null
      throw error
    })
  }
  try {
    const worker = await workerPromise
    const result = await worker.recognize(image)
    return normalizeReadingOcrText(result?.data?.text, options)
  } finally {
    progressListener = null
  }
}

export async function recognizeReadingMetadataImage(image, onProgress) {
  if (!image) throw new Error('请先选择一张截图')
  progressListener = onProgress
  if (!metadataWorkerPromise) {
    metadataWorkerPromise = createReadingMetadataOcrWorker().catch((error) => {
      metadataWorkerPromise = null
      throw error
    })
  }
  try {
    const worker = await metadataWorkerPromise
    const result = await worker.recognize(image)
    return normalizeReadingOcrText(result?.data?.text, { preserveLines: true })
  } finally {
    progressListener = null
  }
}
