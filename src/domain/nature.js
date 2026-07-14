// 性格推荐工具专用纯函数：基于原始六维 + 特性标签，评价 30 个合法性格
// 候选，并生成可解释的推荐 / 可保留 / 不推荐结论。不依赖 Dexie / React。

import { STATS_DIMENSIONS } from '../constants.js'
import { findFieldByKeyOrName, getStatsValues, optionLabel } from '../utils.js'
import { OWNED_NATURE_OPTIONS } from './owned.js'
import { findNumberField } from './rockKingdom.js'

const STAT_KEY_BY_CN = {
  生命: 'hp',
  物攻: 'patk',
  魔攻: 'matk',
  物防: 'pdef',
  魔防: 'mdef',
  速度: 'spd',
}

export const MODIFIABLE_STAT_KEYS = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
export const ATTACK_STAT_KEYS = ['patk', 'matk']
export const DEFENSE_STAT_KEYS = ['hp', 'pdef', 'mdef']

export const STAT_LABELS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, d.label]))

// 基于当前 496 条洛克王国预置资料（排除 0 值）得到的粗分位阈值。
// 后续若预置资料变化，可改为同步脚本生成静态统计表。
export const STAT_PERCENTILE_BANDS = {
  hp: { p10: 61, p25: 74, p50: 91, p75: 110, p90: 126 },
  patk: { p10: 38, p25: 58, p50: 83, p75: 103, p90: 122 },
  matk: { p10: 34, p25: 47, p50: 76, p75: 100, p90: 119 },
  pdef: { p10: 55, p25: 66, p50: 82, p75: 102, p90: 121 },
  mdef: { p10: 54, p25: 66, p50: 82, p75: 101, p90: 120 },
  spd: { p10: 51, p25: 65, p50: 84, p75: 100, p90: 115 },
}

export const BULK_PERCENTILE_BANDS = { p75: 301, p90: 338 }

export const SPEED_TIER_LABELS = {
  veryLow: '极慢',
  low: '偏慢',
  midLow: '中速偏慢',
  midHigh: '中速偏快',
  high: '高速',
  elite: '超高速',
}

export const SPEED_CONCERN_LABELS = {
  low: '低关注',
  medium: '中关注',
  high: '高关注',
}

// 最终面板公式预留位：当前不写死未知的洛克王国世界公式。
// 后续确认等级、个体、成长/努力等固定参数后，只需补齐这里并启用 calculateStandardStat。
export const STANDARD_STAT_FORMULA_PLACEHOLDER = {
  level: null,
  individual: null,
  growth: null,
  flatBonus: 5,
}

// 预置资料的速度并非连续分布，而是集中在一批固定/半固定速度点上。
// 速度线展示时使用这些锚点，避免只按连续百分位误判“刚好跨线”的价值。
export const SPEED_ANCHORS = [
  26, 30, 33, 35, 36, 39, 40, 42, 44, 45, 48, 50, 51, 52, 54, 55, 56, 57, 60, 63,
  64, 65, 66, 68, 69, 70, 72, 75, 76, 78, 80, 81, 84, 85, 88, 90, 92, 95,
  96, 100, 104, 105, 108, 110, 115, 120, 125, 130, 135, 145,
]

export const NATURE_DECISION_LABELS = {
  recommended: '推荐',
  keepable: '可保留',
  notRecommended: '不推荐',
}

// 特性标签对六维的倾向权重：0.5 = 轻度关联，1 = 主要关联，2 = 强关联。
// 只用于评价方向，不影响 applyNatureModifier 的实际加成幅度。
export const TRAIT_TAG_STAT_WEIGHTS = {
  attack: { patk: 1, matk: 1 },
  patkLean: { patk: 2 },
  matkLean: { matk: 2 },
  spdLean: { spd: 2 },
  conditionalSpeedBoost: { spd: 1.2 },
  swiftSkill: { spd: 1.5 },
  defense: { hp: 1, pdef: 0.9, mdef: 0.9 },
  support: { hp: 0.75, pdef: 0.5, mdef: 0.5, spd: 0.5 },
  energyCycle: { spd: 1, hp: 0.25 },
  counterGain: { patk: 0.5, matk: 0.5 },
  growth: { patk: 0.5, matk: 0.5 },
  shieldReduce: { hp: 1, pdef: 0.9, mdef: 0.9 },
  control: { spd: 1 },
  pivot: { spd: 1, hp: 0.5 },
  special: {},
}

const ROLE_DEFINITIONS = {
  physicalAttacker: {
    label: '物攻输出',
    core: { patk: 2, spd: 0.8 },
    expendable: { matk: 1.4 },
  },
  magicalAttacker: {
    label: '魔攻输出',
    core: { matk: 2, spd: 0.8 },
    expendable: { patk: 1.4 },
  },
  mixedAttacker: {
    label: '双攻输出',
    core: { patk: 1.4, matk: 1.4, spd: 0.6 },
    expendable: {},
  },
  fastAttacker: {
    label: '高速先手',
    core: { spd: 1.8 },
    expendable: {},
  },
  bulky: {
    label: '耐久站场',
    core: { hp: 1.3, pdef: 1, mdef: 1 },
    expendable: { spd: 0.3 },
  },
  physicalWall: {
    label: '物理防御手',
    core: { hp: 0.9, pdef: 1.7 },
    expendable: {},
  },
  magicalWall: {
    label: '魔法防御手',
    core: { hp: 0.9, mdef: 1.7 },
    expendable: {},
  },
  support: {
    label: '辅助控制',
    core: { hp: 0.9, spd: 0.8, pdef: 0.5, mdef: 0.5 },
    expendable: { patk: 0.4, matk: 0.4 },
  },
  energyCycle: {
    label: '能量循环',
    core: { spd: 1.3, hp: 0.5 },
    expendable: {},
  },
}

function numericStats(baseStats = {}) {
  return Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, Number(baseStats[d.key]) || 0]))
}

function percentileScore(key, value) {
  const bands = STAT_PERCENTILE_BANDS[key]
  if (!bands || value <= 0) return 0
  if (value >= bands.p90) return 5
  if (value >= bands.p75) return 4
  if (value >= bands.p50) return 3
  if (value >= bands.p25) return 2
  if (value >= bands.p10) return 1
  return 0
}

function percentileLabel(key, value) {
  const score = percentileScore(key, value)
  return ['极低', '偏低', '中低', '中高', '较高', '顶级'][score]
}

export function calculateStandardStat(baseValue, natureModifier = 1, formula = STANDARD_STAT_FORMULA_PLACEHOLDER) {
  const { level, individual, growth, flatBonus } = formula
  if ([baseValue, level, individual, growth, flatBonus].some((value) => value == null)) return null
  const raw = (((Number(baseValue) * 2 + Number(individual) + Number(growth)) * Number(level)) / 100) + Number(flatBonus)
  return Math.floor(raw * natureModifier)
}

export function nearestSpeedAnchor(value) {
  const numeric = Number(value) || 0
  return SPEED_ANCHORS.reduce((best, current) =>
    Math.abs(current - numeric) < Math.abs(best - numeric) ? current : best,
  )
}

export function crossedSpeedAnchors(from, to) {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  return SPEED_ANCHORS.filter((anchor) => anchor > start && anchor <= end)
}

export function speedTier(value) {
  const score = percentileScore('spd', Number(value) || 0)
  return [
    SPEED_TIER_LABELS.veryLow,
    SPEED_TIER_LABELS.low,
    SPEED_TIER_LABELS.midLow,
    SPEED_TIER_LABELS.midHigh,
    SPEED_TIER_LABELS.high,
    SPEED_TIER_LABELS.elite,
  ][score]
}

function analyzeSpeedConcern(stats, traitTags = [], roles = []) {
  const speedScore = percentileScore('spd', stats.spd)
  const speedTraitTags = ['spdLean', 'conditionalSpeedBoost', 'swiftSkill', 'control', 'pivot', 'energyCycle']
  const hasSpeedTrait = traitTags.some((tag) => speedTraitTags.includes(tag))
  const hasSpeedRole = roles.some((role) =>
    role.key === 'fastAttacker',
  )

  if (speedScore >= 4 || hasSpeedTrait || hasSpeedRole) {
    return {
      level: 'high',
      label: SPEED_CONCERN_LABELS.high,
      score: speedScore,
      reason: speedScore >= 4
        ? '基础速度已进入高速竞争圈，默认关键对手也可能满速/加速'
        : '特性或定位依赖先手/控制/节奏，速度性格需要重点评估',
    }
  }

  if (speedScore >= 3) {
    return {
      level: 'medium',
      label: SPEED_CONCERN_LABELS.medium,
      score: speedScore,
      reason: '基础速度处于中速偏快区间，速度性格主要影响同档对位',
    }
  }

  return {
    level: 'low',
    label: SPEED_CONCERN_LABELS.low,
    score: speedScore,
    reason: '基础速度未进入速度竞争圈，若无先手玩法则速度性格权重较低',
  }
}

function topKeys(stats, keys, count = 2) {
  return [...keys].sort((a, b) => (stats[b] || 0) - (stats[a] || 0)).slice(0, count)
}

