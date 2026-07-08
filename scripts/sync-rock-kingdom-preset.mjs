#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'

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
const skillOutputPath = path.join(repoRoot, 'public/presets/rockKingdomSkillRows.json')

function fullUrl(assetPath) {
  if (!assetPath) return ''
  return new URL(assetPath.split('/').map(encodeURIComponent).join('/'), ASSET_BASE).href
}

function deriveTags(desc, stats = {}) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag) && tags.length < 4) tags.push(tag)
  }
  const hp = Number(stats.hp) || 0
  const patk = Number(stats.patk) || 0
  const matk = Number(stats.matk) || 0
  const pdef = Number(stats.pdef) || 0
  const mdef = Number(stats.mdef) || 0
  const spd = Number(stats.spd) || 0
  const bulk = hp + pdef + mdef
  const topAttack = Math.max(patk, matk)

  if (patk >= matk + 15 && patk >= 85) add('patkLean')
  if (matk >= patk + 15 && matk >= 85) add('matkLean')
  if (Math.abs(patk - matk) <= 15 && patk >= 85 && matk >= 85) add('attack')
  if (spd >= 95 || (spd >= 85 && spd >= topAttack - 5)) add('spdLean')
  if (bulk >= 300 || pdef >= 105 || mdef >= 105 || hp >= 120) add('defense')

  if (desc) {
    if (/回复|恢复|生命|治疗|回血|保留1点生命/.test(desc)) add('support')
    if (/能量|能耗|回复\d*能量|获得\d*能量/.test(desc)) add('energyCycle')
    if (/克制|抵触/.test(desc)) add('counterGain')
    if (/强化|永久\+|\+20%|\+70%|提升|增加/.test(desc)) add('growth')
    if (/护盾|减伤|防御|免疫|抵免/.test(desc)) add('shieldReduce')
    if (/冻结|中毒|灼烧|异常|恐惧|控制|污染|睡眠|麻醉/.test(desc)) add('control')
    if (/返场|换入|换下|替换|出战编队/.test(desc)) add('pivot')
    if (/亲密|同乘|采集|挖矿|捕捉|经验|家园|灵感|范围/.test(desc)) add('support')
    if (tags.length === 0 && /攻击|伤害|暴击|威力|致命/.test(desc)) add('attack')
  }

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

function skillId(name) {
  return `rock-skill-${createHash('sha1').update(String(name)).digest('hex').slice(0, 12)}`
}

function skillLearnTypeLabel(kind) {
  return { s: '自带', b: '血脉', t: '技能石' }[kind] || kind
}

function skillLearnTypeValue(kind) {
  return { s: 'innate', b: 'bloodline', t: 'stone' }[kind] || 'other'
}

function skillCategoryValue(tp) {
  if (/物理|物攻/.test(tp || '')) return 'physical'
  if (/魔法|魔攻|特殊/.test(tp || '')) return 'magical'
  if (/变化|状态|辅助|防御/.test(tp || '')) return 'status'
  return ''
}

function skillElementValue(el) {
  if (!el) return ''
  return ELEMENT_MAP.get(el) || ''
}

function normalizeSkillList(detail) {
  const result = []
  for (const kind of ['s', 'b', 't']) {
    const list = Array.isArray(detail?.sk?.[kind]) ? detail.sk[kind] : []
    for (const skill of list) {
      if (!skill?.nm) continue
      result.push({ ...skill, learnKind: kind })
    }
  }
  return result
}

function skillText(skill) {
  const pieces = [
    `${skillLearnTypeLabel(skill.learnKind)}${skill.lv != null ? `Lv.${skill.lv}` : ''}`,
    skill.nm,
    skill.tp,
    skill.el,
    skill.ec != null ? `能耗${skill.ec}` : '',
    skill.pw != null ? `威力${skill.pw}` : '',
    skill.ef,
  ].filter(Boolean)
  return pieces.join('｜')
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
  const detail = data.d[String(sourceId)] || source || {}
  const no = source.n || base.n || parseNoFromImage(source.img) || parseNoFromImage(base.img)
  const element = [source.e || base.e, source.e2 || base.e2].filter(Boolean).map((cn) => {
    const value = ELEMENT_MAP.get(cn)
    if (!value) throw new Error(`未知系别：${cn}（source id ${sourceId}）`)
    return value
  })
  const traitName = detail.tn || ''
  const skills = normalizeSkillList(detail)
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
      traitTags: deriveTags(detail.te || '', {
        hp: detail.hp,
        patk: detail.atk,
        matk: detail.matk,
        pdef: detail.df,
        mdef: detail.mdf,
        spd: detail.spd,
      }),
      traitIcon: traitName && data._tm[traitName] ? fullUrl(data._tm[traitName]) : '',
      traitDesc: detail.te || '',
      skills: skills.map(skillText).join('\n'),
      coreSkill: skills[0]?.nm ? skillId(skills[0].nm) : '',
      hp: detail.hp ?? 0,
      patk: detail.atk ?? 0,
      matk: detail.matk ?? 0,
      pdef: detail.df ?? 0,
      mdef: detail.mdf ?? 0,
      spd: detail.spd ?? 0,
    },
  }
}

function buildSkillRows(data) {
  const byId = new Map()
  for (const base of data.l) {
    const detail = data.d[String(base.i)] || {}
    const sources = [detail, ...(detail.forms || []).map((form) => data.d[String(form.i)] || form)]
    for (const sourceDetail of sources) {
      for (const skill of normalizeSkillList(sourceDetail)) {
        const id = skillId(skill.nm)
        const existing = byId.get(id)
        const learnMethod = skillLearnTypeValue(skill.learnKind)
        const learnLevel = skill.lv != null ? String(skill.lv) : ''
        if (existing) {
          if (learnMethod && !existing.values.learnMethod.includes(learnMethod)) existing.values.learnMethod.push(learnMethod)
          if (learnLevel && !existing.values.learnLevel.split(' / ').includes(learnLevel)) {
            existing.values.learnLevel = [existing.values.learnLevel, learnLevel].filter(Boolean).join(' / ')
          }
          continue
        }
        byId.set(id, {
          id,
          values: {
            name: skill.nm,
            element: skillElementValue(skill.el),
            category: skillCategoryValue(skill.tp),
            learnMethod: learnMethod ? [learnMethod] : [],
            learnLevel,
            power: skill.pw ?? '',
            cost: skill.ec ?? '',
            priority: '',
            effect: skill.ef || '',
          },
        })
      }
    }
  }
  return [...byId.values()].sort((a, b) => String(a.values.name).localeCompare(String(b.values.name), 'zh-Hans-CN'))
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
const skillRows = buildSkillRows(data)
printStats(rows, baseCount, formCount)
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
await writeFile(skillOutputPath, `${JSON.stringify(skillRows, null, 2)}\n`, 'utf8')
console.log(`wrote ${path.relative(repoRoot, outputPath)}`)
console.log(`wrote ${path.relative(repoRoot, skillOutputPath)} (${skillRows.length} skills)`)
