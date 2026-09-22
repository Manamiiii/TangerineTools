// 洛克王国资料表专用纯函数：识别"编号"字段、聚合同编号的不同形态行，
// 提供形态排序与资料分组。不依赖 Dexie / React。

import { NUMBER_FIELD_KEYS, NUMBER_FIELD_NAMES } from '../constants.js'
import { naturalCompare } from '../utils.js'

const FORM_STAGE_NUMBERS = new Map([
  ['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5],
  ['Ⅰ', 1], ['Ⅱ', 2], ['Ⅲ', 3], ['Ⅳ', 4], ['Ⅴ', 5],
  ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5],
])

function stageNumber(form) {
  const normalized = String(form ?? '').trim().toUpperCase()
  const matched = normalized.match(/^(III|II|IV|[IVⅠⅡⅢⅣⅤ一二三四五]|\d+)阶(?:形态)?$/)
  if (!matched) return null
  return FORM_STAGE_NUMBERS.get(matched[1]) ?? Number(matched[1])
}

function formSortKey(form) {
  const stage = stageNumber(form)
  if (stage != null) return [0, stage]
  if (form === '最终形态') return [2, 0]
  if (form === '首领形态') return [3, 0]
  return [1, 0]
}

function nameVariant(name) {
  return String(name ?? '').match(/（([^）]+)）/)?.[1]?.trim() ?? ''
}

export function pairRockKingdomComparisonForms(forms = []) {
  const groups = new Map()
  for (const form of forms) {
    const variant = nameVariant(form?.name)
    const key = variant || 'base'
    if (!groups.has(key)) groups.set(key, { key, variant, ordinary: [], bosses: [] })
    const group = groups.get(key)
    if (form?.form === '首领形态') group.bosses.push(form)
    else group.ordinary.push(form)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    forms: [...group.ordinary, ...group.bosses],
    paired: group.ordinary.length === 1 && group.bosses.length === 1,
  }))
}

export function compareRockKingdomCreatureRows(a, b) {
  const numberDiff = naturalCompare(a?.values?.no, b?.values?.no)
  if (numberDiff !== 0) return numberDiff
  const aFormKey = formSortKey(a?.values?.form)
  const bFormKey = formSortKey(b?.values?.form)
  const bucketDiff = aFormKey[0] - bFormKey[0]
  if (bucketDiff !== 0) return bucketDiff
  const stageDiff = aFormKey[1] - bFormKey[1]
  if (stageDiff !== 0) return stageDiff
  const variantDiff = Number(Boolean(nameVariant(a?.values?.name))) - Number(Boolean(nameVariant(b?.values?.name)))
  if (variantDiff !== 0) return variantDiff
  return naturalCompare(a?.values?.name, b?.values?.name) || naturalCompare(a?.id, b?.id)
}

export function isRockKingdomNatureSelectableRow(row) {
  const form = String(row?.values?.form ?? '').trim()
  return form !== '首领形态' && stageNumber(form) == null
}

function evolutionLineEndsWithRow(row) {
  const line = row?.values?.evolutionLine
  const members = (Array.isArray(line) ? line : String(line ?? '').split(/→|->/))
    .map((item) => String(item).trim().replace(/^（|）$/g, ''))
    .filter(Boolean)
  if (members.length === 0) return false
  const rowName = String(row?.values?.name ?? '').replace(/（[^）]+）/g, '').trim()
  const lastName = members.at(-1).replace(/（[^）]+）/g, '').trim()
  return Boolean(rowName && lastName === rowName)
}