function bottomKeys(stats, keys, count = 2) {
  return [...keys].sort((a, b) => (stats[a] || 0) - (stats[b] || 0)).slice(0, count)
}

function sumTraitWeights(traitTags = []) {
  const totals = Object.fromEntries(MODIFIABLE_STAT_KEYS.map((k) => [k, 0]))
  for (const tag of traitTags) {
    const weights = TRAIT_TAG_STAT_WEIGHTS[tag]
    if (!weights) continue
    for (const key of MODIFIABLE_STAT_KEYS) totals[key] += weights[key] || 0
  }
  return totals
}

function normalizeSkillItems(skillInfo = {}) {
  if (!skillInfo) return []
  const source = Array.isArray(skillInfo) ? skillInfo : skillInfo.skills || skillInfo.moves || []
  const list = [...(Array.isArray(source) ? source : [source])]
  if (!Array.isArray(skillInfo) && skillInfo.traitText) list.push({ category: 'status', text: skillInfo.traitText })
  return list.map((item) => {
    if (item && typeof item === 'object') return item
    return { text: item == null ? '' : String(item) }
  })
}

function skillItemText(item) {
  return [
    item.text,
    item.name,
    item.type,
    item.category,
    item.power,
    item.cost,
    item.priority,
    item.effect,
    item.description,
    item.desc,
  ].filter(Boolean).join(' ')
}

function deriveSkillEffectTags(item) {
  const explicit = Array.isArray(item.effectTags) ? item.effectTags : []
  const tags = new Set(explicit)
  const text = skillItemText(item)
  if (/先手|优先|抢先|迅捷/.test(text)) tags.add('priority')
  if (/迅捷/.test(text)) tags.add('swift')
  if (/迅捷|速度[+-]|速度提升|速度降低|先手|高速/.test(text)) tags.add('speed')
  if (/回复|恢复|治疗|吸血|生命/.test(text)) tags.add('healing')
  if (/防御|护盾|减伤|承伤|抵抗|免疫/.test(text)) tags.add('damageReduction')
  if (/回复\d*能量|获得\d*能量|能量回复|迸发/.test(text)) tags.add('energyGain')
  if (/偷取.*能量|失去\d*能量|扣.*能量|能量减少/.test(text)) tags.add('energyDrain')
  if (/能耗[+-]|费用[+-]|消耗[+-]|全技能能耗/.test(text)) tags.add('costChange')
  if (/物攻\+|魔攻\+|双攻\+|物防\+|魔防\+|双防\+|威力\+|强化|提升|增加/.test(text)) tags.add('statBoost')
  if (/继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(text)) tags.add('boostTransfer')
  if (/物攻-|魔攻-|双攻-|物防-|魔防-|双防-|速度-|削弱|降低|减少/.test(text)) tags.add('statDebuff')
  if (/中毒|剧毒|灼烧|烧伤|冻结|冰冻|睡眠|恐惧|麻痹|混乱|沉默|束缚|异常|控制/.test(text)) tags.add('control')
  if (/应对攻击|反击|受到攻击后|承受.*后/.test(text)) tags.add('counterAttack')
  if (/应对防御/.test(text)) tags.add('counterDefense')
  if (/应对状态/.test(text)) tags.add('counterStatus')
  if (/脱离|换入|换场|换下|返场|替换/.test(text)) tags.add('pivot')
  if (/\d+\s*连击|连击/.test(text)) tags.add('multiHit')
  if (/蓄力/.test(text)) tags.add('charge')
  if (/天气|场地|雨|雪|沙暴|放晴/.test(text)) tags.add('fieldEffect')
  return [...tags]
}

function countTagged(items, tag) {
  return items.filter((item) => item.effectTags.includes(tag)).length
}

export function analyzeSkillInfo(skillInfo = {}) {
  const items = normalizeSkillItems(skillInfo).map((item) => ({
    ...item,
    effectTags: deriveSkillEffectTags(item),
  }))
  const texts = items.map(skillItemText).map((text) => text.trim()).filter(Boolean)
  const joined = texts.join('；')
  const isPhysicalItem = (item) => item.category === 'physical' || /物理|物攻|物伤|physical/.test(skillItemText(item))
  const isMagicalItem = (item) => item.category === 'magical' || /魔法|魔攻|魔伤|magical/.test(skillItemText(item))
  const isStatusItem = (item) => item.category === 'status' || /状态|防御|辅助|变化|status/.test(skillItemText(item))
  const physicalItems = items.filter(isPhysicalItem)
  const magicalItems = items.filter(isMagicalItem)
  const statusItems = items.filter((item) => isStatusItem(item) && !isPhysicalItem(item) && !isMagicalItem(item))
  const attackItems = [...physicalItems, ...magicalItems]
  const powersOf = (list) =>
    list.map((item) => Number(item.power)).filter((value) => Number.isFinite(value) && value > 0)
  const averagePower = (list) => {
    const powers = powersOf(list)
    return powers.length ? powers.reduce((sum, value) => sum + value, 0) / powers.length : 0
  }
  const hasPhysical = physicalItems.length > 0 || /物理|物攻|近战|攻击技能/.test(joined)
  const hasMagical = magicalItems.length > 0 || /魔法|魔攻|法术|特殊/.test(joined)
  const physicalAveragePower = averagePower(physicalItems)
  const magicalAveragePower = averagePower(magicalItems)
  const physicalRouteScore =
    physicalItems.length + countTagged(physicalItems, 'statBoost') * 1.2 + countTagged(physicalItems, 'multiHit') * 0.8
  const magicalRouteScore =
    magicalItems.length + countTagged(magicalItems, 'statBoost') * 1.2 + countTagged(magicalItems, 'multiHit') * 0.8
  const routeGap = physicalRouteScore - magicalRouteScore
  const attackMode = Math.abs(routeGap) >= 2
    ? routeGap > 0 ? 'physical' : 'magical'
    : hasPhysical && hasMagical ? 'mixed' : hasPhysical ? 'physical' : hasMagical ? 'magical' : 'unknown'
  const effectTagCounts = Object.fromEntries(
    [...new Set(items.flatMap((item) => item.effectTags))].map((tag) => [tag, countTagged(items, tag)]),
  )
  const speedRequired = Boolean(effectTagCounts.priority || effectTagCounts.speed)
  const backLoaded = Boolean(effectTagCounts.counterAttack)
  const control = Boolean(effectTagCounts.control)
  const sustain = Boolean(effectTagCounts.healing || effectTagCounts.damageReduction)
  const boostTransfer = Boolean(effectTagCounts.boostTransfer)
  const support = Boolean(sustain || effectTagCounts.statBoost || effectTagCounts.pivot || boostTransfer)
  const defense = Boolean(effectTagCounts.damageReduction || effectTagCounts.counterDefense)
  const energy = Boolean(effectTagCounts.energyGain || effectTagCounts.energyDrain || effectTagCounts.costChange)

  return {
    count: texts.length,
    texts,
    hasPhysical,
    hasMagical,
    attackMode,
    routeGap: Math.round(routeGap * 10) / 10,
    speedRequired,
    backLoaded,
    control,
    support,
    sustain,
    boostTransfer,
    defense,
    energy,
    effectTagCounts,
    breakdown: {
      physicalCount: physicalItems.length,
      magicalCount: magicalItems.length,
      statusCount: statusItems.length,
      attackCount: attackItems.length,
      attackShare: texts.length ? attackItems.length / texts.length : 0,
      physicalAveragePower,
      magicalAveragePower,
      attackAveragePower: averagePower(attackItems),
      physicalShare: attackItems.length ? physicalItems.length / attackItems.length : 0,
      magicalShare: attackItems.length ? magicalItems.length / attackItems.length : 0,
      physicalRouteScore: Math.round(physicalRouteScore * 10) / 10,
      magicalRouteScore: Math.round(magicalRouteScore * 10) / 10,
    },
    summary: texts.length > 0
      ? `已读取 ${texts.length} 条技能线索：${[
        attackMode === 'physical' && '物理路线',
        attackMode === 'magical' && '魔法路线',
        attackMode === 'mixed' && '双攻',
        speedRequired && '先手',
        backLoaded && '后手',
        control && '控制',
        sustain && '续航/减伤',
        support && '辅助',
        boostTransfer && '强化传递',
        energy && '能量',
      ].filter(Boolean).join(' / ') || '暂无明确标签'}`
      : '未读取到技能字段，暂按六维与特性标签评估',
  }
}

export function natureName(nature) {
  if (!nature) return '未知性格'
  if (nature.name) return nature.name
  if (nature.raise == null || nature.lower == null) return '未知性格'
  return `${STAT_LABELS[nature.raise]}强化 · ${STAT_LABELS[nature.lower]}弱化`
}

export function parseNatureOption(option) {
  const matched = option.label?.match(/^(.+?)（\+(.+?) -(.+?)）$/)
  if (!matched) return null
  const [, name, raiseCn, lowerCn] = matched
  const raise = STAT_KEY_BY_CN[raiseCn]
  const lower = STAT_KEY_BY_CN[lowerCn]
  if (!raise || !lower || raise === lower) return null
  return { id: option.value, name, label: option.label, raise, lower, color: option.color }
}

