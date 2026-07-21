// 将通用资料表行转换为性格推荐输入；不依赖 React 或 Dexie。

import { findFieldByKeyOrName, getStatsValues, optionLabel } from '../utils.js'
import { findNumberField } from './rockKingdom.js'

// ---------------------------------------------------------------------------
// 从资料表行提取性格推荐所需信息（"从资料库带入"功能使用）。
// 均按字段 key 优先、名称兜底定位目标字段，不假设固定的资料表结构。
// ---------------------------------------------------------------------------

// 提取行的六维数值：复用 stats 类型字段的 statsMap 定位各原始数值字段。
// 资料表没有 stats 字段时返回 null，调用方应据此跳过六维带入。
export function extractStatsFromRow(row, fields) {
  const statsField = (fields || []).find((f) => f.type === 'stats')
  if (!statsField) return null
  return Object.fromEntries(
    getStatsValues(fields, statsField.statsMap, row.values).map((s) => [s.key, s.value]),
  )
}

// 提取行的特性标签（多选字段），字段缺失或值非数组时返回空数组。
export function extractTraitTagsFromRow(row, fields) {
  const field = findFieldByKeyOrName(fields || [], ['traitTags'], ['特性标签'])
  if (!field) return []
  const raw = row.values?.[field.key]
  return Array.isArray(raw) ? raw : []
}

function normalizeSkillCellValue(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  return String(value)
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}

// 提取技能/招式线索。优先读取结构化 skillRefs；用户自建资料表只要字段
// key/name 命中 skills/moves/技能/招式，也可进入规则引擎。
export function extractSkillInfoFromRow(row, fields) {
  const skillField = findFieldByKeyOrName(
    fields || [],
    ['skillRefs', 'skills', 'moves', 'skillList', 'moveList'],
    ['技能', '招式', '技能列表', '招式列表'],
  )
  if (skillField) {
    const skills = normalizeSkillCellValue(row.values?.[skillField.key])
    if (skills.length > 0) return { skills }
  }
  const traitDescField = findFieldByKeyOrName(fields || [], ['traitDesc'], ['特性说明', '特性描述'])
  return { skills: traitDescField ? normalizeSkillCellValue(row.values?.[traitDescField.key]) : [] }
}

export function extractSkillRefsFromRow(row, fields) {
  const skillField = findFieldByKeyOrName(
    fields || [],
    ['skillRefs'],
    ['可用技能', '技能引用', '技能列表'],
  )
  if (!skillField) return []
  const raw = row.values?.[skillField.key]
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export function extractSkillInfoFromReferenceRows(skillRows = []) {
  const skills = skillRows
    .map((row) => row?.values || row)
    .filter(Boolean)
    .map((values) => ({
      name: values.name,
      category: values.category,
      type: values.category,
      power: values.power,
      cost: values.cost,
      priority: values.priority,
      effectTags: Array.isArray(values.effectTags) ? values.effectTags : [],
      effect: values.effect,
      description: values.effect,
    }))
  return { skills }
}

// 提取行的名称/编号/形态摘要，用于行选择器里的展示文案。
export function extractRowSummary(row, fields) {
  const list = fields || []
  const nameField = findFieldByKeyOrName(list, ['name'], ['名称'])
  const numberField = findNumberField(list)
  const formField = findFieldByKeyOrName(list, ['form'], ['形态'])
  const name = nameField ? row.values?.[nameField.key] : ''
  const no = numberField ? row.values?.[numberField.key] : ''
  const formValue = formField ? row.values?.[formField.key] : null
  const form = formField && formValue != null ? optionLabel(formField, formValue) : ''
  return { name: name || '未命名', no: no || '', form }
}

function uniqueSkillInfo(rows, fields, skillRows, includeAllTraitText = false) {
  const refs = [...new Set(rows.flatMap((row) => extractSkillRefsFromRow(row, fields)))]
  const referenced = (skillRows || []).filter((row) => refs.includes(row.id))
  const skillInfo = referenced.length > 0
    ? extractSkillInfoFromReferenceRows(referenced)
    : { skills: rows.flatMap((row) => extractSkillInfoFromRow(row, fields).skills || []) }
  const traitTexts = rows.map((row) => String(row.values?.traitDesc || '').trim()).filter(Boolean)
  const traitText = [...new Set(traitTexts)].join('；')
  if (
    traitText &&
    (includeAllTraitText || /继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(traitText))
  ) skillInfo.traitText = traitText
  return skillInfo
}

export function buildNatureAnalysisInput(target, bossRows = [], fields = [], skillRows = []) {
  if (!target) return null
  const relatedRows = [target, ...(bossRows || [])]
  const summary = extractRowSummary(target, fields)
  return {
    name: summary.name,
    stats: extractStatsFromRow(target, fields),
    traitTags: [...new Set(relatedRows.flatMap((row) => extractTraitTagsFromRow(row, fields)))],
    skillInfo: uniqueSkillInfo(relatedRows, fields, skillRows, bossRows.length > 0),
    analysisProfiles: (bossRows || []).map((row) => ({
      name: extractRowSummary(row, fields).name,
      stats: extractStatsFromRow(row, fields),
      traitTags: extractTraitTagsFromRow(row, fields),
      skillInfo: uniqueSkillInfo([row], fields, skillRows, true),
    })),
  }
}
