import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CREATURE_STAGING = 'scripts/data/bwiki/creatures.staging.json'
const OUTPUT_JSON = 'scripts/data/bwiki/creature-details.sample.staging.json'
const OUTPUT_MD = 'docs/bwiki-detail-staging-report.md'
const DEFAULT_LIMIT = 24

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
  const canPair = names.length % 2 === 0 && names.every((name, index) => index % 2 === 1 || name === first)
  if (canPair) {
    return names.reduce((pairs, name, index) => {
      if (index % 2 === 0) pairs.push(`${name} → ${names[index + 1]}`)
      return pairs
    }, []).join('；')
  }
  return names.join(' → ')
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

function renderReport({ syncedAt, sourceCount, limit, rows, errors }) {
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

| 精灵 staging 行数 | 已解析详情行数 | 失败行数 | 本次上限 | 输出文件 |
|---:|---:|---:|---:|---|
| ${sourceCount} | ${rows.length} | ${errors.length} | ${limit} | \`${OUTPUT_JSON}\` |

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

${errors.length ? errors.map((error) => `- ${error.no} ${error.name}: ${error.error.split('\n')[0]}`).join('\n') : '- （无）'}

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
  const source = JSON.parse(await readFile(CREATURE_STAGING, 'utf8'))
  if (process.env.BWIKI_DETAIL_OFFLINE === '1') {
    const existing = JSON.parse(await readFile(OUTPUT_JSON, 'utf8'))
    await writeFile(resolve(OUTPUT_MD), renderReport({
      syncedAt: existing.syncedAt,
      sourceCount: source.rowCount,
      limit: existing.limit ?? limit,
      rows: existing.rows ?? [],
      errors: existing.errors ?? [],
    }))
    console.log(`Rendered BWiki creature detail report from existing staging rows: ${existing.rowCount ?? existing.rows?.length ?? 0}`)
    console.log(`Report: ${OUTPUT_MD}`)
    return
  }
  const candidates = source.rows.filter((row) => row.detailUrl).slice(0, limit)
  const syncedAt = new Date().toISOString()
  const rows = []
  const errors = []

  for (const row of candidates) {
    try {
      const html = await fetchText(row.detailUrl)
      rows.push(parseDetail(row, html))
    } catch (error) {
      errors.push({ no: row.no, name: row.name, sourceUrl: row.detailUrl, error: error.message })
    }
  }

  await writeJson(OUTPUT_JSON, {
    source: CREATURE_STAGING,
    syncedAt,
    limit,
    rowCount: rows.length,
    errorCount: errors.length,
    rows,
    errors,
  })
  await writeFile(resolve(OUTPUT_MD), renderReport({ syncedAt, sourceCount: source.rowCount, limit, rows, errors }))

  console.log(`Wrote BWiki creature detail staging rows: ${rows.length}`)
  if (errors.length) console.warn(`Skipped BWiki detail rows after fetch errors: ${errors.length}`)
  console.log(`Report: ${OUTPUT_MD}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
