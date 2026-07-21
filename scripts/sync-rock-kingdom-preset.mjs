#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deriveSkillEffectTags, deriveSkillTags, deriveTraitTags } from './lib/rock-kingdom-tags.mjs'

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
const breedingRowsPath = path.join(repoRoot, 'public/presets/rockKingdomBreedingRows.json')

function fullUrl(assetPath) {
  if (!assetPath) return ''
  return new URL(assetPath.split('/').map(encodeURIComponent).join('/'), ASSET_BASE).href
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
  const name = source.fn || source.nm || pickEvoValue(detail, sourceId, 'fn') || pickEvoValue(detail, sourceId, 'nm') || ''
  const evolutionLine = evolutionLookup.get(String(sourceId)) || (name ? [name] : [])
  return {
    id: `rock-creature-src-${String(sourceId).padStart(3, '0')}`,
    values: {
      image: fullUrl(source.img || base.img),
      name,
      no,
      element,
      form: source.f || source.s || pickEvoValue(detail, sourceId, 's') || base.s || '',
      bst: detail.rt ?? source.rt ?? 0,
      shiny: source.sh === 1 ? 'yes' : 'no',
      traitName,
      traitTags: deriveTraitTags(detail.te || '', {
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
      speciesGroup: evolutionLine[0] || '',
      eggGroups: [],
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


function normalizeBreedingName(name) {
  return String(name || '').replace(/（.*?）/g, '').trim()
}

function mergeEggGroups(...groupLists) {
  return [...new Set(groupLists.flatMap((groups) => Array.isArray(groups) ? groups : []))]
}

function propagateEggGroupsToSameNumber(rows) {
  const byNo = new Map()
  for (const row of rows) {
    const no = row.values.no
    if (!no || !Array.isArray(row.values.eggGroups) || row.values.eggGroups.length === 0) continue
    byNo.set(no, mergeEggGroups(byNo.get(no), row.values.eggGroups))
  }
  let propagated = 0
  for (const row of rows) {
    const noGroups = byNo.get(row.values.no)
    if (!noGroups?.length) continue
    const mergedGroups = mergeEggGroups(row.values.eggGroups, noGroups)
    if (mergedGroups.length === (row.values.eggGroups || []).length) continue
    row.values.eggGroups = mergedGroups
    if (!row.values.speciesGroup) row.values.speciesGroup = row.values.breedingLine || row.values.evolutionLine?.[0] || row.values.name
    propagated += 1
  }
  return propagated
}

async function applyBreedingSnapshot(rows) {
  let payload
  try {
    payload = JSON.parse(await readFile(breedingRowsPath, 'utf8'))
  } catch {
    return { matched: 0, propagated: 0, total: 0 }
  }
  const breedingRows = Array.isArray(payload?.rows) ? payload.rows : []
  const byId = new Map(breedingRows.map((row) => [row.id, row]))
  const byName = new Map(breedingRows.map((row) => [row.name, row]))
  const byBaseName = new Map()
  for (const row of breedingRows) {
    const baseName = normalizeBreedingName(row.name)
    if (baseName && !byBaseName.has(baseName)) byBaseName.set(baseName, row)
  }
  const byLine = new Map()
  for (const row of breedingRows) {
    if (row.speciesGroup && Array.isArray(row.eggGroups) && row.eggGroups.length > 0 && !byLine.has(row.speciesGroup)) {
      byLine.set(row.speciesGroup, row)
    }
  }
  let matched = 0
  for (const row of rows) {
    const line = row.values.breedingLine || row.values.evolutionLine?.[0]
    const hit = byId.get(row.id) || byName.get(row.values.name) || byBaseName.get(normalizeBreedingName(row.values.name)) || byLine.get(line)
    if (!hit?.eggGroups?.length) continue
    const mergedGroups = mergeEggGroups(row.values.eggGroups, hit.eggGroups)
    if (mergedGroups.length !== (row.values.eggGroups || []).length) {
      row.values.eggGroups = mergedGroups
      matched += 1
    }
    row.values.speciesGroup = line || hit.speciesGroup || row.values.name
  }
  const propagated = propagateEggGroupsToSameNumber(rows)
  return { matched, propagated, total: breedingRows.length }
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
if (breedingSnapshotStats.total > 0) console.log(`breeding snapshot matched rows: ${breedingSnapshotStats.matched}/${rows.length}; propagated same-number rows: ${breedingSnapshotStats.propagated}; supplemental rows: ${breedingSnapshotStats.total}`)
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
await writeFile(skillOutputPath, `${JSON.stringify(skillRows, null, 2)}\n`, 'utf8')
console.log(`wrote ${path.relative(repoRoot, outputPath)}`)
console.log(`wrote ${path.relative(repoRoot, skillOutputPath)} (${skillRows.length} skills)`)
