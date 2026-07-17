#!/usr/bin/env node
// BWiki 洛克王国世界资料源可解析性审计。
// 只联网读取 BWiki 页面并生成 docs/bwiki-source-audit.md；不改预置 JSON，不写入 Dexie。

import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const USER_AGENT = 'TangerineTools BWiki source audit (+local-first personal data tool)'
const OUTPUT_FILE = new URL('../docs/bwiki-source-audit.md', import.meta.url)
const LOCAL_ROWS_FILE = new URL('../public/presets/rockKingdomRows.json', import.meta.url)
const LOCAL_SKILL_ROWS_FILE = new URL('../public/presets/rockKingdomSkillRows.json', import.meta.url)

const BWIKI_PAGES = {
  home: 'https://wiki.biligame.com/rocom/%E9%A6%96%E9%A1%B5',
  creatureCatalog: 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4',
  creatureFilter: 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E7%AD%9B%E9%80%89',
  creatureDetailSample: 'https://wiki.biligame.com/rocom/%E9%9B%AA%E7%BB%92%E9%B8%9F%EF%BC%88%E6%98%A5%E5%A4%A9%E7%9A%84%E6%A0%B7%E5%AD%90%EF%BC%89',
  skillCatalog: 'https://wiki.biligame.com/rocom/%E6%8A%80%E8%83%BD%E5%9B%BE%E9%89%B4',
  skillFilter: 'https://wiki.biligame.com/rocom/%E6%8A%80%E8%83%BD%E6%9F%A5%E8%AF%A2',
  eggCatalog: 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E5%9B%BE%E9%89%B4',
  eggFilter: 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E7%AD%9B%E9%80%89',
  fruitCatalog: 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E6%9E%9C%E5%AE%9E%E5%9B%BE%E9%89%B4',
  eggGroupCalculator: 'https://wiki.biligame.com/rocom/%E8%9B%8B%E7%BB%84%E8%AE%A1%E7%AE%97%E5%99%A8',
  eggGroupLookup: 'https://wiki.biligame.com/rocom/%E5%AD%B5%E8%9B%8B%E7%BB%84%E5%88%AB%E6%9F%A5%E8%AF%A2',
}

const FIELD_COVERAGE = [
  ['精灵基础字段', '精灵筛选', '编号、名称、属性、特性名、生命、速度、物攻、魔攻、物防、魔防、总种族值'],
  ['精灵详情字段', '精灵详情页', '特性详情、会的技能、进化链、蛋组、详情图；需逐页解析并建立技能关系'],
  ['技能基础字段', '技能查询', '名称、属性、分类、能耗、威力、效果、技能图标'],
  ['技能归属关系', '精灵详情页', '按每只精灵详情页技能卡建立 skillRefs，再反推 learnerRefs；血脉/互斥技能保留来源标签'],
  ['精灵蛋资料', '精灵蛋图鉴 / 筛选', '可作为后续独立资料表加入，不应混入精灵基础表'],
  ['精灵果实资料', '精灵果实图鉴', '可作为后续独立资料表加入，不应混入精灵基础表'],
]

