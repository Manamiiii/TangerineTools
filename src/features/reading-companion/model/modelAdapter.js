import {
  OBSERVED_ENTITY_KIND,
  OBSERVED_PLACE_KIND,
} from '../domain/readingCompanion.js'

const VALID_KINDS = new Set(Object.values(OBSERVED_ENTITY_KIND))
const VALID_PLACE_KINDS = new Set(Object.values(OBSERVED_PLACE_KIND))
const modelResultCache = new Map()
const MAX_MODEL_CACHE_ENTRIES = 30

export const READING_MODEL_STORAGE_KEYS = {
  provider: 'readerModelProvider',
  endpoint: 'readerModelEndpoint',
  model: 'readerModelName',
  apiKey: 'readerModelApiKey',
}

function requiredText(value, message) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(message)
  return text
}

function normalizeEndpoint(value) {
  const endpoint = requiredText(value, '请填写模型接口地址')
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('模型接口地址无效')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('模型接口必须使用 HTTPS；本机 localhost 可以使用 HTTP')
  }
  return url.href
}

function parseJsonObject(content) {
  const text = requiredText(content, '模型没有返回内容')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('模型返回的不是有效 JSON')
  }
}

function cachedModelResult(key) {
  const result = modelResultCache.get(key)
  if (!result) return null
  modelResultCache.delete(key)
  modelResultCache.set(key, result)
  return structuredClone(result)
}

function storeModelResult(key, result) {
  modelResultCache.set(key, structuredClone(result))
  while (modelResultCache.size > MAX_MODEL_CACHE_ENTRIES) {
    modelResultCache.delete(modelResultCache.keys().next().value)
  }
  return result
}

function modelCacheKey(kind, values) {
  return `${kind}:${JSON.stringify(values)}`
}

async function requestModelJson({
  url,
  modelName,
  key,
  temperature,
  messages,
  fetchImpl,
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  let response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        temperature: Number.isFinite(temperature)
          ? Math.max(0, Math.min(2, temperature))
          : 0,
        messages,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('模型请求超时')
    throw new Error(`模型请求失败：${error?.message || '网络不可用或接口不允许浏览器访问'}`)
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message || ''
    } catch {
      // The status is enough when a provider does not return JSON.
    }
    throw new Error(`模型接口返回 ${response.status}${detail ? `：${detail}` : ''}`)
  }
  const body = await response.json()
  return parseJsonObject(body?.choices?.[0]?.message?.content)
}

export function normalizeModelCandidates(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  const seen = new Set()
  return candidates.slice(0, 20).flatMap((candidate) => {
    const name = typeof candidate?.name === 'string'
      ? candidate.name.normalize('NFKC').trim()
      : ''
    const kind = VALID_KINDS.has(candidate?.kind)
      ? candidate.kind
      : OBSERVED_ENTITY_KIND.CONCEPT
    const normalizedName = name.toLocaleLowerCase()
    if (!name || name.length > 80 || seen.has(`${kind}:${normalizedName}`)) return []
    seen.add(`${kind}:${normalizedName}`)
    const confidence = Number(candidate?.confidence)
    return [{
      name,
      kind,
      ...(kind === OBSERVED_ENTITY_KIND.PLACE
        ? {
            placeKind: VALID_PLACE_KINDS.has(candidate?.placeKind)
              ? candidate.placeKind
              : OBSERVED_PLACE_KIND.UNKNOWN,
          }
        : {}),
      confidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : null,
    }]
  })
}

export async function analyzeReadingExcerpt({
  endpoint,
  model,
  apiKey,
  temperature = 0,
  excerpt,
  bookTitle,
  chapterLabel,
  fetchImpl = globalThis.fetch,
}) {
  const url = normalizeEndpoint(endpoint)
  const modelName = requiredText(model, '请填写模型名称')
  const key = requiredText(apiKey, '请填写 API Key')
  const text = requiredText(excerpt, '请先放入当前正在阅读的小段文字')
  if (text.length > 12000) throw new Error('单次模型识别最多发送 12000 个字符')
  if (typeof fetchImpl !== 'function') throw new Error('当前环境无法调用模型接口')
  const cacheKey = modelCacheKey('excerpt', [
    url,
    modelName,
    text,
    bookTitle || '',
    chapterLabel || '',
  ])
  const cached = cachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    url,
    modelName,
    key,
    temperature,
    fetchImpl,
    messages: [
          {
            role: 'system',
            content: [
              '你是阅读伴侣的窄范围实体识别器。',
              '只识别用户段落中原样出现的人物、地点、概念或事件名称。',
              '不得补充关系、身份、剧情、未来事件、结局或段落外知识。',
              '地点无法仅凭段落确认是真实时，placeKind 必须为 unknown。',
              '只返回 JSON：{"candidates":[{"name":"原文名称","kind":"place|person|concept|event","placeKind":"unknown|real|fictional|prototype|approximate","confidence":0到1}]}。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `书籍：${bookTitle || '未知'}`,
              `当前阅读边界：${chapterLabel || '未知章节'}`,
              '以下是读者主动提供的当前小段：',
              text,
            ].join('\n'),
          },
    ],
  })
  return storeModelResult(cacheKey, normalizeModelCandidates(payload))
}

