import {
  cacheModelResult,
  modelCacheKey,
  readCachedModelResult,
  requestModelJson,
} from '../model/modelClient.js'

const SCANNER_FIELD_LABELS = {
  ref: '精灵',
  nature: '性格',
  bloodline: '血脉',
  specialty: '特长',
}

export const ROCK_MODEL_PROMPT_IDS = Object.freeze({
  scannerCorrection: 'rock-scanner-correction-v1',
  natureExplanation: 'rock-nature-explanation-v1',
  ownedDiagnostics: 'rock-owned-diagnostics-v1',
})

function boundedText(value, limit = 120) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, limit) : ''
}

function boundedList(value, limit = 6, itemLimit = 240) {
  return (Array.isArray(value) ? value : [])
    .map((item) => boundedText(item, itemLimit))
    .filter(Boolean)
    .slice(0, limit)
}

export async function correctRockScannerFields({
  config,
  fields,
  fetchImpl = globalThis.fetch,
}) {
  const requestedFields = fields.filter((field) => field.rawText && field.candidates.length > 0)
  if (requestedFields.length === 0) throw new Error('当前帧没有需要模型纠正的低置信字段')
  const request = requestedFields.map((field) => ({
    key: field.key,
    label: SCANNER_FIELD_LABELS[field.key] || field.key,
    ocrText: boundedText(field.rawText, 200),
    candidates: field.candidates.slice(0, 16).map((candidate) => ({
      value: String(candidate.value),
      label: boundedText(candidate.label, 100),
    })),
  }))
  const cacheKey = modelCacheKey(ROCK_MODEL_PROMPT_IDS.scannerCorrection, [
    config.endpoint,
    config.model,
    request,
  ])
  const cached = readCachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    ...config,
    fetchImpl,
    messages: [
      {
        role: 'system',
        content: [
          '你是洛克王国世界扫描录入的受限 OCR 纠错器。',
          '只能针对输入字段，从该字段 candidates 中选择；不得创造候选、不得凭游戏知识补全未出现的信息。',
          'OCR 不足以判断时返回空 value。reason 只说明字形或文本匹配依据，不评价精灵玩法。',
          '只返回 JSON：{"corrections":[{"key":"字段key","value":"候选value或空字符串","reason":"简短依据","confidence":0到1}]}。',
        ].join('\n'),
      },
      { role: 'user', content: JSON.stringify({ fields: request }) },
    ],
  })
  const byKey = new Map(requestedFields.map((field) => [
    field.key,
    new Set(field.candidates.map((candidate) => String(candidate.value))),
  ]))
  const seen = new Set()
  const corrections = (Array.isArray(payload?.corrections) ? payload.corrections : [])
    .flatMap((item) => {
      const key = typeof item?.key === 'string' ? item.key : ''
      const value = typeof item?.value === 'string' ? item.value : ''
      if (!byKey.get(key)?.has(value) || seen.has(key)) return []
      seen.add(key)
      const confidence = Number(item?.confidence)
      return [{
        key,
        value,
        reason: boundedText(item?.reason, 160),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
      }]
    })
  if (corrections.length === 0) throw new Error('模型没有返回可用的候选修正')
  return cacheModelResult(cacheKey, corrections)
}

export async function explainRockNature({
  config,
  context,
  fetchImpl = globalThis.fetch,
}) {
  const boundedContext = {
    creature: boundedText(context.creature, 120),
    nature: boundedText(context.nature, 80),
    decision: boundedText(context.decision, 20),
    modifier: boundedText(context.modifier, 80),
    role: boundedText(context.role, 160),
    reasons: boundedList(context.reasons),
    warnings: boundedList(context.warnings),
    retention: boundedText(context.retention, 320),
    mirrorTarget: boundedText(context.mirrorTarget, 80),
    stats: context.stats,
    skillSummary: boundedText(context.skillSummary, 320),
    speedSummary: boundedText(context.speedSummary, 240),
    formDecisions: (Array.isArray(context.formDecisions) ? context.formDecisions : [])
      .slice(0, 16)
      .map((item) => ({
        label: boundedText(item.label, 80),
        decision: boundedText(item.decision, 20),
      })),
  }
  const cacheKey = modelCacheKey(ROCK_MODEL_PROMPT_IDS.natureExplanation, [
    config.endpoint,
    config.model,
    boundedContext,
  ])
  const cached = readCachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    ...config,
    fetchImpl,
    messages: [
      {
        role: 'system',
        content: [
          '你负责把洛克王国世界性格工具已经算出的确定性结论解释成易懂中文。',
          'decision、修正方向、规则理由、风险和残缺魔镜目标都是不可改变的事实；不得另行推荐性格，不得使用输入外的游戏知识。',
          '重点解释收益、牺牲代价以及普通个体和稀有个体的处理差异。',
          '只返回 JSON：{"summary":"两三句总览","keyPoints":["最多4点"],"caution":"必要提醒或空字符串"}。',
        ].join('\n'),
      },
      { role: 'user', content: JSON.stringify(boundedContext) },
    ],
  })
  const result = {
    summary: boundedText(payload?.summary, 600),
    keyPoints: boundedList(payload?.keyPoints, 4, 240),
    caution: boundedText(payload?.caution, 320),
  }
  if (!result.summary) throw new Error('模型没有返回可用的性格解释')
  return cacheModelResult(cacheKey, result)
}

export async function explainRockOwnedDiagnostics({
  config,
  diagnostics,
  summary,
  fetchImpl = globalThis.fetch,
}) {
  const boundedDiagnostics = diagnostics.slice(0, 50).map((item) => ({
    creatureName: boundedText(item.creatureName, 80),
    natureLabel: boundedText(item.natureLabel, 40),
    appearance: boundedText(item.appearance, 40),
    decisionLabel: boundedText(item.decisionLabel, 20),
    actionLabel: boundedText(item.actionLabel, 80),
    mirrorTarget: boundedText(item.mirrorTarget, 40),
    issues: boundedList(item.issues, 5, 120),
  }))
  const cacheKey = modelCacheKey(ROCK_MODEL_PROMPT_IDS.ownedDiagnostics, [
    config.endpoint,
    config.model,
    summary,
    boundedDiagnostics,
  ])
  const cached = readCachedModelResult(cacheKey)
  if (cached) return cached
  const payload = await requestModelJson({
    ...config,
    fetchImpl,
    messages: [
      {
        role: 'system',
        content: [
          '你是洛克王国世界收集记录检查结果的说明助手。',
          '所有分档、残缺魔镜目标和字段问题都已由程序确定；不得改变结论、不得新增性格建议、不得声称修改了记录。',
          '按优先级概括用户选中记录：先字段问题，再银镜可修稀有个体，再已成型或可保留记录。',
          '只返回 JSON：{"summary":"简短总览","priorities":["最多5项"],"caution":"必要提醒或空字符串"}。',
        ].join('\n'),
      },
      { role: 'user', content: JSON.stringify({ summary, records: boundedDiagnostics }) },
    ],
  })
  const result = {
    summary: boundedText(payload?.summary, 600),
    priorities: boundedList(payload?.priorities, 5, 240),
    caution: boundedText(payload?.caution, 320),
  }
  if (!result.summary) throw new Error('模型没有返回可用的检查说明')
  return cacheModelResult(cacheKey, result)
}
