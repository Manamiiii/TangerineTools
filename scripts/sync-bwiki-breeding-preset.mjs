#!/usr/bin/env node
// 从 B 站洛克王国手游 WIKI 同步孵蛋推荐所需的蛋组/繁育谱系补充数据。
// 说明：BWiki 页面数据是维护者手动同步的快照，不是应用运行时实时 API。
// 本脚本联网运行，产物写入 public/presets/rockKingdomBreedingRows.json；
// App 启动迁移时只用它补齐官方资料缺失的空字段，不覆盖官方/用户已有非空值。

import { readFile, writeFile } from 'node:fs/promises'

const EGG_GROUP_LIST_URL = 'https://wiki.biligame.com/rocom/%E5%AD%B5%E8%9B%8B%E7%BB%84%E5%88%AB%E6%9F%A5%E8%AF%A2'
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
  '飞龙组',
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
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '\n'))
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

function parseNoAndName(row) {
  const values = row.values || {}
  return {
    no: String(values.no || '').replace(/^NO\.?/i, '').padStart(3, '0'),
    name: String(values.name || '').trim(),
  }
}

function speciesGroupForRow(row, rowsByNo) {
  const { no, name } = parseNoAndName(row)
  const evolutionLine = row.values?.evolutionLine
  if (Array.isArray(evolutionLine) && evolutionLine[0]) return evolutionLine[0]
  if (row.values?.breedingLine) return row.values.breedingLine
  const sameNo = rowsByNo.get(no) || []
  if (sameNo.length > 1) return sameNo[0].values?.name || name
  return name
}

function normalizeNo(text) {
  const match = String(text || '').match(/NO\.?(\d+)/i)
  return match ? match[1].padStart(3, '0') : ''
}

function parseEggGroups(line) {
  if (/未发现|无法孵蛋/.test(line)) return ['无法孵蛋']
  return EGG_GROUP_NAMES.filter((group) => group !== '无法孵蛋' && line.includes(group))
}

function isNoiseLine(line) {
  return !line || /^Image[:：]/i.test(line) || /^文件[:：]/.test(line) || /^\d+$/.test(line) || /^蛋组列表$/.test(line)
}

function parseBwikiEggGroupRows(html) {
  const text = stripTags(html)
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const start = Math.max(lines.findIndex((line) => line === '蛋组列表'), 0)
  const entries = []
  let current = null

  function flushIfComplete(groups) {
    if (!current?.no || !current?.name || groups.length === 0) return
    entries.push({ ...current, eggGroups: groups })
    current = null
  }

  for (const line of lines.slice(start)) {
    const no = normalizeNo(line)
    if (no) {
      current = { no, name: '', form: '' }
      continue
    }
    if (!current || isNoiseLine(line)) continue
    const groups = parseEggGroups(line)
    if (groups.length > 0) {
      flushIfComplete(groups)
      continue
    }
    if (!current.name) current.name = line
    else if (!current.form) current.form = line
  }
  return entries
}

function buildEntryIndexes(entries) {
  const byNoName = new Map()
  const byName = new Map()
  for (const entry of entries) {
    const noNameKey = `${entry.no}:${entry.name}`
    if (!byNoName.has(noNameKey)) byNoName.set(noNameKey, entry)
    if (!byName.has(entry.name)) byName.set(entry.name, entry)
  }
  return { byNoName, byName }
}

async function main() {
  const localRows = JSON.parse(await readFile(LOCAL_ROWS_FILE, 'utf8'))
  const rowsByNo = new Map()
  for (const row of localRows) {
    const parsed = parseNoAndName(row)
    if (!parsed.no || !parsed.name) continue
    rowsByNo.set(parsed.no, [...(rowsByNo.get(parsed.no) || []), row])
  }

  const html = await fetchText(EGG_GROUP_LIST_URL)
  const entries = parseBwikiEggGroupRows(html)
  const { byNoName, byName } = buildEntryIndexes(entries)
  if (entries.length === 0) throw new Error('未能从 BWiki 孵蛋组别查询解析到蛋组数据')

  const output = []
  const missing = []
  for (const row of localRows) {
    const { no, name } = parseNoAndName(row)
    const hit = byNoName.get(`${no}:${name}`) || byName.get(name)
    if (!hit) {
      missing.push(`${row.values?.no || no} ${name}`)
      continue
    }
    output.push({
      id: row.id,
      name,
      no: row.values?.no || `NO.${no}`,
      eggGroups: hit.eggGroups,
      speciesGroup: speciesGroupForRow(row, rowsByNo),
      sourceUrl: EGG_GROUP_LIST_URL,
    })
  }

  if (output.length < Math.floor(localRows.length * 0.9)) {
    throw new Error(`BWiki 蛋组匹配覆盖过低：${output.length}/${localRows.length}，示例缺失：${missing.slice(0, 12).join('、')}`)
  }

  await writeFile(OUTPUT_FILE, `${JSON.stringify({ source: EGG_GROUP_LIST_URL, syncedAt: new Date().toISOString(), rows: output }, null, 2)}\n`)
  console.log(`写入 ${output.length}/${localRows.length} 条 BWiki 孵蛋资料到 ${OUTPUT_FILE.pathname}`)
  if (missing.length > 0) console.warn(`仍有 ${missing.length} 条本地精灵未匹配：${missing.slice(0, 20).join('、')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
