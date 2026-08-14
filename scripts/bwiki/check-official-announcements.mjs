import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { BWIKI_PATHS, resolveRepoPath } from './lib/paths.mjs'
import {
  buildAnnouncementAudit,
  isAnnouncementCandidate,
  parseJsonp,
  renderAnnouncementReport,
} from './lib/official-announcements.mjs'

const GAME_ID = 467
const ANNOUNCEMENT_TAG_ID = 135110
const DEFAULT_PAGE_SIZE = 50

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
}

async function fetchTextWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'TangerineTools official announcement audit' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 500)
    }
  }
  throw lastError
}

function readPageSize() {
  const rawValue = process.env.ROCOM_ANNOUNCEMENT_LIMIT ?? String(DEFAULT_PAGE_SIZE)
  const value = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('ROCOM_ANNOUNCEMENT_LIMIT 必须是 1 到 100 的整数')
  }
  return value
}

function readSince() {
  const rawValue = process.env.ROCOM_ANNOUNCEMENT_SINCE?.trim()
  if (!rawValue) return null
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00+08:00` : rawValue)
  if (Number.isNaN(timestamp)) throw new Error('ROCOM_ANNOUNCEMENT_SINCE 必须是有效日期')
  return new Date(timestamp).toISOString()
}

async function fetchAnnouncementRows(pageSize) {
  const listUrl = new URL('https://apps.game.qq.com/wmp/v3.1/')
  for (const [key, value] of Object.entries({
    p0: GAME_ID,
    p1: 'searchNewsKeywordsList',
    page: 1,
    pagesize: pageSize,
    order: 'sIdxTime',
    r0: 'script',
    r1: 'NewsObj',
    type: 'iTag',
    id: ANNOUNCEMENT_TAG_ID,
    source: 'web_pc',
  })) listUrl.searchParams.set(key, String(value))

  const payload = parseJsonp(await fetchTextWithRetry(listUrl), 'NewsObj')
  if (payload.status !== 0 || !Array.isArray(payload.msg?.result)) throw new Error('官方公告列表响应格式异常')
  return payload.msg.result
}

async function fetchAnnouncementDetail(id) {
  const detailUrl = new URL('https://apps.game.qq.com/wmp/v3.1/public/searchNews.php')
  detailUrl.searchParams.set('p0', String(GAME_ID))
  detailUrl.searchParams.set('source', 'web_pc')
  detailUrl.searchParams.set('id', String(id))
  const payload = parseJsonp(await fetchTextWithRetry(detailUrl), 'searchObj')
  if (payload.status !== 0 || !payload.msg) throw new Error(`官方公告 ${id} 详情响应格式异常`)
  return payload.msg
}

async function writeAudit(audit) {
  const jsonPath = resolveRepoPath(BWIKI_PATHS.artifacts.officialAnnouncementsJson)
  const reportPath = resolveRepoPath(BWIKI_PATHS.artifacts.officialAnnouncementsReport)
  await Promise.all([mkdir(dirname(jsonPath), { recursive: true }), mkdir(dirname(reportPath), { recursive: true })])
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8'),
    writeFile(reportPath, renderAnnouncementReport(audit), 'utf8'),
  ])
  return { jsonPath, reportPath }
}

export async function main() {
  const rows = await fetchAnnouncementRows(readPageSize())
  const candidateRows = rows.filter((row) => isAnnouncementCandidate(row.sTitle))
  const detailPairs = await Promise.all(
    candidateRows.map(async (row) => [String(row.iNewsId), await fetchAnnouncementDetail(row.iNewsId)]),
  )
  const audit = buildAnnouncementAudit({
    rows,
    detailsById: new Map(detailPairs),
    since: readSince(),
    generatedAt: new Date().toISOString(),
  })
  const outputs = await writeAudit(audit)

  console.log(`官方公告：${audit.summary.sourceRows} 条，候选 ${audit.summary.candidates} 条`)
  console.log(`需人工查看图片：${audit.summary.manualImageReviews} 条`)
  console.log(`JSON：${outputs.jsonPath}`)
  console.log(`报告：${outputs.reportPath}`)
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
