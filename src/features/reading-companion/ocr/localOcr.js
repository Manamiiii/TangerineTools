let workerPromise = null
let progressListener = null

export function normalizeReadingOcrText(value) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/([\p{Script=Han}，。！？；：、“”‘’（）《》【】])\s+(?=[\p{Script=Han}，。！？；：、“”‘’（）《》【】])/gu, '$1')
    .replace(/\s+([，。！？；：、”’）》】])/gu, '$1')
    .replace(/([“‘（《【])\s+/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
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

export async function recognizeReadingImage(image, onProgress) {
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
    return normalizeReadingOcrText(result?.data?.text)
  } finally {
    progressListener = null
  }
}
