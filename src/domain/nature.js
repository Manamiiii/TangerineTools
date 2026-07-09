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

// 13 个特性标签对六维的倾向权重：0.5 = 轻度关联，1 = 主要关联，2 = 强关联。
// 只用于评价方向，不影响 applyNatureModifier 的实际加成幅度。
export const TRAIT_TAG_STAT_WEIGHTS = {
  attack: { patk: 1, matk: 1 },
  patkLean: { patk: 2 },
  matkLean: { matk: 2 },
  spdLean: { spd: 2 },
  defense: { hp: 0.75, pdef: 1, mdef: 1 },
  support: { hp: 0.75, pdef: 0.5, mdef: 0.5, spd: 0.5 },
  energyCycle: { spd: 1, hp: 0.25 },
  counterGain: { patk: 0.5, matk: 0.5 },
  growth: { patk: 0.5, matk: 0.5 },
  shieldReduce: { hp: 0.75, pdef: 1, mdef: 1 },
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
    core: { hp: 1.2, pdef: 1.1, mdef: 1.1 },
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
  const speedTraitTags = ['spdLean', 'control', 'pivot', 'energyCycle']
  const hasSpeedTrait = traitTags.some((tag) => speedTraitTags.includes(tag))
  const hasSpeedRole = roles.some((role) =>
    ['fastAttacker', 'support', 'energyCycle'].includes(role.key),
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
  const list = Array.isArray(source) ? source : [source]
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
  if (/先手|优先|抢先/.test(text)) tags.add('priority')
  if (/迅捷|速度[+-]|速度提升|速度降低|先手|高速/.test(text)) tags.add('speed')
  if (/回复|恢复|治疗|吸血|生命/.test(text)) tags.add('healing')
  if (/防御|护盾|减伤|承伤|抵抗|免疫/.test(text)) tags.add('damageReduction')
  if (/回复\d*能量|获得\d*能量|能量回复|迸发/.test(text)) tags.add('energyGain')
  if (/偷取.*能量|失去\d*能量|扣.*能量|能量减少/.test(text)) tags.add('energyDrain')
  if (/能耗[+-]|费用[+-]|消耗[+-]|全技能能耗/.test(text)) tags.add('costChange')
  if (/物攻\+|魔攻\+|双攻\+|物防\+|魔防\+|双防\+|威力\+|强化|提升|增加/.test(text)) tags.add('statBoost')
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
  const support = Boolean(sustain || effectTagCounts.statBoost || effectTagCounts.pivot)
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
    defense,
    energy,
    effectTagCounts,
    breakdown: {
      physicalCount: physicalItems.length,
      magicalCount: magicalItems.length,
      statusCount: statusItems.length,
      attackCount: attackItems.length,
      physicalAveragePower,
      magicalAveragePower,
      attackAveragePower: averagePower(attackItems),
      physicalShare: attackItems.length ? physicalItems.length / attackItems.length : 0,
      magicalShare: attackItems.length ? magicalItems.length / attackItems.length : 0,
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

export function analyzeSpeedProfile(baseStats = {}, traitTags = [], roles = null, skillProfile = null) {
  const stats = numericStats(baseStats)
  const roleList = roles || inferRoles(stats, traitTags)
  const extraTraitTags = skillProfile?.speedRequired ? [...traitTags, 'spdLean'] : traitTags
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
  if (analysis.bulkScore >= 285 || stats.hp >= STAT_PERCENTILE_BANDS.hp.p75) {
    addRole('bulky', 1.2, `生命 + 双防合计 ${analysis.bulkScore}，具备站场基础`)
  }
  if (stats.pdef >= STAT_PERCENTILE_BANDS.pdef.p75 && stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) {
    addRole('physicalWall', 1, '物防与生命足以支撑物理防御手路线')
  }
  if (stats.mdef >= STAT_PERCENTILE_BANDS.mdef.p75 && stats.hp >= STAT_PERCENTILE_BANDS.hp.p50) {
    addRole('magicalWall', 1, '魔防与生命足以支撑魔法防御手路线')
  }

  if (traitTags.includes('patkLean')) addRole('physicalAttacker', 1.6, '特性标签偏物攻输出')
  if (traitTags.includes('matkLean')) addRole('magicalAttacker', 1.6, '特性标签偏魔攻输出')
  if (traitTags.includes('attack')) addRole('mixedAttacker', 1.2, '特性标签支持双攻输出')
  if (traitTags.includes('spdLean') || traitTags.includes('control')) {
    addRole('fastAttacker', 1.4, '特性标签强调速度/先手控制')
  }
  if (traitTags.includes('defense') || traitTags.includes('shieldReduce')) {
    addRole('bulky', 1.3, '特性标签支持耐久站场')
  }
  if (traitTags.includes('support') || traitTags.includes('pivot')) {
    addRole('support', 1.2, '特性标签支持辅助/返场')
  }
  if (traitTags.includes('energyCycle')) addRole('energyCycle', 1.3, '特性标签支持能量循环')
  if (skillProfile.attackMode === 'physical') addRole('physicalAttacker', 1.4, '技能效果标签偏物理输出')
  if (skillProfile.attackMode === 'magical') addRole('magicalAttacker', 1.4, '技能效果标签偏魔法输出')
  if (skillProfile.attackMode === 'mixed') addRole('mixedAttacker', 1.1, '技能效果同时覆盖物理与魔法')
  if (skillProfile.speedRequired || skillProfile.control) {
    addRole('fastAttacker', 1.1, '技能线索强调先手/控制节奏')
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
  return { analysis, roles, speedProfile, skillProfile, traitWeights, coreWeights, expendableWeights }
}

function statDelta(baseStats, nature) {
  const adjusted = applyNatureModifier(baseStats, nature)
  return Object.fromEntries(MODIFIABLE_STAT_KEYS.map((key) => [key, adjusted[key] - (baseStats[key] || 0)]))
}

function decisionFromScore(score, hardRisk) {
  if (hardRisk || score < 35) return 'notRecommended'
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


function isSingleDefenseRaiseSoftCapped(candidate, roles = [], traitTags = []) {
  if (!['pdef', 'mdef'].includes(candidate.raise)) return false
  const topRoles = roles.slice(0, 2)
  const topRolesNeedDefense = topRoles.some((role) => (ROLE_DEFINITIONS[role.key]?.core?.[candidate.raise] || 0) > 0)
  if (topRolesNeedDefense) return false
  const hasDefenseTrait = traitTags.some((tag) => ['defense', 'shieldReduce'].includes(tag))
  if (hasDefenseTrait) return false
  return roles.some((role) => (ROLE_DEFINITIONS[role.key]?.core?.[candidate.raise] || 0) > 0)
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
  const { analysis, roles, speedProfile, skillProfile, traitWeights, coreWeights, expendableWeights } = context
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
  if (skillProfile.attackMode === 'physical' && candidate.raise === 'patk') {
    score += 10
    reasons.push('技能效果标签偏物理输出，强化物攻更贴合技能组')
  }
  if (skillProfile.attackMode === 'magical' && candidate.raise === 'matk') {
    score += 10
    reasons.push('技能效果标签偏魔法输出，强化魔攻更贴合技能组')
  }
  if (skillProfile.attackMode === 'physical' && candidate.lower === 'patk') {
    score -= 18
    warnings.push('技能效果标签偏物理输出，弱化物攻存在冲突')
  }
  if (skillProfile.attackMode === 'magical' && candidate.lower === 'matk') {
    score -= 18
    warnings.push('技能效果标签偏魔法输出，弱化魔攻存在冲突')
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
    score += 5
    reasons.push('技能效果包含异常/控制，强化速度有助于先手施压')
  }
  if (skillProfile.backLoaded && candidate.lower === 'spd') {
    score += 10
    reasons.push('技能线索存在后手/反击收益，减速可作为战术牺牲项')
  }
  if (skillProfile.speedRequired && candidate.raise === 'spd') {
    score += 10
    reasons.push('技能线索依赖先手/优先节奏，强化速度更有价值')
  }
  if (skillProfile.speedRequired && candidate.lower === 'spd') {
    score -= 12
    warnings.push('技能线索依赖先手/优先节奏，弱化速度风险较高')
  }

  if (raiseCore > 0.8) reasons.push(roleAwareStatReason(roles, candidate.raise, raiseLabel, '强化'))
  if (raiseTrait > 0) reasons.push(`特性标签支持强化${raiseLabel}`)
  if (lowerExpendable > 1) reasons.push(`弱化${lowerLabel}的代价较低，适合作为当前路线的牺牲项`)
  if (lowerCore > 1) warnings.push(roleAwareStatWarning(roles, candidate.lower, lowerLabel))
  if (lowerTrait > raiseTrait && lowerTrait > 0) warnings.push(`特性标签更需要${lowerLabel}，弱化存在冲突`)
  if (ATTACK_STAT_KEYS.includes(candidate.lower) && roles.some((r) => r.key === 'mixedAttacker')) {
    warnings.push('当前存在双攻潜力，弱化任一攻击都需要技能池证明可以转为单攻玩法')
  }

  const hardRisk =
    lowerCore >= 3.2 ||
    (candidate.lower === 'spd' && roles.some((r) => ['fastAttacker', 'energyCycle'].includes(r.key))) ||
    (candidate.lower === 'hp' && roles.some((r) => ['bulky', 'support'].includes(r.key)) && lowerExpendable < 1)
  const singleDefenseSoftCap = isSingleDefenseRaiseSoftCapped(candidate, roles, traitTags)

  if (hardRisk) score -= 8
  let decision = decisionFromScore(score, hardRisk)
  if (singleDefenseSoftCap && decision === 'recommended') {
    decision = 'keepable'
    warnings.push('单防强化主要来自次要防御/辅助线索，主定位未明确要求该防御项，默认降为可保留')
  }

  return applyNaturePreference({
    ...candidate,
    score: Math.round(score * 10) / 10,
    decision,
    roleTags: roles.map((r) => r.key),
    roleLabel: roleLabels.join(' / ') || '泛用',
    speedProfile,
    skillProfile,
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
      if (item.reasons.some((reason) => /专项|速度 .*提升到/.test(reason))) continue
      const target = byKey.get(dominanceKey(item))
      if (!target) continue
      target.decision = 'notRecommended'
      target.dominatedBy = natureName(best)
      target.warnings = [
        ...target.warnings,
        `同样强化${STAT_LABELS[raise]}时，${natureName(best)}代价更低，因此当前组合被支配`,
      ]
    }
  }

  return result
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
