// 性格推荐工具专用纯函数：基于原始六维 + 特性标签，推荐一组"强化/弱化"
// 五维（生命之外）搭配，并生成可解释的推荐理由。不依赖 Dexie / React。
//
// 设计说明：特性标签只用于在多个强化/弱化组合之间挑选最贴合精灵定位的一组，
// 不影响实际加成幅度——加成幅度固定为原始数值的 ±10%（applyNatureModifier）。
// 本工具的性格命名为自创的"X强化 · Y弱化"体系，不套用任何其他作品的译名。

import { STATS_DIMENSIONS } from '../constants.js'
import { findFieldByKeyOrName, getStatsValues, optionLabel } from '../utils.js'
import { findNumberField } from './rockKingdom.js'

// 性格系统只对生命以外的五维生效：生命数值区间大、缺乏"倾向性"语义，
// 强化/弱化生命难以直觉比较，故排除在外。
export const MODIFIABLE_STAT_KEYS = ['patk', 'matk', 'pdef', 'mdef', 'spd']

export const STAT_LABELS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, d.label]))

// 13 个特性标签对五维的倾向权重：0.5 = 轻度关联，1 = 主要关联，2 = 强关联。
// 只用于挑选推荐的强化/弱化方向，权重设计力求可解释、非黑盒。
export const TRAIT_TAG_STAT_WEIGHTS = {
  attack: { patk: 1, matk: 1 },
  patkLean: { patk: 2 },
  matkLean: { matk: 2 },
  spdLean: { spd: 2 },
  defense: { pdef: 1, mdef: 1 },
  support: { spd: 0.5 },
  energyCycle: { spd: 1 },
  counterGain: { patk: 0.5, matk: 0.5 },
  growth: { patk: 0.5, matk: 0.5 },
  shieldReduce: { pdef: 1, mdef: 1 },
  control: { spd: 1 },
  pivot: { spd: 1 },
  special: {},
}

// 每一点权重对"评分用数值"造成的相对偏移幅度。
const WEIGHT_UNIT = 0.15

// 汇总多个特性标签对五维的权重，未命中的标签权重按 0 处理。
function sumTraitWeights(traitTags = []) {
  const totals = Object.fromEntries(MODIFIABLE_STAT_KEYS.map((k) => [k, 0]))
  for (const tag of traitTags) {
    const weights = TRAIT_TAG_STAT_WEIGHTS[tag]
    if (!weights) continue
    for (const key of MODIFIABLE_STAT_KEYS) {
      totals[key] += weights[key] || 0
    }
  }
  return totals
}

// 计算所有"强化一项 + 弱化一项"组合的评分，按分数从高到低排序返回。
// 评分只用于挑选推荐方向，不影响 applyNatureModifier 的实际加成幅度。
// 数组第一项固定是"均衡"候选（不强化也不弱化，分数为 0）；Array#sort 是
// 稳定排序，因此当所有组合分数都 <= 0 时，均衡会排在最前——表示没有组合
// 能带来正向收益，建议保持均衡。
export function calculateNatureScores(baseStats = {}, traitTags = []) {
  const weights = sumTraitWeights(traitTags)
  const adjusted = {}
  for (const key of MODIFIABLE_STAT_KEYS) {
    const base = Number(baseStats[key]) || 0
    adjusted[key] = base * (1 + weights[key] * WEIGHT_UNIT)
  }

  const candidates = [{ raise: null, lower: null, score: 0 }]
  for (const raise of MODIFIABLE_STAT_KEYS) {
    for (const lower of MODIFIABLE_STAT_KEYS) {
      if (raise === lower) continue
      candidates.push({ raise, lower, score: adjusted[raise] - adjusted[lower] })
    }
  }

  return candidates.sort((a, b) => b.score - a.score)
}

// 对原始六维应用性格加成：强化项 ×1.1、弱化项 ×0.9，四舍五入取整；
// 其余维度（含生命）保持不变。均衡性格（raise/lower 均为 null）返回原值副本。
export function applyNatureModifier(baseStats = {}, nature) {
  const result = { ...baseStats }
  if (!nature || nature.raise == null || nature.lower == null) return result
  if (result[nature.raise] != null) {
    result[nature.raise] = Math.round(Number(result[nature.raise]) * 1.1)
  }
  if (result[nature.lower] != null) {
    result[nature.lower] = Math.round(Number(result[nature.lower]) * 0.9)
  }
  return result
}

// 性格名称：均衡性格没有强化/弱化项，直接展示"均衡"。
export function natureName(nature) {
  if (!nature || nature.raise == null || nature.lower == null) return '均衡'
  return `${STAT_LABELS[nature.raise]}强化 · ${STAT_LABELS[nature.lower]}弱化`
}

// 生成可解释的推荐理由：先说明原始数值本身的高低对比，再补充特性标签是
// "印证"了这个选择还是与之"冲突"（最终选择仍以综合评分为准）。
export function explainNatureRecommendation(
  nature,
  baseStats = {},
  traitTags = [],
  traitTagLabels = {},
) {
  if (!nature || nature.raise == null || nature.lower == null) {
    return '当前六维与特性标签没有明显的强弱倾向，建议保持均衡、不强化也不弱化任何一项。'
  }
  const raiseLabel = STAT_LABELS[nature.raise]
  const lowerLabel = STAT_LABELS[nature.lower]
  const raiseBase = Number(baseStats[nature.raise]) || 0
  const lowerBase = Number(baseStats[nature.lower]) || 0

  const segments = []
  if (raiseBase >= lowerBase) {
    segments.push(
      `原始${raiseLabel} ${raiseBase} 不低于${lowerLabel} ${lowerBase}，强化更高的一项收益更明显`,
    )
  } else {
    segments.push(
      `虽然原始${raiseLabel} ${raiseBase} 低于${lowerLabel} ${lowerBase}，但特性标签的倾向权重更支持强化${raiseLabel}`,
    )
  }

  const reinforcing = traitTags.filter(
    (tag) => (TRAIT_TAG_STAT_WEIGHTS[tag]?.[nature.raise] || 0) > 0,
  )
  const conflicting = traitTags.filter(
    (tag) =>
      (TRAIT_TAG_STAT_WEIGHTS[tag]?.[nature.lower] || 0) >
      (TRAIT_TAG_STAT_WEIGHTS[tag]?.[nature.raise] || 0),
  )

  if (reinforcing.length > 0) {
    const names = reinforcing.map((t) => traitTagLabels[t] || t).join('、')
    segments.push(`特性标签「${names}」印证了强化${raiseLabel}的选择`)
  }
  if (conflicting.length > 0) {
    const names = conflicting.map((t) => traitTagLabels[t] || t).join('、')
    segments.push(`标签「${names}」更偏向${lowerLabel}，但综合评分后${raiseLabel}仍是更优先的强化项`)
  }

  return `${segments.join('；')}。`
}

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
