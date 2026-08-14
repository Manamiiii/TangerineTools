const TITLE_PATTERNS = [
  /版本更新/,
  /赛季更新/,
  /更新公告/,
  /(?:平衡|技能|精灵|数值).{0,12}(?:调整|改动|优化)/,
  /(?:调整|改动|优化).{0,12}(?:平衡|技能|精灵|数值)/,
]

const BALANCE_SIGNALS = [
  '平衡性调整',
  '平衡调整',
  '种族值调整',
  '数值调整',
  '技能调整',
  '特性调整',
  '技能威力',
  '技能能耗',
]

export function parseJsonp(source, expectedVariable) {
  const escapedVariable = expectedVariable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(source ?? '').replace(/^\uFEFF/, '').match(
    new RegExp(`^\\s*var\\s+${escapedVariable}\\s*=\\s*([\\s\\S]*?)\\s*;?\\s*$`),
  )
  if (!match) throw new Error(`无法解析 JSONP：缺少 ${expectedVariable}`)
  return JSON.parse(match[1])
}

export function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
}

export function extractPlainText(html) {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/p\s*>|<\/div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractImageUrls(html) {
  const urls = []
  for (const match of String(html ?? '').matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
    const rawUrl = decodeHtml(match[2]).trim()
    if (!rawUrl) continue
    urls.push(rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl)
  }
  return [...new Set(urls)]
}

export function isAnnouncementCandidate(title) {
  const normalizedTitle = String(title ?? '').trim()
  return TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))
}

export function findBalanceSignals(text) {
  const normalizedText = String(text ?? '')
  return BALANCE_SIGNALS.filter((signal) => normalizedText.includes(signal))
}

export function normalizeAnnouncement(listRow, detail = {}) {
  const id = String(detail.iNewsId ?? listRow.iNewsId ?? '').trim()
  const title = String(detail.sTitle ?? listRow.sTitle ?? '').trim()
  const publishedAt = String(detail.sIdxTime ?? listRow.sIdxTime ?? detail.sCreated ?? listRow.sCreated ?? '').trim()
  const contentHtml = String(detail.sContent ?? '')
  const plainText = extractPlainText(contentHtml)
  const imageUrls = extractImageUrls(contentHtml)
  const balanceSignals = findBalanceSignals(plainText)
  const needsImageReview = imageUrls.length > 0 && plainText.length < 80

  let reviewStatus = 'candidate-review'
  if (balanceSignals.length > 0) reviewStatus = 'balance-signal-found'
  else if (needsImageReview) reviewStatus = 'manual-image-review'

  return {
    id,
    title,
    publishedAt,
    author: String(detail.sAuthor ?? listRow.sAuthor ?? '').trim(),
    officialUrl: `https://rocom.qq.com/main/sub/detail.html?newsid=${encodeURIComponent(id)}`,
    reviewStatus,
    needsImageReview,
    balanceSignals,
    textLength: plainText.length,
    textPreview: plainText.slice(0, 240),
    imageCount: imageUrls.length,
    imageUrls,
  }
}

export function buildAnnouncementAudit({ rows, detailsById = new Map(), since = null, generatedAt }) {
  const sinceTimestamp = since ? Date.parse(since) : Number.NEGATIVE_INFINITY
  if (since && Number.isNaN(sinceTimestamp)) throw new Error(`无效的起始日期：${since}`)

  const eligibleRows = rows.filter((row) => {
    if (!isAnnouncementCandidate(row.sTitle)) return false
    if (!since) return true
    const publishedTimestamp = Date.parse(String(row.sIdxTime ?? row.sCreated ?? '').replace(' ', 'T') + '+08:00')
    return !Number.isNaN(publishedTimestamp) && publishedTimestamp >= sinceTimestamp
  })
  const announcements = eligibleRows.map((row) => normalizeAnnouncement(row, detailsById.get(String(row.iNewsId))))

  return {
    generatedAt,
    source: {
      name: '腾讯游戏内容开放平台 · 洛克王国世界官方公告',
      gameId: 467,
      tagId: 135110,
      since,
    },
    summary: {
      sourceRows: rows.length,
      candidates: announcements.length,
      balanceSignalsFound: announcements.filter((item) => item.reviewStatus === 'balance-signal-found').length,
      manualImageReviews: announcements.filter((item) => item.needsImageReview).length,
    },
    announcements,
  }
}

export function renderAnnouncementReport(audit) {
  const statusLabels = {
    'balance-signal-found': '正文发现平衡信号',
    'manual-image-review': '需人工查看图片',
    'candidate-review': '需人工复核',
  }
  const lines = [
    '# 洛克王国世界官方公告审计',
    '',
    `- 生成时间：${audit.generatedAt}`,
    `- 官方列表行数：${audit.summary.sourceRows}`,
    `- 版本 / 平衡候选：${audit.summary.candidates}`,
    `- 需人工查看图片：${audit.summary.manualImageReviews}`,
    `- 起始日期：${audit.source.since ?? '未限制'}`,
    '',
    '> 本报告只用于确定资料复核范围，不会修改 BWiki staging、正式预置或用户数据。图片型公告必须人工查看。',
    '',
    '| 日期 | 公告 | 状态 | 正文 / 图片 | 命中信号 |',
    '|---|---|---|---:|---|',
  ]

  for (const item of audit.announcements) {
    const safeTitle = item.title.replace(/\|/g, '\\|')
    const signals = item.balanceSignals.length > 0 ? item.balanceSignals.join('、') : '—'
    lines.push(
      `| ${item.publishedAt || '—'} | [${safeTitle}](${item.officialUrl}) | ${statusLabels[item.reviewStatus]} | ${item.textLength} 字 / ${item.imageCount} 图 | ${signals} |`,
    )
  }

  if (audit.announcements.length === 0) lines.push('| — | 没有符合条件的候选公告 | — | — | — |')
  lines.push('', '## 人工复核结果', '', '- [ ] 打开候选公告，逐张查看图片型正文。', '- [ ] 记录受影响的精灵、技能、特性和字段。', '- [ ] 回到 BWiki staging 核对正式字段，再走 preview / apply。', '')
  return `${lines.join('\n')}\n`
}