export const NATURE_CANDIDATES = OWNED_NATURE_OPTIONS.map(parseNatureOption).filter(Boolean)

export function analyzeStats(baseStats = {}) {
  const stats = numericStats(baseStats)
  const modValues = MODIFIABLE_STAT_KEYS.map((key) => stats[key]).filter((v) => v > 0)
  const average = modValues.length ? modValues.reduce((sum, v) => sum + v, 0) / modValues.length : 0
  const total = MODIFIABLE_STAT_KEYS.reduce((sum, key) => sum + stats[key], 0)
  const attackBias = stats.patk - stats.matk
  const defenseBias = stats.pdef - stats.mdef
  const bulkScore = stats.hp + stats.pdef + stats.mdef
  const percentiles = Object.fromEntries(
    MODIFIABLE_STAT_KEYS.map((key) => [
      key,
      { score: percentileScore(key, stats[key]), label: percentileLabel(key, stats[key]) },
    ]),
  )
  return {
    stats,
    total,
    average,
    attackBias,
    defenseBias,
    bulkScore,
    topStats: topKeys(stats, MODIFIABLE_STAT_KEYS, 2),
    bottomStats: bottomKeys(stats, MODIFIABLE_STAT_KEYS, 2),
    percentiles,
    speed: {
      base: stats.spd,
      raised: Math.round(stats.spd * 1.1),
      lowered: Math.round(stats.spd * 0.9),
      baseTier: speedTier(stats.spd),
      raisedTier: speedTier(Math.round(stats.spd * 1.1)),
      loweredTier: speedTier(Math.round(stats.spd * 0.9)),
      nearestAnchor: nearestSpeedAnchor(stats.spd),
      raisedCrossedAnchors: crossedSpeedAnchors(stats.spd, Math.round(stats.spd * 1.1)),
      loweredCrossedAnchors: crossedSpeedAnchors(Math.round(stats.spd * 0.9), stats.spd),
    },
  }
}

export function analyzeFormulaAssist(baseStats = {}, skillProfile = null) {
  const stats = numericStats(baseStats)
  const breakdown = skillProfile?.breakdown || {}
  const physicalAveragePower = Number(breakdown.physicalAveragePower) || 0
  const magicalAveragePower = Number(breakdown.magicalAveragePower) || 0
  const physicalCount = Number(breakdown.physicalCount) || 0
  const magicalCount = Number(breakdown.magicalCount) || 0
  const physicalOutput = physicalCount > 0 ? stats.patk * Math.max(physicalAveragePower, 1) : 0
  const magicalOutput = magicalCount > 0 ? stats.matk * Math.max(magicalAveragePower, 1) : 0
  const outputRatio = physicalOutput && magicalOutput ? physicalOutput / magicalOutput : null
  const physicalBulk = stats.hp * stats.pdef
  const magicalBulk = stats.hp * stats.mdef
  const balancedBulk = stats.hp * Math.min(stats.pdef, stats.mdef)
  let routeHint = 'unknown'
  if (physicalOutput > 0 && magicalOutput > 0) {
    if (outputRatio >= 1.25) routeHint = 'physical'
    else if (outputRatio <= 0.8) routeHint = 'magical'
    else routeHint = 'mixed'
  } else if (physicalOutput > 0) {
    routeHint = 'physical'
  } else if (magicalOutput > 0) {
    routeHint = 'magical'
  }

  return {
    physicalOutput: Math.round(physicalOutput),
    magicalOutput: Math.round(magicalOutput),
    outputRatio: outputRatio == null ? null : Math.round(outputRatio * 100) / 100,
    routeHint,
    physicalBulk,
    magicalBulk,
    balancedBulk,
  }
}

export function analyzeSpeedProfile(baseStats = {}, traitTags = [], roles = null, skillProfile = null) {
  const stats = numericStats(baseStats)
  const roleList = roles || inferRoles(stats, traitTags)
  const speedSkillShouldRaiseConcern =
    skillProfile?.speedRequired && stats.spd >= STAT_PERCENTILE_BANDS.spd.p50
  const extraTraitTags = speedSkillShouldRaiseConcern ? [...traitTags, 'spdLean'] : traitTags
  const speedConcern = analyzeSpeedConcern(stats, extraTraitTags, roleList)
  const raised = Math.round(stats.spd * 1.1)
  const lowered = Math.round(stats.spd * 0.9)
  const standard = {
    neutral: calculateStandardStat(stats.spd, 1),
    raised: calculateStandardStat(stats.spd, 1.1),
    lowered: calculateStandardStat(stats.spd, 0.9),
  }
  return {
    base: stats.spd,
    raised,
    lowered,
    baseTier: speedTier(stats.spd),
    raisedTier: speedTier(raised),
    loweredTier: speedTier(lowered),
    nearestAnchor: nearestSpeedAnchor(stats.spd),
    raisedCrossedAnchors: crossedSpeedAnchors(stats.spd, raised),
    loweredCrossedAnchors: crossedSpeedAnchors(lowered, stats.spd),
    standard,
    concern: speedConcern,
    note: standard.neutral == null
      ? '最终速度公式已预留，当前因固定参数未确认，仍基于资料库基础速度近似估算。'
      : '速度线已按标准固定参数计算；实战仍会受技能优先级与临场速度变化影响。',
  }
}

export function inferRoles(baseStats = {}, traitTags = [], skillInfo = {}) {
  const analysis = analyzeStats(baseStats)
  const skillProfile = analyzeSkillInfo(skillInfo)
  const { stats } = analysis
  const roles = []
  const addRole = (key, weight, reason) => {
    if (weight <= 0) return
    const existing = roles.find((r) => r.key === key)
    if (existing) {
      existing.weight += weight
      existing.reasons.push(reason)
    } else {
      roles.push({ key, label: ROLE_DEFINITIONS[key].label, weight, reasons: [reason] })
    }
  }

  if (stats.patk >= stats.matk + 18 && stats.patk >= 70) {
    addRole('physicalAttacker', 2, `物攻 ${stats.patk} 明显高于魔攻 ${stats.matk}`)
  }
  if (stats.matk >= stats.patk + 18 && stats.matk >= 70) {
    addRole('magicalAttacker', 2, `魔攻 ${stats.matk} 明显高于物攻 ${stats.patk}`)
  }
  if (stats.patk >= 85 && stats.matk >= 85 && Math.abs(stats.patk - stats.matk) <= 20) {
    addRole('mixedAttacker', 1.6, '物攻与魔攻都较高，存在双攻潜力')
  }
  if (stats.spd >= STAT_PERCENTILE_BANDS.spd.p75) {
    addRole('fastAttacker', stats.spd >= STAT_PERCENTILE_BANDS.spd.p90 ? 2 : 1.4, `速度处于${analysis.speed.baseTier}档`)
  }
  const hasTopBulk = analysis.bulkScore >= BULK_PERCENTILE_BANDS.p90 || stats.hp >= STAT_PERCENTILE_BANDS.hp.p90
  const hasBalancedBulk =
    (analysis.bulkScore >= BULK_PERCENTILE_BANDS.p75 && stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) ||
    (stats.hp >= STAT_PERCENTILE_BANDS.hp.p75 &&
      (stats.pdef >= STAT_PERCENTILE_BANDS.pdef.p50 || stats.mdef >= STAT_PERCENTILE_BANDS.mdef.p50))
  if (hasTopBulk) {
    addRole('bulky', 1.4, `生命 + 双防合计 ${analysis.bulkScore} 达到头部耐久区间`)
  } else if (hasBalancedBulk) {
    addRole('bulky', 0.8, `生命 + 双防合计 ${analysis.bulkScore} 接近上四分位，具备一定站场基础`)
  }
  if (stats.pdef >= STAT_PERCENTILE_BANDS.pdef.p75 && stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) {
    addRole('physicalWall', 1, '物防与生命足以支撑物理防御手路线')
  }
  if (stats.mdef >= STAT_PERCENTILE_BANDS.mdef.p75 && stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) {
    addRole('magicalWall', 1, '魔防与生命足以支撑魔法防御手路线')
  }
  if (hasBalancedDefenseWallFoundation(stats, analysis, traitTags)) {
    addRole('physicalWall', 0.8, '物防/魔防接近且生命与防御特性支撑，按均衡双防模板保留物理防御手路线')
    addRole('magicalWall', 0.8, '物防/魔防接近且生命与防御特性支撑，按均衡双防模板保留魔法防御手路线')
  }

  if (traitTags.includes('patkLean')) addRole('physicalAttacker', 1.6, '特性标签偏物攻输出')
  if (traitTags.includes('matkLean')) addRole('magicalAttacker', 1.6, '特性标签偏魔攻输出')
  if (traitTags.includes('attack')) addRole('mixedAttacker', 1.2, '特性标签支持双攻输出')
  if (traitTags.includes('spdLean') || traitTags.includes('control')) {
    addRole('fastAttacker', 1.4, '特性标签强调速度/先手控制')
  }
  if (traitTags.includes('conditionalSpeedBoost')) {
    addRole('fastAttacker', 1, '特性存在条件加速，触发后需要比较速度线')
  }
  if (traitTags.includes('swiftSkill')) {
    addRole('fastAttacker', 1.3, '特性或技能机制可获得迅捷，切换入场后会触发先手技能并比较速度线')
  }
  if (traitTags.includes('shieldReduce')) {
    addRole('bulky', 1.3, '特性标签支持护盾/减伤机制')
  }
  if (traitTags.includes('defense')) {
    if (hasTopBulk) {
      addRole('bulky', 1.3, '特性标签支持耐久站场，且三防处于头部区间')
    } else if (hasBalancedBulk) {
      addRole('bulky', 0.7, '特性标签支持耐久基础，但三防仍需结合主定位判断')
    } else {
      addRole('bulky', 0.3, `物防/魔防存在单项亮点，但生命 ${stats.hp} 或综合三防不足，耐久定位需谨慎`)
    }
  }
  if (traitTags.includes('support') || traitTags.includes('pivot')) {
    addRole('support', 1.2, '特性标签支持辅助/返场')
  }
  if (traitTags.includes('energyCycle')) addRole('energyCycle', 1.3, '特性标签支持能量循环')
  if (skillProfile.attackMode === 'physical') addRole('physicalAttacker', 1.4, '技能效果标签偏物理输出')
  if (skillProfile.attackMode === 'magical') addRole('magicalAttacker', 1.4, '技能效果标签偏魔法输出')
  if (skillProfile.attackMode === 'mixed') addRole('mixedAttacker', 1.1, '技能效果同时覆盖物理与魔法')
  if ((skillProfile.speedRequired || skillProfile.control) && stats.spd >= STAT_PERCENTILE_BANDS.spd.p50) {
    addRole('fastAttacker', 1.1, '技能线索强调先手/控制节奏')
  } else if (skillProfile.speedRequired || skillProfile.control) {
    addRole('support', 0.5, '技能线索有先手/控制，但基础速度偏低，优先按辅助节奏而非高速输出处理')
  }
  if (skillProfile.sustain) addRole('bulky', 0.8, '技能效果包含回复/减伤，耐久性格可保留')
  if (skillProfile.support || skillProfile.defense) addRole('support', 0.9, '技能线索包含辅助/防御效果')
  if (skillProfile.energy) addRole('energyCycle', 0.8, '技能线索涉及能量/能耗')

  if (roles.length === 0) addRole('support', 0.5, '没有明显输出倾向，按泛用保守路线评估')
  return roles.sort((a, b) => b.weight - a.weight)
}

