#!/usr/bin/env node
// 从 B 站洛克王国手游 WIKI 同步孵蛋推荐所需的蛋组/同种精灵补充数据。
// 说明：BWiki 精灵图鉴是按 WIKI 页面生成的静态 HTML/页面数据快照，不是应用运行时实时 API。
// 本脚本在维护者本地联网运行，产物写入 public/presets/rockKingdomBreedingRows.json；
// App 启动迁移时只用它补齐官方资料缺失的空字段，不覆盖官方/用户已有非空值。

import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const INDEX_URL = 'https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4'
const OUTPUT_FILE = new URL('../public/presets/rockKingdomBreedingRows.json', import.meta.url)
const LOCAL_ROWS_FILE = new URL('../public/presets/rockKingdomRows.json', import.meta.url)
const USER_AGENT = 'TangerineTools breeding preset sync (+local-first personal data tool)'
const EGG_GROUP_NAMES = [
  '无法孵蛋',
  '动物组',
  '拟人组',
  '巨灵组',
  '魔力组',
  '天空组',
  '两栖组',
  '植物组',
  '大地组',
  '妖精组',
  '昆虫组',
  '软体组',
  '机械组',
  '海洋组',
  '龙组',
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
  return decodeHtml(String(html || '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n'))
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

function parseIndexLinks(html) {
  const links = []
  const seen = new Set()
  const regex = /href="\/rocom\/([^"#?]+)"[^>]*>([^<]+)<\/a>/g
  let match
  while ((match = regex.exec(html))) {
    const slug = decodeURIComponent(match[1])
    const name = decodeHtml(match[2]).trim()
    if (!name) continue
    if (seen.has(name)) continue
    seen.add(name)
    links.push({ name, url: `https://wiki.biligame.com/rocom/${encodeURIComponent(slug)}` })
  }
  return links
}

function parseEggGroupsFromText(text) {
  const groups = EGG_GROUP_NAMES.filter((group) => new RegExp(`(^|[^一-龥])${group}([^一-龥]|$)`).test(text))
  return [...new Set(groups)]
}

function parseNoAndName(row) {
  const values = row.values || {}
  return {
    no: String(values.no || '').replace(/^NO\.?/i, '').padStart(3, '0'),
    name: String(values.name || '').trim(),
  }
}

function speciesGroupForRow(row, rowsByNoName) {
  const { no, name } = parseNoAndName(row)
  const sameNo = rowsByNoName.get(no) || []
  if (sameNo.length > 1) return `${sameNo[0].name}系`
  return `${name}系`
}

async function main() {
  const localRows = JSON.parse(await readFile(LOCAL_ROWS_FILE, 'utf8'))
  const rowsByNo = new Map()
  for (const row of localRows) {
    const parsed = parseNoAndName(row)
    if (!parsed.no || !parsed.name) continue
    rowsByNo.set(parsed.no, [...(rowsByNo.get(parsed.no) || []), parsed])
  }

  const indexHtml = await fetchText(INDEX_URL)
  const links = parseIndexLinks(indexHtml)
  if (links.length === 0) throw new Error('未能从 BWiki 精灵图鉴解析到精灵链接')

  const byName = new Map()
  for (const [index, link] of links.entries()) {
    if (index > 0 && index % 20 === 0) await delay(500)
    const html = await fetchText(link.url)
    const text = stripTags(html)
    const eggGroups = parseEggGroupsFromText(text)
    if (eggGroups.length === 0) continue
    byName.set(link.name, { eggGroups, sourceUrl: link.url })
  }

  const output = []
  for (const row of localRows) {
    const { name } = parseNoAndName(row)
    const hit = byName.get(name)
    if (!hit) continue
    output.push({
      id: row.id,
      name,
      eggGroups: hit.eggGroups,
      speciesGroup: speciesGroupForRow(row, rowsByNo),
      sourceUrl: hit.sourceUrl,
    })
  }

  await writeFile(OUTPUT_FILE, `${JSON.stringify({ source: INDEX_URL, syncedAt: new Date().toISOString(), rows: output }, null, 2)}\n`)
  console.log(`写入 ${output.length} 条 BWiki 孵蛋资料到 ${OUTPUT_FILE.pathname}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