export async function suggestReadingPlaceQueries({
  endpoint,
  model,
  apiKey,
  temperature = 0,
  query,
  bookTitle = '',
  chapterLabel = '',
  fetchImpl = globalThis.fetch,
}) {
  const url = normalizeEndpoint(endpoint)
  const modelName = requiredText(model, '请填写模型名称')
  const key = requiredText(apiKey, '请填写 API Key')
  const text = requiredText(query, '请先填写地点搜索词')
  if (text.length > 120) throw new Error('地点搜索词不能超过 120 个字符')
  if (typeof fetchImpl !== 'function') throw new Error('当前环境无法调用模型接口')
  const cacheKey = modelCacheKey('place-query', [
    url,
    modelName,
    text,
    bookTitle,
    chapterLabel,
  ])
  const cached = cachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    url,
    modelName,
    key,
    temperature,
    fetchImpl,
    messages: [
          {
            role: 'system',
            content: [
              '你只为国际地图生成地点检索词候选。',
              '书名只用于判断历史译名、英文原名和可能的州或国家，不得输出剧情。',
              '候选按从精确到宽泛排序：优先给出现代英文名或历史机构名，最后一个候选给出其所在城市、州或地区，供精确对象未被地图收录时定位参考区域。',
              '最多返回 3 个互不重复的候选，不确定所在区域时不要猜测。',
              '只返回 JSON：{"queries":["候选1","候选2"]}。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `书籍：${bookTitle || '未知'}`,
              `阅读章节：${chapterLabel || '未知'}`,
              `作品中的地点名称：${text}`,
            ].join('\n'),
          },
    ],
  })
  const queries = (Array.isArray(payload?.queries)
    ? payload.queries
    : [payload?.query])
    .map((item) => (typeof item === 'string' ? item.normalize('NFKC').trim() : ''))
    .filter((item, index, all) => item && item.length <= 120 && all.indexOf(item) === index)
    .slice(0, 3)
  if (queries.length === 0) throw new Error('模型没有返回可用的地图搜索词')
  return storeModelResult(cacheKey, queries)
}

export async function translateReadingPlaceQuery(options) {
  const [query] = await suggestReadingPlaceQueries(options)
  return query
}

export async function analyzeReadingBookMetadata({
  endpoint,
  model,
  apiKey,
  temperature = 0,
  ocrText,
  fetchImpl = globalThis.fetch,
}) {
  const url = normalizeEndpoint(endpoint)
  const modelName = requiredText(model, '请填写模型名称')
  const key = requiredText(apiKey, '请填写 API Key')
  const text = requiredText(ocrText, '截图没有识别出文字')
  if (text.length > 12000) throw new Error('单次书籍信息识别最多发送 12000 个字符')
  if (typeof fetchImpl !== 'function') throw new Error('当前环境无法调用模型接口')
  const cacheKey = modelCacheKey('book-metadata', [url, modelName, text])
  const cached = cachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    url,
    modelName,
    key,
    temperature,
    fetchImpl,
    messages: [
      {
        role: 'system',
        content: [
          '你只从书籍详情页 OCR 文字中整理书目信息，不得凭常识补写截图里没有的信息。',
          '日期使用 YYYY-MM；译者使用字符串数组；没有的字段返回空值。',
          '只返回 JSON：{"title":"","author":"","translators":[],"publisher":"","isbn":"","publishedAt":"","originalLanguage":"","chapterCount":null}。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: text,
      },
    ],
  })
  const metadata = {
    title: typeof payload?.title === 'string' ? payload.title.trim().slice(0, 120) : '',
    author: typeof payload?.author === 'string' ? payload.author.trim().slice(0, 120) : '',
    translators: Array.isArray(payload?.translators)
      ? payload.translators
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
        .slice(0, 12)
      : [],
    publisher: typeof payload?.publisher === 'string' ? payload.publisher.trim().slice(0, 120) : '',
    isbn: typeof payload?.isbn === 'string' ? payload.isbn.replace(/[^\dX]/gi, '').slice(0, 13) : '',
    publishedAt: /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/u.test(payload?.publishedAt)
      ? payload.publishedAt
      : '',
    originalLanguage: typeof payload?.originalLanguage === 'string'
      ? payload.originalLanguage.trim().slice(0, 20)
      : '',
    chapterCount: Number.isInteger(Number(payload?.chapterCount))
      && Number(payload.chapterCount) >= 1
      && Number(payload.chapterCount) <= 1000
      ? Number(payload.chapterCount)
      : null,
  }
  return storeModelResult(cacheKey, metadata)
}
