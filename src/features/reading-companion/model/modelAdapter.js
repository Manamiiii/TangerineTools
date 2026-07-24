import {
  OBSERVED_ENTITY_KIND,
  OBSERVED_PLACE_KIND,
} from '../domain/readingCompanion.js'

const VALID_KINDS = new Set(Object.values(OBSERVED_ENTITY_KIND))
const VALID_PLACE_KINDS = new Set(Object.values(OBSERVED_PLACE_KIND))

export const READING_MODEL_STORAGE_KEYS = {
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
      reason: typeof candidate?.reason === 'string'
        ? candidate.reason.trim().slice(0, 160)
        : '',
    }]
  })
}

export async function analyzeReadingExcerpt({
  endpoint,
  model,
  apiKey,
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
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: [
              '你是阅读伴侣的窄范围实体识别器。',
              '只识别用户段落中原样出现的人物、地点、概念或事件名称。',
              '不得补充关系、身份、剧情、未来事件、结局或段落外知识。',
              '地点无法仅凭段落确认是真实时，placeKind 必须为 unknown。',
              '只返回 JSON：{"candidates":[{"name":"原文名称","kind":"place|person|concept|event","placeKind":"unknown|real|fictional|prototype|approximate","confidence":0到1,"reason":"仅说明原文证据"}]}。',
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
  const content = body?.choices?.[0]?.message?.content
  return normalizeModelCandidates(parseJsonObject(content))
}