export function relatedRockKingdomBossRows(target, rows = []) {
  if (!target) return []
  const targetNo = String(target.values?.no ?? '').trim()
  if (!targetNo) return []
  const bosses = rows.filter((row) =>
    row.id !== target.id &&
    String(row.values?.no ?? '').trim() === targetNo &&
    row.values?.form === '首领形态')
  const variant = nameVariant(target.values?.name)
  if (variant) {
    const matched = bosses.filter((row) => nameVariant(row.values?.name) === variant)
    if (matched.length > 0) return matched.sort(compareRockKingdomCreatureRows)
  }
  if (!variant) {
    const withoutVariant = bosses.filter((row) => !nameVariant(row.values?.name))
    if (withoutVariant.length > 0) return withoutVariant.sort(compareRockKingdomCreatureRows)
  }
  return bosses.sort(compareRockKingdomCreatureRows)
}

// BWiki 正式预置展开主形态/地区形态前的 29 个稳定行 id 不再进入当前预置。
// 保留这些行本身以兼容旧 owned / stock 引用，但在资料选择与统计视图中隐藏，
// 避免已有浏览器同时显示旧概括行和新版精确形态行。
export const SUPERSEDED_CREATURE_ROW_ALIASES = new Map([
  ['rock-creature-src-448', 'rock-creature-bwiki-aef4b3565565'],
  ['rock-creature-src-017', 'rock-creature-bwiki-bf820721eb70'],
  ['rock-creature-src-018', 'rock-creature-bwiki-b44ab058ef4a'],
  ['rock-creature-src-019', 'rock-creature-bwiki-bde230d40211'],
  ['rock-creature-src-023', 'rock-creature-bwiki-836ff913b5bd'],
  ['rock-creature-src-024', 'rock-creature-bwiki-9ab657c3a5f5'],
  ['rock-creature-src-025', 'rock-creature-bwiki-879f28cfa0d4'],
  ['rock-creature-src-029', 'rock-creature-bwiki-c4d9725d943a'],
  ['rock-creature-src-030', 'rock-creature-bwiki-35640a657332'],
  ['rock-creature-src-031', 'rock-creature-bwiki-9e205d79234f'],
  ['rock-creature-src-452', 'rock-creature-bwiki-ad9d45c9053a'],
  ['rock-creature-src-455', 'rock-creature-bwiki-412274db18b2'],
  ['rock-creature-src-081', 'rock-creature-bwiki-aecb348a0459'],
  ['rock-creature-src-082', 'rock-creature-bwiki-35ea1fc47290'],
  ['rock-creature-src-083', 'rock-creature-bwiki-73bc337cb100'],
  ['rock-creature-src-151', 'rock-creature-bwiki-42dd2222ede0'],
  ['rock-creature-src-406', 'rock-creature-src-168'],
  ['rock-creature-src-407', 'rock-creature-src-169'],
  ['rock-creature-src-464', 'rock-creature-bwiki-7023282bddac'],
  ['rock-creature-src-217', 'rock-creature-bwiki-fcb42a4498f3'],
  ['rock-creature-src-419', 'rock-creature-bwiki-fcb42a4498f3'],
  ['rock-creature-src-218', 'rock-creature-bwiki-1ded386ad277'],
  ['rock-creature-src-420', 'rock-creature-bwiki-1ded386ad277'],
  ['rock-creature-src-439', 'rock-creature-bwiki-397d55675ef5'],
  ['rock-creature-src-440', 'rock-creature-bwiki-397d55675ef5'],
  ['rock-creature-src-441', 'rock-creature-bwiki-e4c7904c7a66'],
  ['rock-creature-src-442', 'rock-creature-bwiki-e4c7904c7a66'],
  ['rock-creature-src-443', 'rock-creature-bwiki-f1eb31e3f8a3'],
  ['rock-creature-src-444', 'rock-creature-bwiki-f1eb31e3f8a3'],
])

function naturalCreatureKey(row) {
  const values = row?.values ?? {}
  return [values.no, values.name, values.form].map((value) => String(value ?? '').trim()).join('::')
}

