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
const STAT_THRESHOLDS = {
  hp: { p50: 91, p75: 110, p90: 126 },
  pdef: { p50: 82, p75: 102, p90: 121 },
  mdef: { p50: 82, p75: 101, p90: 120 },
  bulk: { p75: 301, p90: 338 },
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outputPath = path.join(repoRoot, 'public/presets/rockKingdomRows.json')
const skillOutputPath = path.join(repoRoot, 'public/presets/rockKingdomSkillRows.json')
const breedingRowsPath = path.join(repoRoot, 'public/presets/rockKingdomBreedingRows.json')

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
  const hasTopBulk = bulk >= STAT_THRESHOLDS.bulk.p90 || hp >= STAT_THRESHOLDS.hp.p90
  const hasBalancedBulk =
    (bulk >= STAT_THRESHOLDS.bulk.p75 && hp >= STAT_THRESHOLDS.hp.p50 &&
      (pdef >= STAT_THRESHOLDS.pdef.p75 || mdef >= STAT_THRESHOLDS.mdef.p75)) ||
    (hp >= STAT_THRESHOLDS.hp.p75 && (pdef >= STAT_THRESHOLDS.pdef.p50 || mdef >= STAT_THRESHOLDS.mdef.p50))
  if (hasTopBulk || hasBalancedBulk) add('defense')

  if (desc) {
    if (/回复|恢复|生命|治疗|回血|保留1点生命/.test(desc)) add('support')
    if (/能量|能耗|回复\d*能量|获得\d*能量/.test(desc)) add('energyCycle')
    if (/克制|抵触/.test(desc)) add('counterGain')
    if (/速度\+\d+|获得速度|速度提升/.test(desc)) add('conditionalSpeedBoost')
    if (/迅捷/.test(desc)) add('swiftSkill')
    if (/强化|永久\+|\+20%|\+70%|提升|增加/.test(desc)) add('growth')
    if (/护盾|减伤|防御|免疫|抵免/.test(desc)) add('shieldReduce')
    if (/冻结|中毒|灼烧|异常|恐惧|控制|污染|睡眠|麻醉/.test(desc)) add('control')
    if (/返场|换入|换下|替换|出战编队/.test(desc)) add('pivot')
    if (/亲密|同乘|采集|挖矿|捕捉|经验|家园|灵感|范围/.test(desc)) add('support')
    if (tags.length === 0 && /攻击|伤害|暴击|威力|致命/.test(desc)) add('attack')
  }

  return tags.length > 0 ? tags : ['special']
}

function deriveSkillTags(skillTexts = []) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag)) tags.push(tag)
  }
  const skillJoined = skillTexts.join('\n')
  const physicalSkillCount = skillTexts.filter((text) => /物攻|物理|物伤/.test(text)).length
  const magicalSkillCount = skillTexts.filter((text) => /魔攻|魔法|魔伤/.test(text)).length
  if (physicalSkillCount > 0) add('physicalMoves')
  if (magicalSkillCount > 0) add('magicalMoves')
  if (physicalSkillCount >= 4 && magicalSkillCount >= 4) add('mixedMoves')
  if (physicalSkillCount >= magicalSkillCount + 3) add('physicalLean')
  if (magicalSkillCount >= physicalSkillCount + 3) add('magicalLean')
  if (/先手|迅捷|速度\+|速度-/.test(skillJoined)) add('speed')
  if (/后手|反击|受到攻击后|承受.*后/.test(skillJoined)) add('slowBenefit')
  if (/中毒|冻结|麻痹|眩晕|恐惧|睡眠|控制|驱散|打断/.test(skillJoined)) add('control')
  if (/回复|生命|治疗|吸血/.test(skillJoined)) add('support')
  if (/能量|能耗|迸发|传动/.test(skillJoined)) add('energyCycle')
  if (/防御|护盾|减伤|承伤/.test(skillJoined)) add('defense')
  return tags
}