function buildContext(baseStats = {}, traitTags = [], skillInfo = {}) {
  const analysis = analyzeStats(baseStats)
  const skillProfile = analyzeSkillInfo(skillInfo)
  const formulaAssist = analyzeFormulaAssist(baseStats, skillProfile)
  const roles = inferRoles(baseStats, traitTags, skillInfo)
  const speedProfile = analyzeSpeedProfile(baseStats, traitTags, roles, skillProfile)
  const traitWeights = sumTraitWeights(traitTags)
  const coreWeights = Object.fromEntries(MODIFIABLE_STAT_KEYS.map((key) => [key, 0]))
  const expendableWeights = Object.fromEntries(MODIFIABLE_STAT_KEYS.map((key) => [key, 0]))
  for (const role of roles) {
    const def = ROLE_DEFINITIONS[role.key]
    const roleScale = Math.min(role.weight, 2.5)
    for (const key of MODIFIABLE_STAT_KEYS) {
      coreWeights[key] += (def.core[key] || 0) * roleScale
      expendableWeights[key] += (def.expendable[key] || 0) * roleScale
    }
  }
  const primaryAttack = analysis.stats.patk >= analysis.stats.matk ? 'patk' : 'matk'
  const secondaryAttack = primaryAttack === 'patk' ? 'matk' : 'patk'
  if (Math.abs(analysis.attackBias) >= 18) expendableWeights[secondaryAttack] += 1.5
  if (analysis.percentiles[secondaryAttack].score <= 1) expendableWeights[secondaryAttack] += 0.9
  for (const key of analysis.bottomStats) expendableWeights[key] += key === 'hp' ? 0.1 : 0.4
  return { analysis, roles, speedProfile, skillProfile, formulaAssist, traitWeights, coreWeights, expendableWeights }
}

function statDelta(baseStats, nature) {
  const adjusted = applyNatureModifier(baseStats, nature)
  return Object.fromEntries(MODIFIABLE_STAT_KEYS.map((key) => [key, adjusted[key] - (baseStats[key] || 0)]))
}

function decisionFromScore(score, hardRisk) {
  if (hardRisk || score < 25) return 'notRecommended'
  if (score >= 90) return 'recommended'
  return 'keepable'
}

function normalizeNaturePreference(preference = {}) {
  return {
    keepNatureIds: new Set(preference.keepNatureIds || []),
    keepNatureNames: new Set(preference.keepNatureNames || []),
    reason: preference.reason || '阵容上下文需要保留该性格',
  }
}

function coreRoleLabelsForStat(roles = [], statKey) {
  return roles
    .filter((role) => (ROLE_DEFINITIONS[role.key]?.core?.[statKey] || 0) > 0)
    .map((role) => role.label)
}

function roleAwareStatReason(roles = [], statKey, statLabel, action) {
  const topRoleLabels = roles.slice(0, 2).map((role) => role.label)
  const supportingLabels = coreRoleLabelsForStat(roles, statKey)
  const topSupportingLabels = supportingLabels.filter((label) => topRoleLabels.includes(label))
  if (topSupportingLabels.length > 0) {
    return `当前综合定位为${topRoleLabels.join(' / ') || '泛用'}，${action}${statLabel}符合该定位的核心需求`
  }
  if (supportingLabels.length > 0) {
    return `次要定位线索（${supportingLabels.slice(0, 2).join(' / ')}）支持${action}${statLabel}，但需确认是否服务于主输出路线`
  }
  return `${action}${statLabel}符合当前路线的局部需求`
}

function roleAwareStatWarning(roles = [], statKey, statLabel) {
  const topRoleLabels = roles.slice(0, 2).map((role) => role.label)
  const supportingLabels = coreRoleLabelsForStat(roles, statKey)
  const topSupportingLabels = supportingLabels.filter((label) => topRoleLabels.includes(label))
  if (topSupportingLabels.length > 0) {
    return `当前综合定位为${topRoleLabels.join(' / ') || '泛用'}，弱化${statLabel}会削弱该定位的关键能力`
  }
  if (supportingLabels.length > 0) {
    return `弱化${statLabel}会削弱次要定位线索（${supportingLabels.slice(0, 2).join(' / ')}）的关键能力`
  }
  return `弱化${statLabel}会削弱当前路线的局部能力`
}

function hasBalancedDefenseWallFoundation(stats = {}, analysis = {}, traitTags = []) {
  const pdef = Number(stats.pdef) || 0
  const mdef = Number(stats.mdef) || 0
  const hp = Number(stats.hp) || 0
  const defenseGap = Math.abs(pdef - mdef)
  const hasDefenseTrait = traitTags.includes('defense') || traitTags.includes('shieldReduce')
  const hasBulkFoundation =
    (Number(analysis.bulkScore) || 0) >= BULK_PERCENTILE_BANDS.p75 &&
    hp >= STAT_PERCENTILE_BANDS.hp.p50
  const nearWallLine =
    Math.max(pdef, mdef) >=
    Math.min(STAT_PERCENTILE_BANDS.pdef.p75, STAT_PERCENTILE_BANDS.mdef.p75) - 1

  return defenseGap <= 5 && hasDefenseTrait && hasBulkFoundation && nearWallLine
}


function isSingleDefenseRaiseSoftCapped(candidate, roles = [], traitTags = [], analysis = null) {
  if (!['pdef', 'mdef'].includes(candidate.raise)) return false
  const topRoles = roles.slice(0, 2)
  const topRolesNeedDefense = topRoles.some((role) => (ROLE_DEFINITIONS[role.key]?.core?.[candidate.raise] || 0) > 0)
  const hasMechanicDefenseTrait = traitTags.includes('shieldReduce')
  const hasBulkFoundation =
    analysis &&
    ((analysis.bulkScore >= BULK_PERCENTILE_BANDS.p75 && analysis.stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) ||
      analysis.stats.hp >= STAT_PERCENTILE_BANDS.hp.p75)
  if (topRolesNeedDefense && (hasMechanicDefenseTrait || hasBulkFoundation)) return false
  if (hasMechanicDefenseTrait) return false
  return roles.some((role) => (ROLE_DEFINITIONS[role.key]?.core?.[candidate.raise] || 0) > 0)
}