function decodeHtml(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(html) {
  return decodeHtml(String(html || '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return res.text()
  } catch (fetchError) {
    const { stdout } = await execFileAsync('curl', [
      '-L', '--fail', '--silent', '--show-error', '--max-time', '60', '-A', USER_AGENT, url,
    ], { maxBuffer: 12 * 1024 * 1024 })
    if (!stdout) throw fetchError
    return stdout
  }
}

function tableRows(html) {
  return [...String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/g)].map((match) => match[0])
}

function tableHeaders(rowHtml) {
  return [...String(rowHtml || '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => stripTags(match[1]))
}

function tableCells(rowHtml) {
  return [...String(rowHtml || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => stripTags(match[1]))
}

function parseCreatureFilter(html) {
  const rows = tableRows(html)
  const headers = tableHeaders(rows[0] || '')
  const creatures = []
  for (const row of rows.slice(1)) {
    const cells = tableCells(row)
    if (cells.length < 12) continue
    creatures.push({
      no: cells[0].padStart(3, '0'),
      name: cells[2],
      element: cells[3],
      traitName: cells[4],
      hp: Number(cells[5]),
      spd: Number(cells[6]),
      patk: Number(cells[7]),
      matk: Number(cells[8]),
      pdef: Number(cells[9]),
      mdef: Number(cells[10]),
      bst: Number(cells[11]),
    })
  }
  return { headers, rows: creatures }
}

function parseSkillFilter(html) {
  const rows = tableRows(html)
  const headers = tableHeaders(rows[0] || '')
  const skills = []
  for (const row of rows.slice(1)) {
    const cells = tableCells(row)
    if (cells.length < 7) continue
    skills.push({
      name: cells[1],
      element: cells[2],
      category: cells[3],
      cost: cells[4],
      power: cells[5],
      effect: cells[6],
    })
  }
  return { headers, rows: skills }
}

function pageSignals(html) {
  const text = stripTags(html)
  return {
    bytes: html.length,
    tableRows: tableRows(html).length,
    hasStats: /生命|物攻|魔攻|物防|魔防|速度|种族/.test(text),
    hasTrait: /特性/.test(text),
    hasSkills: /技能|血脉|能耗|威力/.test(text),
    hasEvolution: /进化/.test(text),
    hasEggGroup: /蛋组|孵蛋|精灵蛋/.test(text),
    hasImages: /<img\b/.test(html),
    dataAttributeCount: (html.match(/\sdata-[\w-]+=/g) || []).length,
  }
}

function localCreatureKey(row) {
  const values = row.values || {}
  return `${String(values.no || '').replace(/^NO\.?/i, '').padStart(3, '0')}::${values.name || ''}`
}

function mdList(items, limit = 20) {
  if (items.length === 0) return '无'
  const shown = items.slice(0, limit).map((item) => `\`${item}\``).join('、')
  return items.length > limit ? `${shown} 等 ${items.length} 项` : shown
}

function renderReport({ pages, creatures, skills, localRows, localSkills }) {
  const localCreatureKeys = new Set(localRows.map(localCreatureKey))
  const bwikiCreatureKeys = new Set(creatures.rows.map((row) => `${row.no}::${row.name}`))
  const localSkillNames = new Set(localSkills.map((row) => row.values?.name).filter(Boolean))
  const bwikiSkillNames = new Set(skills.rows.map((row) => row.name).filter(Boolean))
  const localMissingOnBwiki = [...localCreatureKeys].filter((key) => !bwikiCreatureKeys.has(key)).sort()
  const bwikiCreatureExtra = [...bwikiCreatureKeys].filter((key) => !localCreatureKeys.has(key)).sort()
  const localSkillMissingOnBwiki = [...localSkillNames].filter((name) => !bwikiSkillNames.has(name)).sort()
  const bwikiSkillExtra = [...bwikiSkillNames].filter((name) => !localSkillNames.has(name)).sort()
  const generatedAt = new Date().toISOString()

  return `# BWiki 洛克王国世界资料源审计

` +
    `生成时间：${generatedAt}

` +
    `> 本报告由 \`node scripts/audit-bwiki-rocom-source.mjs\` 生成。它只记录 BWiki 页面可解析性与本地预置覆盖差异，不改 \`public/presets\` 产物，不写入 Dexie。BWiki 是玩家共建页面，后续可作为“主同步候选源 / 最新社区数据源”，但不要再称为厂商官方源。

` +
    `## 已登记的 BWiki 页面

` +
    `| 用途 | URL | HTML 字节数 | 表格行 | data-* 数 | 关键信号 |
` +
    `|---|---|---:|---:|---:|---|
` +
    Object.entries(BWIKI_PAGES).map(([key, url]) => {
      const signal = pages[key]
      const flags = [
        signal.hasStats ? '六维/数值' : '',
        signal.hasTrait ? '特性' : '',
        signal.hasSkills ? '技能' : '',
        signal.hasEvolution ? '进化' : '',
        signal.hasEggGroup ? '蛋组/精灵蛋' : '',
        signal.hasImages ? '图片' : '',
      ].filter(Boolean).join('、') || '未识别'
      return `| ${key} | ${url} | ${signal.bytes} | ${signal.tableRows} | ${signal.dataAttributeCount} | ${flags} |`
    }).join('\n') +
    `

## 精灵筛选页解析结果

` +
    `- 表头：${creatures.headers.map((header) => `\`${header}\``).join('、')}
` +
    `- BWiki 精灵 / 形态行：${creatures.rows.length}
` +
    `- 本地当前预置行：${localRows.length}
` +
    `- 本地按 \`编号::名称\` 在 BWiki 精确缺失：${localMissingOnBwiki.length}
` +
    `- BWiki 比本地多出的 \`编号::名称\`：${bwikiCreatureExtra.length}
` +
    `- 精确缺失示例：${mdList(localMissingOnBwiki)}
` +
    `- BWiki 新增/命名差异示例：${mdList(bwikiCreatureExtra)}

` +
    `> 说明：用户已确认“本来的样子”等本地形态名可以以后续 BWiki 页面命名为准，因此上述“缺失”里有一部分是命名口径差异，不一定是资料缺失。

` +
    `## 技能查询页解析结果

` +
    `- 表头：${skills.headers.map((header) => `\`${header}\``).join('、')}
` +
    `- BWiki 技能行：${skills.rows.length}
` +
    `- 本地当前技能行：${localSkills.length}
` +
    `- 本地技能名在 BWiki 缺失：${localSkillMissingOnBwiki.length}
` +
    `- BWiki 比本地多出的技能名：${bwikiSkillExtra.length}
` +
    `- 本地缺失示例：${mdList(localSkillMissingOnBwiki)}
` +
    `- BWiki 新增示例：${mdList(bwikiSkillExtra)}

` +
    `## 字段覆盖规划

` +
    `| 资源 | 推荐来源 | 可解析字段 / 处理方式 |
` +
    `|---|---|---|
` +
    FIELD_COVERAGE.map(([resource, source, fields]) => `| ${resource} | ${source} | ${fields} |`).join('\n') +
    `

## 后续同步策略

` +
    `1. BWiki 作为“版本更新时手动拉取的主同步候选源”，不是应用运行时实时查询源；用户通知版本变更后再重新运行同步/审计。
` +
    `2. 精灵详情页优先用于补齐特性详情、技能列表、血脉/互斥技能、进化链、蛋组与图片；技能关系由精灵详情页的技能卡建立 \`skillRefs\`，再反推技能行 \`learnerRefs\`。
` +
    `3. 图片后续以 BWiki / patchwiki 页面图片为准；切换前应在 staging 产物中保留图片 URL 来源，避免直接污染当前可用预置。
` +
    `4. 精灵蛋图鉴、精灵蛋筛选、精灵果实图鉴可以加入资料库，但应作为独立资料表，不混入“精灵基础资料”。
` +
    `5. 下一步建议先生成 BWiki staging JSON 与差异报告，人工确认字段映射后再替换当前 \`rockKingdomRows.json\` / \`rockKingdomSkillRows.json\`。
`
}

async function main() {
  const [localRows, localSkills] = await Promise.all([
    readFile(LOCAL_ROWS_FILE, 'utf8').then(JSON.parse),
    readFile(LOCAL_SKILL_ROWS_FILE, 'utf8').then(JSON.parse),
  ])
  const pageEntries = await Promise.all(Object.entries(BWIKI_PAGES).map(async ([key, url]) => [key, await fetchText(url)]))
  const htmlByKey = Object.fromEntries(pageEntries)
  const pages = Object.fromEntries(Object.entries(htmlByKey).map(([key, html]) => [key, pageSignals(html)]))
  const creatures = parseCreatureFilter(htmlByKey.creatureFilter)
  const skills = parseSkillFilter(htmlByKey.skillFilter)
  const report = renderReport({ pages, creatures, skills, localRows, localSkills })
  await writeFile(OUTPUT_FILE, report)
  console.log(`BWiki pages audited: ${Object.keys(BWIKI_PAGES).length}`)
  console.log(`BWiki creature rows: ${creatures.rows.length}`)
  console.log(`BWiki skill rows: ${skills.rows.length}`)
  console.log(`wrote ${OUTPUT_FILE.pathname}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