function deriveSkillEffectTags(skill = {}) {
  const tags = []
  const add = (tag) => {
    if (!tags.includes(tag)) tags.push(tag)
  }
  const text = [skill.nm, skill.tp, skill.ef].filter(Boolean).join(' ')

  if (/先手|优先|抢先|迅捷/.test(text)) add('priority')
  if (/迅捷/.test(text)) add('swift')
  if (/迅捷|速度[+-]|速度提升|速度降低|先手|高速/.test(text)) add('speed')
  if (/回复|恢复|治疗|吸血|生命/.test(text)) add('healing')
  if (/防御|护盾|减伤|承伤|抵抗|免疫/.test(text)) add('damageReduction')
  if (/回复\d*能量|获得\d*能量|能量回复|迸发/.test(text)) add('energyGain')
  if (/偷取.*能量|失去\d*能量|扣.*能量|能量减少/.test(text)) add('energyDrain')
  if (/能耗[+-]|费用[+-]|消耗[+-]|全技能能耗/.test(text)) add('costChange')
  if (/物攻\+|魔攻\+|双攻\+|物防\+|魔防\+|双防\+|威力\+|强化|提升|增加/.test(text)) add('statBoost')
  if (/继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(text)) add('boostTransfer')
  if (/物攻-|魔攻-|双攻-|物防-|魔防-|双防-|速度-|削弱|降低|减少/.test(text)) add('statDebuff')
  if (/中毒|剧毒|灼烧|烧伤|冻结|冰冻|睡眠|恐惧|麻痹|混乱|沉默|束缚|异常|控制/.test(text)) add('control')
  if (/应对攻击|反击|受到攻击后|承受.*后/.test(text)) add('counterAttack')
  if (/应对防御/.test(text)) add('counterDefense')
  if (/应对状态/.test(text)) add('counterStatus')
  if (/脱离|换入|换场|换下|返场|替换/.test(text)) add('pivot')
  if (/\d+\s*连击|连击/.test(text)) add('multiHit')
  if (/蓄力/.test(text)) add('charge')
  if (/天气|场地|雨|雪|沙暴|放晴/.test(text)) add('fieldEffect')

  return tags
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

function skillCategoryValue(tp) {
  if (/物理|物攻/.test(tp || '')) return 'physical'
  if (/魔法|魔攻|特殊/.test(tp || '')) return 'magical'
  if (/变化|状态|辅助|防御/.test(tp || '')) return 'status'
  return ''
}

function toNumberOrBlank(value) {
  if (value == null || value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : ''
}

function parsePriority(skill) {
  const text = [skill.ef, skill.nm].filter(Boolean).join(' ')
  const matched = text.match(/先手\s*([+-]?\d+)/)
  return matched ? `先手${matched[1]}` : ''
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
  if (!data?._skm || typeof data._skm !== 'object') throw new Error('数据源结构异常：缺少技能图标映射 _skm')
}

function buildEvolutionLookup(data) {
  const lookup = new Map()
  for (const detail of Object.values(data.d || {})) {
    const evo = Array.isArray(detail?.evo) ? detail.evo : []
    if (evo.length === 0) continue
    const names = evo.map((item) => item.fn || item.nm).filter(Boolean)
    const ids = evo.map((item) => String(item.i))
    for (const id of ids) lookup.set(id, names)
  }
  return lookup
}

function makeRow(data, source, base, evolutionLookup = new Map()) {
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
  const skillTexts = skills.map(skillText)
  const evolutionLine = evolutionLookup.get(String(sourceId)) || []
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
      skillTags: deriveSkillTags(skillTexts),
      skillRefs: [...new Set(skills.map((skill) => skillId(skill.nm)))],
      evolutionLine,
      breedingLine: evolutionLine[0] || '',
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
    const sources = [
      { source: base, detail },
      ...(detail.forms || []).map((form) => ({ source: form, detail: data.d[String(form.i)] || form })),
    ]
    for (const { source, detail: sourceDetail } of sources) {
      for (const skill of normalizeSkillList(sourceDetail)) {
        const id = skillId(skill.nm)
        const existing = byId.get(id)
        const learnerId = `rock-creature-src-${String(source.i).padStart(3, '0')}`
        if (existing) {
          if (learnerId && !existing.values.learnerRefs.includes(learnerId)) {
            existing.values.learnerRefs.push(learnerId)
          }
          continue
        }
        byId.set(id, {
          id,
          values: {
            image: skill.nm && data._skm[skill.nm] ? fullUrl(data._skm[skill.nm]) : '',
            name: skill.nm,
            element: skillElementValue(skill.el),
            category: skillCategoryValue(skill.tp),
            power: toNumberOrBlank(skill.pw),
            cost: toNumberOrBlank(skill.ec),
            priority: parsePriority(skill),
            effectTags: deriveSkillEffectTags(skill),
            effect: skill.ef || '',
            learnerRefs: learnerId ? [learnerId] : [],
          },
        })
      }
    }
  }
  return [...byId.values()].sort((a, b) => String(a.values.name).localeCompare(String(b.values.name), 'zh-Hans-CN'))
}

function hydrateBreedingLineFromOfficialRows(rows) {
  const byNo = new Map()
  for (const row of rows) byNo.set(row.values.no, [...(byNo.get(row.values.no) || []), row])
  for (const sameNoRows of byNo.values()) {
    const canonical = sameNoRows
      .filter((row) => Array.isArray(row.values.evolutionLine) && row.values.evolutionLine.length > 1)
      .sort((a, b) => String(a.values.name).localeCompare(String(b.values.name), 'zh-Hans-CN'))[0] || sameNoRows[0]
    if (!canonical) continue
    for (const row of sameNoRows) {
      if (!Array.isArray(row.values.evolutionLine) || row.values.evolutionLine.length <= 1) {
        row.values.evolutionLine = canonical.values.evolutionLine || [canonical.values.name]
      }
      row.values.breedingLine = row.values.evolutionLine?.[0] || canonical.values.breedingLine || canonical.values.name
    }
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
  const evolutionLookup = buildEvolutionLookup(data)
  for (const base of data.l) {
    rows.push(makeRow(data, base, base, evolutionLookup))
    for (const form of data.d[String(base.i)]?.forms || []) rows.push(makeRow(data, form, base, evolutionLookup))
  }
  hydrateBreedingLineFromOfficialRows(rows)
  const ids = rows.map((row) => row.id)
  if (new Set(ids).size !== ids.length) throw new Error('生成结果包含重复 id')
  return { rows, baseCount, formCount }
}

async function applyBreedingSnapshot(rows) {
  let payload
  try {
    payload = JSON.parse(await readFile(breedingRowsPath, 'utf8'))
  } catch {
    return { matched: 0, total: 0 }
  }
  const breedingRows = Array.isArray(payload?.rows) ? payload.rows : []
  const byId = new Map(breedingRows.map((row) => [row.id, row]))
  const byName = new Map(breedingRows.map((row) => [row.name, row]))
  const byLine = new Map()
  for (const row of breedingRows) {
    if (row.speciesGroup && Array.isArray(row.eggGroups) && row.eggGroups.length > 0 && !byLine.has(row.speciesGroup)) {
      byLine.set(row.speciesGroup, row)
    }
  }
  let matched = 0
  for (const row of rows) {
    const line = row.values.breedingLine || row.values.evolutionLine?.[0]
    const hit = byId.get(row.id) || byName.get(row.values.name) || byLine.get(line)
    if (!hit?.eggGroups?.length) continue
    row.values.eggGroups = [...hit.eggGroups]
    row.values.speciesGroup = line || hit.speciesGroup || row.values.name
    matched += 1
  }
  return { matched, total: breedingRows.length }
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
const breedingSnapshotStats = await applyBreedingSnapshot(rows)
const skillRows = buildSkillRows(data)
printStats(rows, baseCount, formCount)
if (breedingSnapshotStats.total > 0) console.log(`breeding snapshot matched rows: ${breedingSnapshotStats.matched}/${rows.length} from ${breedingSnapshotStats.total} supplemental rows`)
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
await writeFile(skillOutputPath, `${JSON.stringify(skillRows, null, 2)}\n`, 'utf8')
console.log(`wrote ${path.relative(repoRoot, outputPath)}`)
console.log(`wrote ${path.relative(repoRoot, skillOutputPath)} (${skillRows.length} skills)`)