function isFunctionalBalancedMixedAttack(analysis = {}, roles = [], skillProfile = {}) {
  const breakdown = skillProfile.breakdown || {}
  const physicalShare = Number(breakdown.physicalShare)
  const magicalShare = Number(breakdown.magicalShare)
  const balancedSkillCounts = physicalShare >= 0.4 && physicalShare <= 0.6 && magicalShare >= 0.4 && magicalShare <= 0.6
  const balancedStats = Math.abs(Number(analysis.attackBias) || 0) <= 12
  const hasFunctionalRole = roles.some((role) => ['bulky', 'support', 'energyCycle', 'physicalWall', 'magicalWall'].includes(role.key))
  return balancedSkillCounts && balancedStats && hasFunctionalRole
}


function hasFunctionalMixedOutputFloor(stats = {}, skillProfile = {}) {
  const breakdown = skillProfile.breakdown || {}
  const maxAttackStat = Math.max(Number(stats.patk) || 0, Number(stats.matk) || 0)
  const attackCount = Number(breakdown.attackCount) || 0
  const attackAveragePower = Number(breakdown.attackAveragePower) || 0
  return maxAttackStat >= 80 && attackCount >= 8 && attackAveragePower >= 55
}

function isLowOutputFunctionalMixedAttack(analysis = {}, roles = [], skillProfile = {}) {
  const breakdown = skillProfile.breakdown || {}
  const attackShare = Number(breakdown.attackShare) || 0
  return (
    isFunctionalBalancedMixedAttack(analysis, roles, skillProfile) &&
    !hasFunctionalMixedOutputFloor(analysis.stats || {}, skillProfile) &&
    attackShare > 0 &&
    attackShare < 0.45
  )
}

function formulaRouteSupportsSingleAttack(candidate, formulaAssist = {}) {
  if (!ATTACK_STAT_KEYS.includes(candidate.lower)) return false
  if (formulaAssist.routeHint === 'physical') return candidate.lower === 'matk'
  if (formulaAssist.routeHint === 'magical') return candidate.lower === 'patk'
  return false
}

function formulaRouteConflictsWithCandidate(candidate, formulaAssist = {}) {
  if (formulaAssist.routeHint === 'physical') return candidate.lower === 'patk'
  if (formulaAssist.routeHint === 'magical') return candidate.lower === 'matk'
  return false
}

function isSkillProvedSingleAttackRoute(candidate, roles = [], skillProfile = {}, formulaAssist = {}) {
  if (!ATTACK_STAT_KEYS.includes(candidate.lower)) return false
  if (!roles.some((role) => role.key === 'mixedAttacker')) return false
  const breakdown = skillProfile.breakdown || {}
  const routeGap = Math.abs(Number(skillProfile.routeGap) || 0)
  const formulaSupportsRoute = formulaRouteSupportsSingleAttack(candidate, formulaAssist)
  if (skillProfile.attackMode === 'physical' && candidate.lower === 'matk') {
    return routeGap >= 4 && (formulaSupportsRoute || breakdown.physicalShare >= 0.65 || breakdown.magicalCount <= 3)
  }
  if (skillProfile.attackMode === 'magical' && candidate.lower === 'patk') {
    return routeGap >= 4 && (formulaSupportsRoute || breakdown.magicalShare >= 0.65 || breakdown.physicalCount <= 3)
  }
  return false
}

function isSkillPlausibleSingleAttackRoute(candidate, roles = [], skillProfile = {}, formulaAssist = {}) {
  if (!ATTACK_STAT_KEYS.includes(candidate.lower)) return false
  if (!roles.some((role) => role.key === 'mixedAttacker')) return false
  if (isSkillProvedSingleAttackRoute(candidate, roles, skillProfile, formulaAssist)) return true
  if (formulaRouteConflictsWithCandidate(candidate, formulaAssist)) return false
  const routeGap = Math.abs(Number(skillProfile.routeGap) || 0)
  if (formulaRouteSupportsSingleAttack(candidate, formulaAssist)) return true
  if (routeGap < 2) return false
  if (skillProfile.attackMode === 'physical' && candidate.lower === 'matk') return true
  if (skillProfile.attackMode === 'magical' && candidate.lower === 'patk') return true
  return false
}

function applyNaturePreference(evaluation, preference = {}) {
  const normalized = normalizeNaturePreference(preference)
  const shouldKeep =
    normalized.keepNatureIds.has(evaluation.id) || normalized.keepNatureNames.has(evaluation.name)
  if (!shouldKeep) return evaluation
  return {
    ...evaluation,
    decision: evaluation.decision === 'notRecommended' && !evaluation.hardRisk
      ? 'keepable'
      : evaluation.decision,
    lineupKeep: true,
    reasons: [...evaluation.reasons, normalized.reason],
  }
}

