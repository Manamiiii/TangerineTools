// 将通用资料表行转换为性格推荐输入；不依赖 React 或 Dexie。

import { findFieldByKeyOrName, getStatsValues, optionLabel } from '../utils.js'
import { STATS_DIMENSIONS } from '../constants.js'
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

function normalizedSet(value) {
  return [...new Set(Array.isArray(value) ? value : value ? [value] : [])].sort()
}

function formAnalysisSignature(row, fields) {
  return JSON.stringify({
    stats: extractStatsFromRow(row, fields),
    elements: normalizedSet(row.values?.element),
    traitName: row.values?.traitName || '',
    traitDesc: row.values?.traitDesc || '',
    traitTags: normalizedSet(extractTraitTagsFromRow(row, fields)),
    skillRefs: normalizedSet(extractSkillRefsFromRow(row, fields)),
  })
}

export function buildFormAnalysis(target, formRows = [], fields = [], skillRows = []) {
  const targetStats = extractStatsFromRow(target, fields) || {}
  const targetTraitTags = normalizedSet(extractTraitTagsFromRow(target, fields))
  const targetSkillRefs = normalizedSet(extractSkillRefsFromRow(target, fields))
  const skillById = new Map((skillRows || []).map((row) => [row.id, row.values?.name || row.id]))
  const elementField = findFieldByKeyOrName(fields || [], ['element'], ['系别'])
  const elementOption = (value) => {
    const option = elementField?.options?.find((item) => item.value === value)
    return option || { value, label: optionLabel(elementField, value) }
  }
  const targetElementValues = normalizedSet(target.values?.[elementField?.key])
  const forms = formRows.map((row) => {
    const stats = extractStatsFromRow(row, fields) || {}
    const statChanges = STATS_DIMENSIONS.flatMap(({ key, label }) => {
      const delta = Number(stats[key] || 0) - Number(targetStats[key] || 0)
      return delta === 0 ? [] : [{ key, label, from: Number(targetStats[key] || 0), to: Number(stats[key] || 0), delta }]
    })
    const traitTags = normalizedSet(extractTraitTagsFromRow(row, fields))
    const skillRefs = normalizedSet(extractSkillRefsFromRow(row, fields))
    const traitChanged =
      String(row.values?.traitName || '') !== String(target.values?.traitName || '') ||
      String(row.values?.traitDesc || '') !== String(target.values?.traitDesc || '') ||
      JSON.stringify(traitTags) !== JSON.stringify(targetTraitTags)
    const traitNameChanged = String(row.values?.traitName || '') !== String(target.values?.traitName || '')
    const summary = extractRowSummary(row, fields)
    const elementValues = normalizedSet(row.values?.[elementField?.key])
    const elements = elementValues.map(elementOption)
    return {
      id: row.id,
      name: summary.name,
      form: summary.form,
      image: row.values?.image || '',
      elements,
      stats,
      traitIcon: row.values?.traitIcon || '',
      traitName: row.values?.traitName || '无特性',
      traitDesc: row.values?.traitDesc || '',
      traitTags,
      skillNames: skillRefs.map((id) => skillById.get(id) || id),
      skillRefs,
      statChanges,
      traitChanged,
      traitFrom: target.values?.traitName || '无',
      traitTo: row.values?.traitName || '无',
      traitChangeText: traitNameChanged
        ? `${target.values?.traitName || '无'} → ${row.values?.traitName || '无'}`
        : '名称相同，效果描述或标签发生变化',
      addedSkillCount: skillRefs.filter((id) => !targetSkillRefs.includes(id)).length,
      removedSkillCount: targetSkillRefs.filter((id) => !skillRefs.includes(id)).length,
      sameAsTarget:
        statChanges.length === 0 &&
        !traitChanged &&
        JSON.stringify(skillRefs) === JSON.stringify(targetSkillRefs) &&
        JSON.stringify(elementValues) === JSON.stringify(targetElementValues),
    }
  })
  const skillOccurrences = new Map()
  for (const form of forms) {
    for (const skillId of form.skillRefs) skillOccurrences.set(skillId, (skillOccurrences.get(skillId) || 0) + 1)
  }
  for (const form of forms) {
    form.uniqueSkillNames = form.skillRefs
      .filter((skillId) => skillOccurrences.get(skillId) === 1)
      .map((skillId) => skillById.get(skillId) || skillId)
  }
  const signatures = new Set(formRows.map((row) => formAnalysisSignature(row, fields)))
  return {
    targetName: extractRowSummary(target, fields).name,
    forms,
    allFormsEquivalent: formRows.length > 1 && signatures.size === 1,
    hasObviousDifferences: forms.some((form) => !form.sameAsTarget),
  }
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)))
  return sorted[index]
}

export function buildPopulationStatSummary(rows = [], fields = [], target = null) {
  const validRows = rows.filter((row) => {
    const stats = extractStatsFromRow(row, fields)
    return stats && STATS_DIMENSIONS.every((dimension) => Number(stats[dimension.key]) > 0)
  })
  const targetStats = target ? extractStatsFromRow(target, fields) || {} : {}
  return {
    count: validRows.length,
    dimensions: STATS_DIMENSIONS.map((dimension) => {
      const values = validRows.map((row) => Number(extractStatsFromRow(row, fields)?.[dimension.key]) || 0).sort((a, b) => a - b)
      const value = Number(targetStats[dimension.key]) || 0
      const atOrBelow = values.filter((item) => item <= value).length
      return {
        ...dimension,
        value,
        rank: values.length ? values.length - values.findIndex((item) => item >= value) : 0,
        percentile: values.length ? Math.round((atOrBelow / values.length) * 100) : 0,
        min: values[0] || 0,
        p25: percentile(values, .25),
        p50: percentile(values, .5),
        p75: percentile(values, .75),
        max: values.at(-1) || 0,
      }
    }),
  }
}

export function buildNatureAnalysisInput(target, formRows = [], fields = [], skillRows = []) {
  if (!target) return null
  const relatedRows = [target, ...(formRows || []).filter((row) => row.id !== target.id)]
  const summary = extractRowSummary(target, fields)
  const profiles = relatedRows
    .filter((row) => Object.values(extractStatsFromRow(row, fields) || {}).some((value) => Number(value) > 0))
    .map((row) => {
      const rowSummary = extractRowSummary(row, fields)
      return {
        id: row.id,
        name: rowSummary.name,
        form: rowSummary.form,
        label: [rowSummary.name, rowSummary.form].filter(Boolean).join(' · '),
        stats: extractStatsFromRow(row, fields),
        traitTags: extractTraitTagsFromRow(row, fields),
        skillInfo: uniqueSkillInfo([row], fields, skillRows, true),
      }
    })
  return {
    name: summary.name,
    stats: extractStatsFromRow(target, fields),
    traitTags: [...new Set(relatedRows.flatMap((row) => extractTraitTagsFromRow(row, fields)))],
    skillInfo: uniqueSkillInfo(relatedRows, fields, skillRows, formRows.length > 0),
    analysisProfiles: profiles.filter((profile) => profile.id !== target.id),
    formProfiles: profiles,
    formAnalysis: buildFormAnalysis(target, relatedRows, fields, skillRows),
  }
}