export function visibleRockKingdomCreatureRows(rows = []) {
  const allIds = new Set(rows.map((row) => row.id))
  const withoutSuperseded = rows.filter((row) => {
    const replacementId = SUPERSEDED_CREATURE_ROW_ALIASES.get(row.id)
    return !replacementId || !allIds.has(replacementId)
  })
  const canonicalKeys = new Set(withoutSuperseded
    .filter((row) => /^rock-creature-(?:src|bwiki)-/.test(row.id || ''))
    .map(naturalCreatureKey))
  const seen = new Set()
  return withoutSuperseded.filter((row) => {
    const key = naturalCreatureKey(row)
    const isCanonical = /^rock-creature-(?:src|bwiki)-/.test(row.id || '')
    if (!isCanonical && canonicalKeys.has(key)) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 性格页每个编号只提供一个普通入口；地区/外观变体与首领形态仍由同编号
// 对比和综合分析完整纳入。优先选择没有括号变体名的最终形态，缺少时取
// 排序最靠前的可培养形态。
export function primaryRockKingdomNatureRows(rows = []) {
  const groups = new Map()
  for (const row of [...rows].sort(compareRockKingdomCreatureRows)) {
    const no = String(row?.values?.no ?? '').trim() || row.id
    if (!groups.has(no)) groups.set(no, [])
    groups.get(no).push(row)
  }
  return [...groups.values()].map((group) => {
    const explicitCandidates = group.filter(isRockKingdomNatureSelectableRow)
    if (explicitCandidates.length > 0) {
      return explicitCandidates.find((row) => !nameVariant(row?.values?.name)) ||
        [...explicitCandidates].sort((a, b) => naturalCompare(a.id, b.id))[0]
    }
    const ordinaryStages = group.filter((row) =>
      row.values?.form !== '首领形态' && stageNumber(row.values?.form) != null)
    if (ordinaryStages.length === 0) return null
    const latestStage = Math.max(...ordinaryStages.map((row) => stageNumber(row.values?.form)))
    const latestRows = ordinaryStages.filter((row) => stageNumber(row.values?.form) === latestStage)
    const onlyBossesFollow = group.some((row) => row.values?.form === '首领形态')
    if (!onlyBossesFollow && !latestRows.some(evolutionLineEndsWithRow)) return null
    return latestRows.find((row) => !nameVariant(row?.values?.name)) ||
      [...latestRows].sort((a, b) => naturalCompare(a.id, b.id))[0]
  }).filter(Boolean)
}

// 同一进化链中的任一阶段都代表玩家已经拥有该物种。性格页用这张映射把
// 非最终形态的收集记录归并到最终形态；缺少进化链资料时仍只匹配原行 id。
export function buildEvolutionReferenceGroups(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    const line = String(row?.values?.evolutionLine || '').trim()
    if (!line) continue
    const ids = groups.get(line) || []
    ids.push(row.id)
    groups.set(line, ids)
  }
  return new Map(rows.map((row) => {
    const line = String(row?.values?.evolutionLine || '').trim()
    return [row.id, line && groups.get(line)?.length ? groups.get(line) : [row.id]]
  }))
}

// 识别当前资料表的"编号"字段：优先按字段 key（no / number）识别，
// 找不到再按字段展示名"编号"识别；都没有则返回 null。
export function findNumberField(fields) {
  if (!Array.isArray(fields)) return null
  const byKey = fields.find((f) => NUMBER_FIELD_KEYS.includes(f.key))
  if (byKey) return byKey
  return fields.find((f) => NUMBER_FIELD_NAMES.includes(f.name)) || null
}

// 找出与当前行"编号"字段值相同的所有行（含当前行自身），
// 按成长阶段 -> 普通变体 -> 最终形态 -> 首领形态排列。
// 没有编号字段、或当前行编号为空时返回空数组（表示无法/无需对比）。
export function getSameNumberRows(currentRow, rows, fields) {
  const numberField = findNumberField(fields)
  if (!numberField || !currentRow) return []
  const currentNo = currentRow.values?.[numberField.key]
  if (currentNo == null || currentNo === '') return []
  return (rows || [])
    .filter((r) => r.values?.[numberField.key] === currentNo)
    .sort(compareRockKingdomCreatureRows)
}