export function evaluateNatureCandidate(
  candidate,
  baseStats = {},
  traitTags = [],
  providedContext = null,
  skillInfo = {},
  preference = {},
) {
  const stats = numericStats(baseStats)
  const context = providedContext || buildContext(stats, traitTags, skillInfo)
  const { analysis, roles, speedProfile, skillProfile, formulaAssist, traitWeights, coreWeights, expendableWeights } = context
  const reasons = []
  const warnings = []
  const roleLabels = roles.slice(0, 2).map((r) => r.label)
  const raiseLabel = STAT_LABELS[candidate.raise]
  const lowerLabel = STAT_LABELS[candidate.lower]

  const raiseCore = coreWeights[candidate.raise] || 0
  const lowerCore = coreWeights[candidate.lower] || 0
  const lowerExpendable = expendableWeights[candidate.lower] || 0
  const raiseTrait = traitWeights[candidate.raise] || 0
  const lowerTrait = traitWeights[candidate.lower] || 0
  const raiseBand = analysis.percentiles[candidate.raise]?.score || 0
  const lowerBand = analysis.percentiles[candidate.lower]?.score || 0

  let score = 25
  score += raiseCore * 11
  score += raiseTrait * 7
  score += Math.max(0, raiseBand - 2) * 4
  score += lowerExpendable * 12
  score -= lowerCore * 12
  score -= lowerTrait * 5
  score += Math.max(0, 2 - lowerBand) * 3

  if (candidate.raise === 'spd') {
    const speedBonus = { high: 10, medium: 4, low: -28 }[speedProfile.concern.level]
    score += speedBonus
    if (speedProfile.concern.level === 'low' && stats.spd < STAT_PERCENTILE_BANDS.spd.p25) {
      score -= 10
      warnings.push('基础速度低于 P25 且主定位不抢速，加速收益默认低于主攻、生命或防御强化')
      if (lowerCore > 0.8 || DEFENSE_STAT_KEYS.includes(candidate.lower)) {
        score -= 12
        warnings.push('低速非抢速定位不宜为了加速牺牲攻击、生命或防御核心项')
      }
    }
    if (speedProfile.raisedTier !== speedProfile.baseTier || speedProfile.raisedCrossedAnchors.length > 0) {
      reasons.push(
        `基础速度 ${speedProfile.base} 属于${speedProfile.baseTier}；加速近似到 ${speedProfile.raised}，可能跨过 ${speedProfile.raisedCrossedAnchors.join(' / ') || '无'} 锚点。${speedProfile.concern.reason}`,
      )
    } else if (speedProfile.concern.level === 'low') {
      warnings.push('速度未进入竞争圈，加速主要改善同档对位，通常不应优先于主攻或耐久')
    }
  }
  if (candidate.lower === 'spd') {
    const speedPenalty = { high: 14, medium: 7, low: 2 }[speedProfile.concern.level]
    score -= speedPenalty
    if (speedProfile.loweredTier !== speedProfile.baseTier || speedProfile.loweredCrossedAnchors.length > 0) {
      const message = `基础速度 ${speedProfile.base} 属于${speedProfile.baseTier}；减速近似到 ${speedProfile.lowered}，会失去 ${speedProfile.loweredCrossedAnchors.join(' / ') || '无'} 锚点。${speedProfile.concern.reason}`
      if (speedProfile.concern.level === 'low') reasons.push(`${message}，可作为低速路线的牺牲项`)
      else warnings.push(message)
    }
  }
  if (candidate.lower === 'spd' && roles.slice(0, 2).some((r) => r.key === 'bulky') && speedProfile.concern.level === 'low') {
    score += 16
    reasons.push('当前主定位偏耐久站场且速度未进入竞争圈，减速可作为捕捉时的低成本牺牲项')
  }
  if (candidate.lower === 'hp' && !traitTags.includes('support') && !traitTags.includes('pivot')) {
    score -= 10
    warnings.push('生命会同时影响两侧承伤，缺少低血/退场收益时不宜轻易弱化')
  }
  if (candidate.raise === 'hp' && roles.some((r) => ['bulky', 'support'].includes(r.key))) {
    score += 8
    reasons.push('生命强化能同时提高物理与魔法承伤容错')
  }
  if (candidate.raise === 'pdef' && roles.some((r) => r.key === 'physicalWall')) {
    score += 8
    reasons.push('强化物防可把已有物理耐久优势做成专项防御手')
  }
  if (candidate.raise === 'mdef' && roles.some((r) => r.key === 'magicalWall')) {
    score += 8
    reasons.push('强化魔防可把已有魔法耐久优势做成专项防御手')
  }
  if (formulaAssist?.routeHint === 'physical' && candidate.raise === 'patk') {
    score += 6
    reasons.push('公式辅助输出线偏物理，强化物攻更贴近当前技能威力结构')
  }
  if (formulaAssist?.routeHint === 'magical' && candidate.raise === 'matk') {
    score += 6
    reasons.push('公式辅助输出线偏魔法，强化魔攻更贴近当前技能威力结构')
  }
  if (formulaRouteSupportsSingleAttack(candidate, formulaAssist)) {
    score += 9
    reasons.push(`公式辅助输出线偏${formulaAssist.routeHint === 'physical' ? '物理' : '魔法'}，弱化${lowerLabel}可作为单攻分支线索`)
  }
  if (formulaRouteConflictsWithCandidate(candidate, formulaAssist)) {
    score -= 18
    warnings.push(`公式辅助输出线偏${formulaAssist.routeHint === 'physical' ? '物理' : '魔法'}，弱化${lowerLabel}会削弱更高质量的输出侧`)
  }
  if (skillProfile.attackMode === 'physical' && candidate.raise === 'patk') {
    score += 10
    reasons.push('技能效果标签偏物理输出，强化物攻更贴合技能组')
  }
  if (skillProfile.attackMode === 'magical' && candidate.raise === 'matk') {
    score += 10
    reasons.push('技能效果标签偏魔法输出，强化魔攻更贴合技能组')
  }
  const functionalBalancedMixedAttack = isFunctionalBalancedMixedAttack(analysis, roles, skillProfile)
  const lowOutputFunctionalMixedAttack = isLowOutputFunctionalMixedAttack(analysis, roles, skillProfile)
  const balancedDefenseWall = hasBalancedDefenseWallFoundation(stats, analysis, traitTags)
  if (balancedDefenseWall && ['hp', 'pdef', 'mdef'].includes(candidate.raise)) {
    reasons.push('生命与双防接近标准肉盾模板，强化耐久项可服务均衡双防站场')
  }
  if (balancedDefenseWall && ['pdef', 'mdef'].includes(candidate.lower)) {
    score -= 10
    warnings.push(`物防/魔防接近且特性指向双防，弱化${lowerLabel}会破坏均衡肉盾模板`)
  }
  if (skillProfile.attackMode === 'physical' && candidate.lower === 'patk') {
    const penalty = functionalBalancedMixedAttack ? 0 : (formulaAssist?.routeHint === 'magical' ? 4 : 18)
    score -= penalty
    warnings.push(functionalBalancedMixedAttack
      ? '功能站场型双攻接近，弱化物攻有代价但不应按单攻冲突处理'
      : '技能效果标签偏物理输出，弱化物攻存在冲突')
  }
  if (skillProfile.attackMode === 'magical' && candidate.lower === 'matk') {
    const penalty = functionalBalancedMixedAttack ? 0 : (formulaAssist?.routeHint === 'physical' ? 4 : 18)
    score -= penalty
    warnings.push(functionalBalancedMixedAttack
      ? '功能站场型双攻接近，弱化魔攻有代价但不应按单攻冲突处理'
      : '技能效果标签偏魔法输出，弱化魔攻存在冲突')
  }
  if (
    functionalBalancedMixedAttack &&
    hasFunctionalMixedOutputFloor(stats, skillProfile) &&
    ATTACK_STAT_KEYS.includes(candidate.raise) &&
    ATTACK_STAT_KEYS.includes(candidate.lower)
  ) {
    score = Math.max(score, 32)
    reasons.push('功能站场型双攻接近，强化一攻并弱化另一攻可作为输出分支保留')
  }
  if (lowOutputFunctionalMixedAttack && ATTACK_STAT_KEYS.includes(candidate.raise)) {
    score -= 14
    warnings.push('攻击技能占整体技能池比例偏低且双攻面板未过输出底线，强化攻击仅作为低优先玩法分支')
  }
  if (
    lowOutputFunctionalMixedAttack &&
    ATTACK_STAT_KEYS.includes(candidate.raise) &&
    ATTACK_STAT_KEYS.includes(candidate.lower)
  ) {
    score = Math.max(score, 30)
    reasons.push('低输出功能位仍有双攻技能分支，强化一攻并弱化另一攻可低优先保留')
  }
  const lowOutputQuickTriggerBranch =
    lowOutputFunctionalMixedAttack &&
    ATTACK_STAT_KEYS.includes(candidate.raise) &&
    candidate.lower === 'hp' &&
    traitTags.includes('shieldReduce')
  if (lowOutputQuickTriggerBranch) {
    score = Math.max(score, 28)
    reasons.push('存在护盾/免死类机制时，降生命可作为快速触发机制的特殊玩法分支')
    warnings.push('该分支不代表 PVE 常规培养价值，需用户明确选择快速触发/快速退场玩法')
  }
  if (skillProfile.sustain && DEFENSE_STAT_KEYS.includes(candidate.raise)) {
    score += 6
    reasons.push('技能效果包含回复/减伤，强化耐久项更容易放大站场收益')
  }
  if (skillProfile.energy && (candidate.raise === 'spd' || candidate.raise === 'hp')) {
    score += 4
    reasons.push('技能效果涉及能量循环，速度或生命强化有助于维持节奏')
  }
  if (skillProfile.control && candidate.raise === 'spd') {
    const controlSpeedBonus = speedProfile.concern.level === 'low' ? 1 : 5
    score += controlSpeedBonus
    reasons.push(speedProfile.concern.level === 'low'
      ? '技能效果包含异常/控制，但基础速度未进入竞争圈，速度强化仅作为低权重节奏收益'
      : '技能效果包含异常/控制，强化速度有助于先手施压')
  }
  if (traitTags.includes('conditionalSpeedBoost') && candidate.raise === 'spd') {
    score += 6
    reasons.push('特性存在条件加速，强化速度可提高触发后的速度线')
  }
  if (traitTags.includes('swiftSkill') && candidate.raise === 'spd') {
    score += 8
    reasons.push('特性或技能机制可获得迅捷；迅捷技能必定先手，迅捷对位仍会比较速度，强化速度可提高同迅捷对位')
  }
  if (traitTags.includes('conditionalSpeedBoost') && candidate.lower === 'spd') {
    score -= 8
    warnings.push('特性存在条件加速，弱化速度会降低触发后的速度线')
  }
  if (traitTags.includes('swiftSkill') && candidate.lower === 'spd') {
    score -= 10
    warnings.push('特性或技能机制依赖迅捷；迅捷技能对位仍会拼速度，弱化速度会降低同迅捷对位能力')
  }
  if (skillProfile.backLoaded && candidate.lower === 'spd') {
    score += 10
    reasons.push('技能线索存在后手/反击收益，减速可作为战术牺牲项')
  }
  if (skillProfile.boostTransfer && candidate.lower === 'spd') {
    score += 8
    reasons.push('技能或特性存在强化传递，慢速脱离可降低下个入场精灵承伤风险')
  }
  if (skillProfile.boostTransfer && DEFENSE_STAT_KEYS.includes(candidate.raise)) {
    score += 4
    reasons.push('强化传递需要先站住并完成交接，生命或防御强化可提高传递稳定性')
  }
  if (skillProfile.boostTransfer && candidate.raise === 'spd') {
    warnings.push('强化传递玩法有时需要慢速交接，强化速度是否有利需结合出手顺序确认')
  }
  if (skillProfile.speedRequired && candidate.raise === 'spd') {
    const speedRequiredBonus = { high: 10, medium: 6, low: 2 }[speedProfile.concern.level]
    score += speedRequiredBonus
    reasons.push(speedProfile.concern.level === 'low'
      ? '技能线索有先手/优先节奏，但基础速度偏低，强化速度只作低权重保留依据'
      : '技能线索依赖先手/优先节奏，强化速度更有价值')
  }
  if (skillProfile.speedRequired && candidate.lower === 'spd' && speedProfile.concern.level !== 'low') {
    score -= 12
    warnings.push('技能线索依赖先手/优先节奏，弱化速度风险较高')
  }

  if (raiseCore > 0.8) reasons.push(roleAwareStatReason(roles, candidate.raise, raiseLabel, '强化'))
  if (raiseTrait > 0) reasons.push(`特性标签支持强化${raiseLabel}`)
  if (lowerExpendable > 1) reasons.push(`弱化${lowerLabel}的代价较低，适合作为当前路线的牺牲项`)
  if (lowerCore > 1) warnings.push(roleAwareStatWarning(roles, candidate.lower, lowerLabel))
  if (lowerTrait > raiseTrait && lowerTrait > 0) warnings.push(`特性标签更需要${lowerLabel}，弱化存在冲突`)
  const lowersShortDefense =
    DEFENSE_STAT_KEYS.includes(candidate.lower) &&
    candidate.lower !== 'hp' &&
    analysis.bottomStats.includes(candidate.lower) &&
    roles.some((role) => ['bulky', 'support', 'physicalWall', 'magicalWall'].includes(role.key))
  if (lowersShortDefense) {
    score -= 14
    warnings.push(`弱化${lowerLabel}会扩大当前耐久短板，站场型精灵应优先选择降速度或降非主攻`)
  }
  if (
    lowOutputFunctionalMixedAttack &&
    DEFENSE_STAT_KEYS.includes(candidate.lower) &&
    candidate.lower !== 'hp' &&
    !ATTACK_STAT_KEYS.includes(candidate.raise)
  ) {
    score -= 16
    warnings.push('低输出功能位不宜为了泛用强化牺牲双防；优先选择降攻击或明确特殊分支')
  }
  const skillProvedSingleAttackRoute = isSkillProvedSingleAttackRoute(candidate, roles, skillProfile, formulaAssist)
  const skillPlausibleSingleAttackRoute = isSkillPlausibleSingleAttackRoute(candidate, roles, skillProfile, formulaAssist)
  if (skillProvedSingleAttackRoute) {
    score += 14
    reasons.push(`技能组明显偏${skillProfile.attackMode === 'physical' ? '物理' : '魔法'}路线，弱化${lowerLabel}可作为单攻分支，但仍需保留双攻面板的玩法可能`)
  } else if (skillPlausibleSingleAttackRoute) {
    score += 7
    reasons.push(`技能组略偏${skillProfile.attackMode === 'physical' ? '物理' : '魔法'}路线，弱化${lowerLabel}可作为捕捉时的可保留分支`)
  }
  if (ATTACK_STAT_KEYS.includes(candidate.lower) && roles.some((r) => r.key === 'mixedAttacker')) {
    warnings.push(skillPlausibleSingleAttackRoute
      ? '当前仍有双攻面板，弱化另一攻不应视为完全无代价，捕捉时可保留但需确认单攻路线'
      : '当前存在双攻潜力，弱化任一攻击都需要技能池证明可以转为单攻玩法')
  }

  const topRoleKeys = new Set(roles.slice(0, 2).map((role) => role.key))
  const isMixedAttackTradeoff = ATTACK_STAT_KEYS.includes(candidate.lower) && roles.some((r) => r.key === 'mixedAttacker')
  const speedIsPrimaryCore =
    speedProfile.concern.level === 'high' &&
    (topRoleKeys.has('fastAttacker') ||
      traitTags.includes('spdLean') ||
      traitTags.includes('conditionalSpeedBoost') ||
      traitTags.includes('swiftSkill'))
  const hardRisk =
    (lowerCore >= 3.8 && !skillPlausibleSingleAttackRoute && !isMixedAttackTradeoff &&
      !(candidate.lower === 'spd' && speedProfile.concern.level === 'low')) ||
    (candidate.lower === 'spd' && speedIsPrimaryCore) ||
    (candidate.lower === 'hp' && roles.some((r) => ['bulky', 'support'].includes(r.key)) && lowerExpendable < 1)
  const singleDefenseSoftCap = isSingleDefenseRaiseSoftCapped(candidate, roles, traitTags, analysis)

  if (hardRisk) score -= 8
  let decision = decisionFromScore(score, hardRisk)
  if (singleDefenseSoftCap && decision === 'recommended') {
    decision = 'keepable'
    warnings.push('单防强化需要生命/双防综合基础或明确护盾减伤机制支撑；当前证据不足，默认降为可保留')
  }
  const midSpeedFunctionalTempo =
    candidate.raise === 'spd' &&
    decision === 'recommended' &&
    stats.spd < STAT_PERCENTILE_BANDS.spd.p50 &&
    roles.some((role) => ['bulky', 'support', 'energyCycle'].includes(role.key)) &&
    !roles.slice(0, 2).some((role) => role.key === 'fastAttacker')
  if (midSpeedFunctionalTempo) {
    decision = 'keepable'
    warnings.push('中速以下的功能/站场定位可保留速度节奏分支，但不应与主攻或耐久强化同级首推')
  }
  if (lowersShortDefense && decision === 'keepable') {
    decision = 'notRecommended'
    warnings.push('弱化当前耐久短板不作为可保留输出分支，除非存在明确低耐久收益')
  }
  if (balancedDefenseWall && ['pdef', 'mdef'].includes(candidate.lower) && decision === 'keepable') {
    decision = 'notRecommended'
    warnings.push('标准均衡肉盾不应为了泛用强化牺牲任一侧防御')
  }
  if (
    lowOutputFunctionalMixedAttack &&
    DEFENSE_STAT_KEYS.includes(candidate.lower) &&
    candidate.lower !== 'hp' &&
    !ATTACK_STAT_KEYS.includes(candidate.raise) &&
    decision === 'keepable'
  ) {
    decision = 'notRecommended'
    warnings.push('低输出功能位的泛用可保留不应以牺牲双防为代价')
  }
  if (lowOutputQuickTriggerBranch && decision === 'notRecommended') {
    decision = 'keepable'
  }
  if (
    decision === 'recommended' &&
    warnings.some((warning) => /削弱|冲突|风险|双攻|弱化另一攻/.test(warning))
  ) {
    decision = 'keepable'
    warnings.push('当前候选仍有明确风险，捕捉时可保留但不作为首推')
  }
  if (skillProvedSingleAttackRoute && decision === 'recommended') {
    const raisesPrimaryRoute =
      candidate.raise === 'spd' ||
      (skillProfile.attackMode === 'physical' && candidate.raise === 'patk') ||
      (skillProfile.attackMode === 'magical' && candidate.raise === 'matk')
    if (!raisesPrimaryRoute) {
      decision = 'keepable'
      warnings.push('弱化另一攻主要服务单攻分支，但当前强化项不是主攻/速度，默认保留而非主推')
    }
  }
  if (skillPlausibleSingleAttackRoute && decision === 'notRecommended' && score >= 35) {
    decision = 'keepable'
    warnings.push(skillProvedSingleAttackRoute
      ? '技能已证明可走单攻分支，当前组合不应直接判死，降级为可保留'
      : '技能略偏单攻分支，捕捉时可先保留等待玩法确认')
  }

  return applyNaturePreference({
    ...candidate,
    score: Math.round(score * 10) / 10,
    decision,
    roleTags: roles.map((r) => r.key),
    roleLabel: roleLabels.join(' / ') || '泛用',
    speedProfile,
    skillProfile,
    formulaAssist,
    adjustedStats: applyNatureModifier(stats, candidate),
    deltas: statDelta(stats, candidate),
    reasons: reasons.length ? reasons : [`强化${raiseLabel}、弱化${lowerLabel}整体收益一般`],
    warnings,
    hardRisk,
  }, preference)
}

