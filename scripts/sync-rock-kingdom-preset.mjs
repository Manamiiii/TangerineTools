#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SOURCE_URL = 'https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json'
const ASSET_BASE = 'https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/'
const EXPECTED_TOTAL = 496
const ELEMENT_MAP = new Map([
  ['普通', 'normal'], ['草', 'grass'], ['火', 'fire'], ['水', 'water'], ['光', 'light'], ['地', 'earth'],
  ['冰', 'ice'], ['龙', 'dragon'], ['电', 'electric'], ['毒', 'poison'], ['虫', 'bug'], ['武', 'fighting'],
  ['翼', 'flying'], ['萌', 'cute'], ['幽', 'ghost'], ['恶', 'dark'], ['机械', 'mech'], ['幻', 'illusion'],
])
const ELEMENT_VALUES = [...ELEMENT_MAP.values()]

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outputPath = path.join(repoRoot, 'public/presets/rockKingdomRows.json')

function fullUrl(assetPath) {
  if (!assetPath) return ''
  return new URL(assetPath.split('/').map(encodeURIComponent).join('/'), ASSET_BASE).href
}

function deriveTags(desc) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag) && tags.length < 3) tags.push(tag)
  }
  if (!desc) return ['special']
  if (/物攻|物理|物伤/.test(desc)) add('patkLean')
  if (/魔攻|魔法|魔伤/.test(desc)) add('matkLean')
  if (/速度|先手|行动/.test(desc)) add('spdLean')
  if (/回复|生命|治疗/.test(desc)) add('support')
  if (/能量|能耗/.test(desc)) add('energyCycle')
  if (/克制/.test(desc)) add('counterGain')
  if (/强化|永久\+|\+20%|\+70%/.test(desc)) add('growth')
  if (/护盾|减伤/.test(desc)) add('shieldReduce')
  if (/防御/.test(desc)) add('defense')
  if (/冻结|中毒|灼烧|异常|恐惧|控制/.test(desc)) add('control')
  if (/返场|换入|换下/.test(desc)) add('pivot')
  if (tags.length === 0 && /攻击|伤害|暴击|威力/.test(desc)) add('attack')
  return tags.length > 0 ? tags : ['special']
}

function pickEvoValue(detail, sourceId, key) {
  const evo = Array.isArray(detail?.evo) ? detail.evo : []
  const matched = evo.find((item) => String(item.i) === String(sourceId))
  return matched?.[key]
}

function parseNoFromImage(img) {
  const matched = img?.match(/NO\.(\d+)/)
  return matched ? `NO.${matched[1]}` : ''
}

async function loadSource() {
  const localInput = process.argv[2]
  if (localInput) {
    const text = await readFile(path.resolve(repoRoot, localInput), 'utf8')
    console.log(`source: local file ${localInput}`)
    return JSON.parse(text)
  }

  console.log(`source: ${SOURCE_URL}`)
  let res
  try {
    res = await fetch(SOURCE_URL)
  } catch (err) {
    throw new Error(`无法访问洛克王国公开图鉴数据源：${err.message}`)
  }
  if (!res.ok) throw new Error(`无法访问洛克王国公开图鉴数据源：HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

function assertSourceShape(data) {
  const keys = Object.keys(data || {})
  console.log('top-level keys:', keys.join(', '))
  if (!Array.isArray(data?.l)) throw new Error('数据源结构异常：缺少数组 l')
  if (!data?.d || typeof data.d !== 'object') throw new Error('数据源结构异常：缺少详情字典 d')
  if (!Array.isArray(data?.e)) throw new Error('数据源结构异常：缺少系别数组 e')
  if (!data?._em || typeof data._em !== 'object') throw new Error('数据源结构异常：缺少系别图标映射 _em')
  if (!data?._tm || typeof data._tm !== 'object') throw new Error('数据源结构异常：缺少特性图标映射 _tm')
}

function makeRow(data, source, base) {
  const sourceId = source.i
  const detail = data.d[String(sourceId)] || {}
  const no = source.n || base.n || parseNoFromImage(source.img) || parseNoFromImage(base.img)
  const element = [source.e || base.e, source.e2 || base.e2].filter(Boolean).map((cn) => {
    const value = ELEMENT_MAP.get(cn)
    if (!value) throw new Error(`未知系别：${cn}（source id ${sourceId}）`)
    return value
  })
  const traitName = detail.tn || ''
  return {
    id: `rock-creature-src-${String(sourceId).padStart(3, '0')}`,
    values: {
      image: fullUrl(source.img || base.img),
      name: source.fn || source.nm || pickEvoValue(detail, sourceId, 'fn') || pickEvoValue(detail, sourceId, 'nm') || '',
      no,
      element,
      form: source.f || source.s || pickEvoValue(detail, sourceId, 's') || base.s || '',
      bst: detail.rt ?? source.rt ?? 0,
      shiny: source.sh === 1 ? 'yes' : 'no',
      traitName,
      traitTags: deriveTags(detail.te || ''),
      traitIcon: traitName && data._tm[traitName] ? fullUrl(data._tm[traitName]) : '',
      traitDesc: detail.te || '',
      hp: detail.hp ?? 0,
      patk: detail.atk ?? 0,
      matk: detail.matk ?? 0,
      pdef: detail.df ?? 0,
      mdef: detail.mdf ?? 0,
      spd: detail.spd ?? 0,
    },
  }
}

function buildRows(data) {
  const baseCount = data.l.length
  const formCount = data.l.reduce((sum, base) => sum + (data.d[String(base.i)]?.forms?.length || 0), 0)
  const total = baseCount + formCount
  if (total !== EXPECTED_TOTAL) {
    throw new Error(`公开图鉴条目数量变化：baseCount=${baseCount}, formCount=${formCount}, total=${total}, expected=${EXPECTED_TOTAL}`)
  }
  const rows = []
  for (const base of data.l) {
    rows.push(makeRow(data, base, base))
    for (const form of data.d[String(base.i)]?.forms || []) rows.push(makeRow(data, form, base))
  }
  const ids = rows.map((row) => row.id)
  if (new Set(ids).size !== ids.length) throw new Error('生成结果包含重复 id')
  return { rows, baseCount, formCount }
}

function printStats(rows, baseCount, formCount) {
  const imageUrlCount = rows.filter((row) => /^https?:\/\//.test(row.values.image)).length
  const traitIconUrlCount = rows.filter((row) => /^https?:\/\//.test(row.values.traitIcon)).length
  const elementValues = [...new Set(rows.flatMap((row) => row.values.element))]
  const missingElements = ELEMENT_VALUES.filter((value) => !elementValues.includes(value))
  if (missingElements.length > 0) throw new Error(`生成结果缺少系别：${missingElements.join(', ')}`)
  console.log('baseCount:', baseCount)
  console.log('formCount:', formCount)
  console.log('rowCount:', rows.length)
  console.log('image URL count:', imageUrlCount)
  console.log('traitIcon URL count:', traitIconUrlCount)
  console.log('element value set:', elementValues.join(', '))
  console.log('first row preview:', JSON.stringify(rows[0], null, 2))
}

const data = await loadSource()
assertSourceShape(data)
const { rows, baseCount, formCount } = buildRows(data)
printStats(rows, baseCount, formCount)
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
console.log(`wrote ${path.relative(repoRoot, outputPath)}`)
