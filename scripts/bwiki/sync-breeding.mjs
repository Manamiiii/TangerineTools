#!/usr/bin/env node
// 从 B 站洛克王国手游 WIKI 同步孵蛋推荐所需的蛋组/繁育谱系补充数据。
// 说明：BWiki 页面数据是维护者手动同步的快照，不是应用运行时实时 API。
// 本脚本联网运行，产物写入 staging；正式预置中的繁育字段由 BWiki 发布流程合并。
// App 启动迁移时只用它补齐官方资料缺失的空字段，不覆盖官方/用户已有非空值。

import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { BWIKI_PATHS, resolveRepoPath } from './lib/paths.mjs'

const EGG_GROUP_LIST_URL = 'https://wiki.biligame.com/rocom/%E5%AD%B5%E8%9B%8B%E7%BB%84%E5%88%AB%E6%9F%A5%E8%AF%A2'
const OUTPUT_FILE = resolveRepoPath(BWIKI_PATHS.staging.breeding)
const LOCAL_ROWS_FILE = resolveRepoPath(BWIKI_PATHS.presets.creatures)
const USER_AGENT = 'TangerineTools breeding preset sync (+local-first personal data tool)'
const execFileAsync = promisify(execFile)
const UNBREEDABLE_GROUP = '无法孵蛋'

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
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return res.text()
  } catch (fetchError) {
    const { stdout } = await execFileAsync('curl', [
      '-L',
      '--fail',
      '--silent',
      '--show-error',
      '--max-time',
      '60',
      '-A',
      USER_AGENT,
      url,
    ], { maxBuffer: 8 * 1024 * 1024 })
    if (!stdout) throw fetchError
    return stdout
  }
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

function parseGroupLabels(html) {
  const labels = new Map()
  for (const match of html.matchAll(/data-egg-group-button="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>/g)) {
    const id = match[1]
    const label = decodeHtml(match[2]).trim()
    if (id && id !== 'all' && label) labels.set(id, label === '未发现' ? UNBREEDABLE_GROUP : label)
  }
  return labels
}

function isNoiseLine(line) {
  return !line || /^Image[:：]/i.test(line) || /^文件[:：]/.test(line) || /^\d+$/.test(line) || /^蛋组列表$/.test(line)
}

function parseBwikiEggGroupRows(html) {
  const groupLabels = parseGroupLabels(html)
  const cardEntries = []
  for (const match of html.matchAll(/<div class="egg-calc-suggest-item"[^>]*data-groups="([^"]+)"[^>]*>\s*<span class="egg-calc-suggest-name">([^<]+)<\/span>\s*<span class="egg-calc-suggest-no">NO\.?(\d+)<\/span>/g)) {
    const groupIds = match[1].split(/\s+/).map((id) => id.trim()).filter(Boolean)
    const eggGroups = groupIds.map((id) => groupLabels.get(id)).filter(Boolean)
    const name = decodeHtml(match[2]).trim()
    const no = match[3].padStart(3, '0')
    if (no && name && eggGroups.length > 0) cardEntries.push({ no, name, form: '', eggGroups })
  }
  for (const match of html.matchAll(/<div class="egg-calc-card[^"]*"[^>]*>/g)) {
    const tag = match[0]
    const no = tag.match(/data-pet-number="([^"]+)"/)?.[1]?.padStart(3, '0') || ''
    const name = decodeHtml(tag.match(/data-pet-name="([^"]+)"/)?.[1] || '').trim()
    const form = decodeHtml(tag.match(/data-pet-title="([^"]+)"/)?.[1] || '').trim()
    const groupIds = (tag.match(/data-groups="([^"]+)"/)?.[1] || '').split(',').map((id) => id.trim()).filter(Boolean)
    const eggGroups = groupIds.map((id) => groupLabels.get(id)).filter(Boolean)
    if (no && name && eggGroups.length > 0) cardEntries.push({ no, name, form, eggGroups })
  }
  if (cardEntries.length > 0) return cardEntries

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
    const groups = [...groupLabels.values()].filter((group) => line.includes(group) || (group === UNBREEDABLE_GROUP && line.includes('未发现')))
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
  const byNo = new Map()
  for (const entry of entries) {
    const noNameKey = `${entry.no}:${entry.name}`
    if (!byNoName.has(noNameKey)) byNoName.set(noNameKey, entry)
    if (!byName.has(entry.name)) byName.set(entry.name, entry)
    if (!byNo.has(entry.no)) byNo.set(entry.no, entry)
  }
  return { byNoName, byName, byNo }
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
  const { byNoName, byName, byNo } = buildEntryIndexes(entries)
  if (entries.length === 0) throw new Error('未能从 BWiki 孵蛋组别查询解析到蛋组数据')

  const output = []
  const missing = []
  for (const row of localRows) {
    const { no, name } = parseNoAndName(row)
    const hit = byNoName.get(`${no}:${name}`) || byName.get(name) || byNo.get(no)
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