function dominanceKey(item) {
  return `${item.raise}-${item.lower}`
}

function lowersOffRouteAttack(item) {
  const mode = item.skillProfile?.attackMode
  return (mode === 'physical' && item.lower === 'matk') || (mode === 'magical' && item.lower === 'patk')
}

function shouldHardDominateWithOffRouteAttack(item, best) {
  if (!lowersOffRouteAttack(best) || lowersOffRouteAttack(item)) return false
  if (best.hardRisk || best.warnings.length > 0) return false
  if (item.lower === best.raise) return false
  return ['hp', 'pdef', 'mdef', 'spd', 'patk', 'matk'].includes(item.lower)
}

function canKeepDominatedCandidate(item, best) {
  const functionalMixedAttackTradeoff =
    ATTACK_STAT_KEYS.includes(item.raise) &&
    ATTACK_STAT_KEYS.includes(item.lower) &&
    item.reasons.some((reason) =>
      /功能站场型双攻接近|低输出功能位仍有双攻技能分支/.test(reason),
    )
  if (item.decision !== 'keepable' || item.hardRisk) return false
  if (!functionalMixedAttackTradeoff && item.score < 45) return false
  if (shouldHardDominateWithOffRouteAttack(item, best)) return false
  if (item.raise === 'spd' && item.speedProfile?.concern?.level === 'low') return false
  if (lowersCurrentShortDefense(item)) return false
  if (item.warnings.some((warning) => /低输出功能位不宜为了泛用强化牺牲双防/.test(warning))) return false
  if (functionalMixedAttackTradeoff) return true
  const bestLowerIsSpeedForLowConcern =
    best.lower === 'spd' && best.speedProfile?.concern?.level === 'low'
  if (bestLowerIsSpeedForLowConcern && ATTACK_STAT_KEYS.includes(item.lower)) return false
  return true
}

function lowersCurrentShortDefense(item) {
  return DEFENSE_STAT_KEYS.includes(item.lower) &&
    item.lower !== 'hp' &&
    item.warnings.some((warning) => /耐久短板/.test(warning))
}

