import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CREATURE_STAGING = 'scripts/data/bwiki/creatures.staging.json'
const OUTPUT_JSON = 'scripts/data/bwiki/creature-details.sample.staging.json'
const OUTPUT_MD = 'docs/bwiki-detail-staging-report.md'
const DEFAULT_LIMIT = 24
const DEFAULT_DELAY_MS = 1000

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'TangerineTools BWiki detail staging' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch {
    const { stdout } = await execFileAsync('curl', ['-L', '--fail', '--silent', '--show-error', url], {
      maxBuffer: 80 * 1024 * 1024,
    })
    return stdout
  }
}


function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function fetchTextWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchText(url)
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(500 * attempt)
    }
  }
  throw lastError
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function stripTags(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractAttr(tag, attr) {
  const pattern = new RegExp(`${attr}=(['"])(.*?)\\1`, 'i')
  return tag.match(pattern)?.[2] ?? ''
}

function absoluteUrl(url, baseUrl) {
  if (!url) return ''
  return new URL(decodeHtml(url), baseUrl).href
}

function extractFirstImage(html, baseUrl) {
  const img = html.match(/<img\b[^>]*>/i)?.[0] ?? ''
  const src = extractAttr(img, 'data-src') || extractAttr(img, 'src')
  return absoluteUrl(src, baseUrl)
}

function getMatch(html, pattern) {
  return html.match(pattern)?.[1] ?? ''
}

function parseTrait(html, baseUrl) {
  const traitBlock = html.match(/<div class="sprite-info-trait"[\s\S]*?<\/div><\/div><\/div>/i)?.[0] ?? ''
  return {
    name: stripTags(getMatch(traitBlock, /<span class="sprite-trait-name">([\s\S]*?)<\/span>/i)),
    description: stripTags(getMatch(traitBlock, /<div class="sprite-trait-desc">([\s\S]*?)<\/div>/i)),
    image: extractFirstImage(traitBlock, baseUrl),
  }
}

function parseSkillCards(html, baseUrl) {
  return html
    .split('<div class="divsort skill-single"')
    .slice(1)
    .map((segment) => {
      const block = `<div class="divsort skill-single"${segment}`
      const openTag = block.match(/<div class="divsort skill-single"[^>]*>/i)?.[0] ?? ''
      const attrs = {
        param1: decodeHtml(openTag.match(/data-param1=(["'])(.*?)\1/i)?.[2] ?? '').trim(),
        param2: decodeHtml(openTag.match(/data-param2=(["'])(.*?)\1/i)?.[2] ?? '').trim(),
        param3: decodeHtml(openTag.match(/data-param3=(["'])(.*?)\1/i)?.[2] ?? '').trim(),
      }
      const skillDetailTag = block.match(/<a\b[^>]*class="skill-detail-link"[^>]*>/i)?.[0] ?? ''
      const detailHref = extractAttr(skillDetailTag, 'href')
      return {
        sourceType: attrs.param1 || '',
        category: attrs.param2 || '',
        element: attrs.param3 || '',
        name: stripTags(getMatch(block, /<span class="skill-name[^>]*">([\s\S]*?)<\/span>/i)),
        effect: stripTags(getMatch(block, /<div class="skill-desc-atk">([\s\S]*?)<\/div>/i)),
        story: stripTags(getMatch(block, /<div class="skill-desc-story">([\s\S]*?)<\/div>/i)),
        unlock: stripTags(getMatch(block, /<div class="skill-source">([\s\S]*?)<\/div>/i)),
        image: extractFirstImage(block, baseUrl),
        detailUrl: detailHref ? absoluteUrl(detailHref, baseUrl) : '',
      }
    })
    .filter((skill) => skill.name)
}

function parseEvolutionChains(html, baseUrl) {
  const tab = html.match(/<div class="d-tab sprite-evolve-tab">[\s\S]*?(?=<\/div>\s*<\/div>\s*<div class="sprite-feature-extra|<\/div>\s*<noscript>|$)/i)?.[0] ?? ''
  return [...tab.matchAll(/<div class="sprite-evolve-section">([\s\S]*?)(?=<div class="sprite-evolve-section">|<\/div>\s*<\/div>\s*<\/div>|$)/gi)]
    .map((match) => {
      const block = match[0]
      const btn = block.match(/<div class="sprite-evolve-btn"[^>]*>/i)?.[0] ?? ''
      return {
        name: stripTags(getMatch(block, /<span class="sprite-evolve-name">([\s\S]*?)<\/span>/i)),
        linkName: decodeHtml(btn.match(/data-link=(["'])(.*?)\1/i)?.[2] ?? '').trim(),
        condition: stripTags(getMatch(block, /<div class="sprite-evolve-cond">([\s\S]*?)<\/div>/i)),
        image: extractFirstImage(block, baseUrl),
      }
    })
    .filter((step) => step.name || step.linkName)
}

function parseDetail(row, html) {
  const baseUrl = row.detailUrl
  const trait = parseTrait(html, baseUrl)
  const skills = parseSkillCards(html, baseUrl)
  const evolution = parseEvolutionChains(html, baseUrl)
  return {
    source: 'bwiki-creature-detail',
    sourceUrl: row.detailUrl,
    no: row.no,
    name: row.name,
    trait,
    skills,
    evolution,
    counts: {
      skills: skills.length,
      defaultSkills: skills.filter((skill) => skill.sourceType === '默认').length,
      bloodlineSkills: skills.filter((skill) => skill.sourceType === '血脉').length,
      skillStoneSkills: skills.filter((skill) => skill.sourceType === '技能石').length,
      evolutionSteps: evolution.length,
      hasTraitDescription: Boolean(trait.description),
    },
  }
}

function formatEvolutionSummary(evolution = []) {
  const names = evolution.map((step) => step.name || step.linkName).filter(Boolean)
  if (names.length === 0) return '（无）'
  const first = names[0]
  const branchStarts = names.map((name, index) => (name === first ? index : -1)).filter((index) => index >= 0)
  const branches = branchStarts.map((start, index) => {
    const end = branchStarts[index + 1] ?? names.length
    return names.slice(start, end)
  }).filter((branch) => branch.length > 0)
  if (branches.length <= 1) return names.join(' → ')

  let commonLength = 0
  while (branches.every((branch) => branch[commonLength] && branch[commonLength] === branches[0][commonLength])) {
    commonLength += 1
  }
  const commonPrefix = branches[0].slice(0, commonLength)
  const suffixes = branches.map((branch) => branch.slice(commonLength)).filter((suffix) => suffix.length > 0)
  if (commonPrefix.length > 0 && suffixes.length === branches.length) {
    return `${commonPrefix.join(' → ')} →（${suffixes.map((suffix) => suffix.join(' → ')).join(' / ')}）`
  }
  return branches.map((branch) => branch.join(' → ')).join('；')
}


function countBy(rows, getter) {
  const result = {}
  for (const row of rows) {
    const key = getter(row) || '（空）'
    result[key] = (result[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN')))
}

function renderCountTable(counts) {
  return Object.entries(counts).map(([label, count]) => `| ${label} | ${count} |`).join('\n') || '| （无） | 0 |'
}

function renderReport({
  syncedAt,
  sourceCount,
  limit,
  requestedLimit = limit,
  rows,
  errors,
  lastFetchFailure = null,
  reusedCount = 0,
  fetchedCount = 0,
  delayMs = 0,
}) {
  const skillSourceCounts = countBy(rows.flatMap((row) => row.skills), (skill) => skill.sourceType)
  const skillCategoryCounts = countBy(rows.flatMap((row) => row.skills), (skill) => skill.category)
  const traitRows = rows.filter((row) => row.counts.hasTraitDescription).length
  const bloodlineRows = rows.filter((row) => row.counts.bloodlineSkills > 0).length
  const evolutionRows = rows.filter((row) => row.counts.evolutionSteps > 0).length
  const examples = rows.slice(0, 12).map((row) => `| ${row.no} | ${row.name} | ${row.trait.name || '（空）'} | ${row.counts.skills} | ${row.counts.bloodlineSkills} | ${row.counts.evolutionSteps} | ${formatEvolutionSummary(row.evolution)} |`).join('\n')

  return `# BWiki 精灵详情 staging 报告

生成时间：${syncedAt}

> 本报告由 \`npm run sync:bwiki:details\` 生成，只把受控批次的 BWiki 精灵详情页解析为 staging，不替换 \`public/presets\`，也不触碰 Dexie / 浏览器用户数据。

## 快照输出

| 精灵 staging 行数 | 已解析详情行数 | 复用已有成功行 | 本次新抓取 | 请求间隔 | 快照失败行数 | 快照上限 | 请求上限 | 输出文件 |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| ${sourceCount} | ${rows.length} | ${reusedCount} | ${fetchedCount} | ${delayMs} ms | ${errors.length} | ${limit} | ${requestedLimit} | \`${OUTPUT_JSON}\` |

## 详情字段覆盖

| 字段 | 解析成功行数 |
|---|---:|
| 特性描述 | ${traitRows} |
| 血脉技能 | ${bloodlineRows} |
| 有进化链节点 | ${evolutionRows} |

## 技能来源标签

| 标签 | 数量 |
|---|---:|
${renderCountTable(skillSourceCounts)}

## 技能类型

| 类型 | 数量 |
|---|---:|
${renderCountTable(skillCategoryCounts)}

## 样本行

| 编号 | 名称 | 特性 | 技能数 | 血脉技能数 | 进化链节点数 | 进化链摘要 |
|---|---|---|---:|---:|---:|---|
${examples || '| （无） | （无） | （无） | 0 | 0 | 0 | （无） |'}

## 本次抓取失败

${lastFetchFailure ? `- ${lastFetchFailure.no} ${lastFetchFailure.name}: ${lastFetchFailure.error.split('\n')[0]}（失败行未写入 staging；已保留此前成功前缀）` : '- （无）'}

## 建议下一步

1. 对照少量手动打开的 BWiki 页面复核详情解析器，尤其是多形态精灵和进化数据缺失页面。
2. 确认特性描述、技能来源标签、血脉技能、进化链节点 / 摘要、蛋组和图片优先级的映射口径后，再继续扩大详情解析批次。
3. 在 preview 转换口径完成审阅前，只继续生成 staging / 报告；本阶段不要覆盖 \`public/presets/*\`。
`
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
}

async function main() {
  const limit = Number.parseInt(process.env.BWIKI_DETAIL_LIMIT || `${DEFAULT_LIMIT}`, 10)
  const delayMs = Math.max(0, Number.parseInt(process.env.BWIKI_DETAIL_DELAY_MS || `${DEFAULT_DELAY_MS}`, 10) || 0)
  const source = JSON.parse(await readFile(CREATURE_STAGING, 'utf8'))
  if (process.env.BWIKI_DETAIL_OFFLINE === '1') {
    const existing = JSON.parse(await readFile(OUTPUT_JSON, 'utf8'))
    await writeFile(resolve(OUTPUT_MD), renderReport({
      syncedAt: existing.syncedAt,
      sourceCount: source.rowCount,
      limit: existing.limit ?? limit,
      requestedLimit: existing.requestedLimit ?? existing.limit ?? limit,
      rows: existing.rows ?? [],
      errors: existing.errors ?? [],
      lastFetchFailure: existing.lastFetchFailure ?? null,
      reusedCount: existing.reusedCount ?? 0,
      fetchedCount: existing.fetchedCount ?? existing.rowCount ?? existing.rows?.length ?? 0,
      delayMs: existing.delayMs ?? 0,
    }))
    console.log(`Rendered BWiki creature detail report from existing staging rows: ${existing.rowCount ?? existing.rows?.length ?? 0}`)
    console.log(`Report: ${OUTPUT_MD}`)
    return
  }
  const candidates = source.rows.filter((row) => row.detailUrl).slice(0, limit)
  const syncedAt = new Date().toISOString()
  const rows = []
  const errors = []
  const refreshAll = process.env.BWIKI_DETAIL_REFRESH === '1'
  let existingRows = []
  if (!refreshAll) {
    try {
      const existing = JSON.parse(await readFile(OUTPUT_JSON, 'utf8'))
      if ((existing.errorCount ?? existing.errors?.length ?? 0) === 0) existingRows = existing.rows ?? []
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  const existingBySourceUrl = new Map(existingRows.map((row) => [row.sourceUrl, row]))
  let reusedCount = 0
  let fetchedCount = 0

  for (const row of candidates) {
    const existing = existingBySourceUrl.get(row.detailUrl)
    if (existing?.no === row.no && existing?.name === row.name) {
      rows.push(existing)
      reusedCount += 1
      continue
    }
    try {
      const html = await fetchTextWithRetry(row.detailUrl)
      rows.push(parseDetail(row, html))
      fetchedCount += 1
      if (delayMs > 0) await sleep(delayMs)
    } catch (error) {
      errors.push({ no: row.no, name: row.name, sourceUrl: row.detailUrl, error: error.message })
      break
    }
  }

  if (errors.length && fetchedCount === 0) {
    throw new Error(`BWiki detail fetch failed for ${errors.length} row(s); kept the previous 0-error staging snapshot unchanged. First failure: ${errors[0].no} ${errors[0].name}: ${errors[0].error}`)
  }

  const lastFetchFailure = errors[0] ?? null
  const snapshotLimit = lastFetchFailure ? rows.length : limit
  const snapshotErrors = []

  await writeJson(OUTPUT_JSON, {
    source: CREATURE_STAGING,
    syncedAt,
    limit: snapshotLimit,
    requestedLimit: limit,
    rowCount: rows.length,
    errorCount: snapshotErrors.length,
    reusedCount,
    fetchedCount,
    delayMs,
    rows,
    errors: snapshotErrors,
    lastFetchFailure,
  })
  await writeFile(resolve(OUTPUT_MD), renderReport({
    syncedAt,
    sourceCount: source.rowCount,
    limit: snapshotLimit,
    requestedLimit: limit,
    rows,
    errors: snapshotErrors,
    lastFetchFailure,
    reusedCount,
    fetchedCount,
    delayMs,
  }))

  console.log(`Wrote BWiki creature detail staging rows: ${rows.length}`)
  console.log(`Reused existing successful rows: ${reusedCount}; fetched rows: ${fetchedCount}`)
  console.log(`Delay between new detail requests: ${delayMs} ms`)
  console.log(`Report: ${OUTPUT_MD}`)
  if (lastFetchFailure) {
    throw new Error(`BWiki detail fetch stopped at ${lastFetchFailure.no} ${lastFetchFailure.name}; wrote ${rows.length} successful 0-error staging rows and left the failed row out. ${lastFetchFailure.error}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