function applyDominance(evaluations) {
  const grouped = Map.groupBy ? Map.groupBy(evaluations, (item) => item.raise) : null
  const groups = grouped || evaluations.reduce((map, item) => {
    if (!map.has(item.raise)) map.set(item.raise, [])
    map.get(item.raise).push(item)
    return map
  }, new Map())

  const result = evaluations.map((item) => ({ ...item }))
  const byKey = new Map(result.map((item) => [dominanceKey(item), item]))

  for (const [raise, group] of groups) {
    const safeOptions = group.filter((item) => !item.hardRisk)
    const best = safeOptions.length > 0 ? [...safeOptions].sort((a, b) => b.score - a.score)[0] : null
    if (!best) continue
    for (const item of group) {
      if (item === best) continue
      if (item.lineupKeep) continue
      if (item.score > best.score - 20) continue
      const hardDominatedByOffRouteAttack = shouldHardDominateWithOffRouteAttack(item, best)
      if (
        item.reasons.some((reason) => /专项|速度 .*提升到/.test(reason)) &&
        !lowersCurrentShortDefense(item) &&
        !hardDominatedByOffRouteAttack
      ) continue
      if (item.score >= 25 && item.reasons.some((reason) => /公式辅助输出线偏.*单攻分支/.test(reason))) continue
      const target = byKey.get(dominanceKey(item))
      if (!target) continue
      if (canKeepDominatedCandidate(target, best)) {
        target.warnings = [
          ...target.warnings,
          `同样强化${STAT_LABELS[raise]}时，${natureName(best)}代价更低；但当前组合仍有保留依据，捕捉时可作为低优先级可保留`,
        ]
        continue
      }
      target.decision = 'notRecommended'
      target.dominatedBy = natureName(best)
      target.warnings = [
        ...target.warnings,
        shouldHardDominateWithOffRouteAttack(target, best)
          ? `同样强化${STAT_LABELS[raise]}时，${natureName(best)}已牺牲明确非主路线攻击项；当前组合削弱仍有用途的${STAT_LABELS[target.lower]}，因此被硬支配`
          : `同样强化${STAT_LABELS[raise]}时，${natureName(best)}代价更低，因此当前组合被支配`,
      ]
    }
  }

  return result
}


function isOffRouteAttackNature(nature = {}) {
  const roleTags = nature.roleTags || []
  const skillMode = nature.skillProfile?.attackMode
  const hasMixedRole = roleTags.includes('mixedAttacker')
  const hasPhysicalRoute = roleTags.includes('physicalAttacker') || skillMode === 'physical'
  const hasMagicalRoute = roleTags.includes('magicalAttacker') || skillMode === 'magical'
  if (nature.raise === 'matk' && hasPhysicalRoute && !hasMagicalRoute && !hasMixedRole) return true
  if (nature.raise === 'patk' && hasMagicalRoute && !hasPhysicalRoute && !hasMixedRole) return true
  return false
}

export function rejectionGroupForNature(nature = {}) {
  const warnings = nature.warnings || []
  const text = warnings.join('；')
  const hasSpeedLowerRisk = nature.lower === 'spd' || /弱化速度|减速|失去 .*锚点|降低.*速度线|同迅捷/.test(text)
  const hasSkillOutputConflict = /技能效果标签偏物理输出，弱化物攻|技能效果标签偏魔法输出，弱化魔攻|技能.*冲突/.test(text)
  const hasMixedAttackConflict = /双攻|任一攻击|单攻/.test(text)
  const hasBulkConflict = /生命|耐久|承伤/.test(text) || nature.lower === 'hp'

  if (nature.hardRisk && hasSpeedLowerRisk) {
    return {
      key: 'hard-speed',
      title: '速度/先手硬风险',
      description: '弱化速度会破坏高速、先手、迅捷或节奏定位。',
    }
  }
  if (nature.hardRisk && hasSkillOutputConflict) {
    return {
      key: 'skill-output-conflict',
      title: '技能输出方向冲突',
      description: '技能组已经明显偏向某个输出侧，弱化该侧会和技能路线冲突。',
    }
  }
  if (nature.hardRisk && hasMixedAttackConflict) {
    return {
      key: 'hard-mixed-attack',
      title: '双攻路线冲突',
      description: '当前仍有双攻潜力，弱化任一攻击需要更强技能组证据。',
    }
  }
  if (nature.hardRisk && hasBulkConflict) {
    return {
      key: 'hard-bulk',
      title: '生命/耐久硬风险',
      description: '弱化生命或核心耐久项会明显降低站场与容错。',
    }
  }
  if (nature.hardRisk) {
    return {
      key: 'hard-role',
      title: '核心定位硬风险',
      description: '弱化项会削弱当前综合定位的关键能力。',
    }
  }
  if (isOffRouteAttackNature(nature)) {
    return {
      key: 'off-route-attack-raise',
      title: '强化方向偏离主输出',
      description: '当前主定位或技能组偏单侧输出，强化另一攻通常不是主要路线；若同时被支配，支配关系保留在候选风险里。',
    }
  }
  if (hasSkillOutputConflict) {
    return {
      key: 'skill-output-conflict',
      title: '技能输出方向冲突',
      description: '技能组已经明显偏向某个输出侧，弱化该侧会和技能路线冲突。',
    }
  }
  if (nature.dominatedBy) {
    return {
      key: `dominated:${nature.dominatedBy}`,
      title: `被 ${nature.dominatedBy} 支配`,
      description: '同一强化项下已有代价更低或风险更少的选择，通常优先保留支配方。',
    }
  }
  if (hasSpeedLowerRisk) {
    return {
      key: 'speed-risk',
      title: '速度/先手风险',
      description: '速度弱化或速度线损失需要结合对位确认。',
    }
  }
  if (/生命|耐久|承伤|防御|单防/.test(text) || ['hp', 'pdef', 'mdef'].includes(nature.lower)) {
    return {
      key: 'bulk-risk',
      title: '生命/防御风险',
      description: '防御侧取舍会影响承伤目标，通常需要明确场景。',
    }
  }
  if (hasMixedAttackConflict) {
    return {
      key: 'mixed-attack-risk',
      title: '双攻取舍风险',
      description: '面板或技能仍存在双攻可能，弱化另一攻需要保留风险提示。',
    }
  }
  return {
    key: 'other-risk',
    title: '其他低收益/局部风险',
    description: '整体收益不足或风险较分散，作为低优先级候选处理。',
  }
}

export function groupRejectedNatures(candidates = []) {
  const rejected = candidates.filter((item) => item.decision === 'notRecommended')
  const grouped = new Map()
  for (const item of rejected) {
    const group = rejectionGroupForNature(item)
    if (!grouped.has(group.key)) grouped.set(group.key, { ...group, items: [] })
    grouped.get(group.key).items.push(item)
  }
  const order = ['hard-speed', 'hard-mixed-attack', 'hard-bulk', 'hard-role', 'off-route-attack-raise', 'skill-output-conflict', 'dominated:', 'speed-risk', 'bulk-risk', 'mixed-attack-risk', 'other-risk']
  return [...grouped.values()]
    .map((group) => ({ ...group, items: [...group.items].sort((a, b) => b.score - a.score) }))
    .sort((a, b) => {
      const indexOf = (key) => {
        const matched = order.findIndex((prefix) => key.startsWith(prefix))
        return matched === -1 ? order.length : matched
      }
      return indexOf(a.key) - indexOf(b.key) || b.items.length - a.items.length || a.title.localeCompare(b.title)
    })
}

export function evaluateAllNatures(baseStats = {}, traitTags = [], skillInfo = {}, preference = {}) {
  const stats = numericStats(baseStats)
  const context = buildContext(stats, traitTags, skillInfo)
  const evaluated = NATURE_CANDIDATES.map((candidate) =>
    evaluateNatureCandidate(candidate, stats, traitTags, context, skillInfo, preference),
  )
  return [...applyDominance(evaluated)].sort((a, b) => {
    const decisionOrder = { recommended: 0, keepable: 1, notRecommended: 2 }
    return decisionOrder[a.decision] - decisionOrder[b.decision] || b.score - a.score
  })
}

// 兼容旧调用名：返回所有候选而非 top-N。
export function calculateNatureScores(baseStats = {}, traitTags = [], skillInfo = {}) {
  return evaluateAllNatures(baseStats, traitTags, skillInfo)
}

// 对原始六维应用性格加成：强化项 ×1.1、弱化项 ×0.9，四舍五入取整；
// 其余维度保持不变。
export function applyNatureModifier(baseStats = {}, nature) {
  const stats = numericStats(baseStats)
  const result = { ...stats }
  if (!nature || nature.raise == null || nature.lower == null) return result
  if (result[nature.raise] != null) result[nature.raise] = Math.round(result[nature.raise] * 1.1)
  if (result[nature.lower] != null) result[nature.lower] = Math.round(result[nature.lower] * 0.9)
  return result
}

export function explainNatureRecommendation(nature) {
  if (!nature) return '请先选择一个候选性格。'
  const segments = []
  if (nature.roleLabel) segments.push(`定位：${nature.roleLabel}`)
  if (nature.reasons?.length) segments.push(...nature.reasons)
  if (nature.warnings?.length) segments.push(`风险：${nature.warnings.join('；')}`)
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

function normalizeSkillCellValue(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  return String(value)
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}

// 提取技能/招式线索。当前预置资料未必包含技能字段；未来 d.json 同步出技能后，
// 只要字段 key/name 命中 skills/moves/技能/招式，即可进入规则引擎。
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
