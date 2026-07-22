import { STATS_DIMENSIONS } from '../constants.js'
import { natureName, STAT_LABELS } from './nature.js'

const PVE_TIER_SCALE = [
  { key: 'priority', label: '优先培养', level: 'priority' },
  { key: 'suitable', label: '适合培养', level: 'good' },
  { key: 'situational', label: '按需培养', level: 'situational' },
  { key: 'watch', label: '可留观望', level: 'watch' },
  { key: 'skip', label: '不建议投入', level: 'risk' },
]

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1)
}

export function pveStarText(stars = 0) {
  const filled = Math.max(0, Math.min(5, Number(stars) || 0))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

export function pveOverviewSummary(candidates = []) {
  if (candidates.length === 0) return null
  const recommended = candidates.filter((item) => item.decision === 'recommended')
  const keepable = candidates.filter((item) => item.decision === 'keepable')
  const pvePool = [...recommended, ...keepable]
  const profile = pveSpeciesProfile(candidates)
  const best = bestPveCandidate(pvePool, profile) || recommended[0] || keepable[0] || candidates[0]
  const pairCandidates = pvePairedCandidates(pvePool, profile, best)
  const primaryName = pveNatureSummary(best, pairCandidates) || '暂无推荐性格'
  const primaryStat = pvePrimaryStatSummary(best, pairCandidates)
  const alternatives = pveAlternativeSummary(best, pairCandidates)
  const hasViableNature = pvePool.some((item) => item && !item.hardRisk)
  const detail = profile.basis.length ? `依据：${profile.basis.join('；')}。` : ''
  const tier = PVE_TIER_SCALE.find((item) => item.key === profile.tier) || PVE_TIER_SCALE.at(-1)
  const tierIndex = PVE_TIER_SCALE.findIndex((item) => item.key === tier.key) + 1
  const stars = Math.max(1, PVE_TIER_SCALE.length - tierIndex + 1)

  if (!hasViableNature) {
    return {
      level: 'risk',
      badge: profile.score >= 5 ? '需换性格' : '不建议投入',
      verdict: profile.score >= 5
        ? '精灵机制有 PVE 价值，但当前候选性格风险过高，建议另抓。'
        : '当前未发现足够 PVE 机制或可用性格，先收藏不投入。',
      capture: '无',
      primaryStat: '无',
      role: profile.label,
      alternatives: '',
      tags: profile.tags,
      detail,
      tierKey: profile.score >= 5 ? 'skip' : tier.key,
      stars: 1,
    }
  }

  const summaries = {
    priority: {
      level: 'priority',
      badge: '优先培养',
      verdict: `${profile.label}，资源投入优先级高；优先看${primaryName}。`,
    },
    suitable: {
      level: 'good',
      badge: '适合培养',
      verdict: `${profile.label}，适合 PVE 投入；性格看${primaryName}。`,
    },
    situational: {
      level: 'situational',
      badge: '按需培养',
      verdict: `${profile.label}，有对应副本/队伍需求再投入；当前可看${primaryName}。`,
    },
    watch: {
      level: 'watch',
      badge: '可留观望',
      verdict: `${profile.label}，捕捉可留不等于 PVE 优先；先收藏观望。`,
    },
    skip: {
      level: 'risk',
      badge: '不建议投入',
      verdict: '当前没有识别到足够 PVE 投入价值；捕捉可留不等于值得培养。',
    },
  }
  const summary = summaries[profile.tier] || summaries.watch
  return {
    ...summary,
    capture: primaryName,
    primaryStat,
    role: profile.label,
    alternatives,
    tags: profile.tags,
    detail,
    tierKey: tier.key,
    stars,
  }
}

function pvePairedCandidates(candidates = [], profile = null, best = null) {
  const stats = profile?.pairedStats || []
  if (stats.length === 0) return []
  return stats
    .map((stat) => bestPveCandidate(candidates.filter((candidate) => candidate.raise === stat), profile))
    .filter((candidate) => candidate && candidate !== best)
    .filter((candidate, index, list) => list.findIndex((item) => natureName(item) === natureName(candidate)) === index)
}

function pveNatureSummary(best, alternatives = []) {
  const names = [best, ...alternatives].filter(Boolean).map(natureName)
  return [...new Set(names)].join(' / ')
}

function pvePrimaryStatSummary(best, alternatives = []) {
  const stats = [best, ...alternatives]
    .filter(Boolean)
    .map((candidate) => STAT_LABELS[candidate.raise])
    .filter(Boolean)
  return [...new Set(stats)].join(' / ') || '无'
}

function pveAlternativeSummary(best, alternatives = []) {
  const bestName = best ? natureName(best) : ''
  const names = alternatives.map(natureName).filter((name) => name && name !== bestName)
  return [...new Set(names)].join(' / ')
}

function bestPveCandidate(candidates = [], profile = null) {
  const preferredStats = profile?.preferredStats || []
  return [...candidates]
    .filter((candidate) => candidate && !candidate.hardRisk)
    .sort((a, b) => {
      const preferredDiff = preferredStatRank(b, preferredStats) - preferredStatRank(a, preferredStats)
      if (preferredDiff !== 0) return preferredDiff
      return pveCandidateRank(b, profile) - pveCandidateRank(a, profile) || b.score - a.score
    })[0] || null
}

function preferredStatRank(candidate, preferredStats = []) {
  const index = preferredStats.indexOf(candidate?.raise)
  return index < 0 ? 0 : preferredStats.length - index
}

function pveCandidateRank(candidate, profile = null) {
  const breakdown = candidate.skillProfile?.breakdown || {}
  const raisesAttack = ['patk', 'matk'].includes(candidate.raise)
  const raisesSpeed = candidate.raise === 'spd'
  const raisesBulk = ['hp', 'pdef', 'mdef'].includes(candidate.raise)
  const hasOutputRole = candidate.roleTags?.some((role) =>
    ['mixedAttacker', 'physicalAttacker', 'magicalAttacker'].includes(role),
  )
  const hasBulkRole = candidate.roleTags?.some((role) =>
    ['bulky', 'support', 'physicalWall', 'magicalWall'].includes(role),
  )
  const hasSpeedRole = candidate.roleTags?.some((role) => role === 'fastAttacker')
  const strongOutput =
    Number(breakdown.attackAveragePower) >= 80 &&
    Number(breakdown.attackCount) >= 8 &&
    hasOutputRole
  const riskySpeedBranch =
    raisesSpeed &&
    candidate.warnings.some((warning) => /双攻|弱化另一攻|削弱.*攻击|冲突/.test(warning))

  let rank = candidate.score
  if (raisesAttack && strongOutput && profile?.tier === 'priority') rank += 36
  if (raisesAttack && strongOutput && profile?.tier !== 'priority') rank += 16
  if (raisesBulk && hasBulkRole) rank += profile?.mechanism === 'tank' ? 36 : 24
  if (raisesSpeed && hasSpeedRole) rank += profile?.mechanism === 'carry' ? 18 : 10
  if (raisesSpeed && !hasSpeedRole) rank -= 28
  if (riskySpeedBranch) rank -= 26
  if (candidate.warnings.length > 0) rank -= Math.min(candidate.warnings.length * 4, 24)
  return rank
}

export function pveSpeciesProfile(candidates = []) {
  const sample = candidates.find(Boolean) || {}
  const skillProfile = sample.skillProfile || {}
  const breakdown = skillProfile.breakdown || {}
  const roleTags = sample.roleTags || []
  const stats = baseStatsFromCandidate(sample)
  const texts = skillProfile.texts || []
  const joined = texts.join('；')
  const hasRecommendedCore = candidates.some((item) =>
    item.decision === 'recommended' &&
    !item.hardRisk &&
    ['patk', 'matk', 'spd'].includes(item.raise) &&
    item.warnings.length === 0
  )
  const attackCount = Number(breakdown.attackCount) || 0
  const attackShare = Number(breakdown.attackShare) || 0
  const attackAveragePower = Number(breakdown.attackAveragePower) || 0
  const physicalCount = Number(breakdown.physicalCount) || 0
  const magicalCount = Number(breakdown.magicalCount) || 0
  const physicalShare = Number(breakdown.physicalShare) || 0
  const magicalShare = Number(breakdown.magicalShare) || 0
  const physicalRouteScore = Number(breakdown.physicalRouteScore) || 0
  const magicalRouteScore = Number(breakdown.magicalRouteScore) || 0
  const strongAttackStat = Math.max(stats.patk || 0, stats.matk || 0)
  const hasSingleOutputRole = roleTags.some((role) => ['physicalAttacker', 'magicalAttacker'].includes(role))
  const hasFastRole = roleTags.includes('fastAttacker')
  const hasBulkRole = roleTags.some((role) =>
    ['bulky', 'support', 'physicalWall', 'magicalWall', 'energyCycle'].includes(role),
  )
  const dotPattern = /中毒|剧毒|灼烧|烧伤|寄生|星陨|持续伤害|灼烧.*层|中毒.*层|回合结束.*(?:中毒|灼烧|寄生|星陨|持续伤害|伤害)/
  const dotCount = texts.filter((text) => dotPattern.test(text)).length
  const dotShare = texts.length ? dotCount / texts.length : 0
  const hasDot = dotCount >= 4 && (dotShare >= 0.18 || dotCount >= 8)
  const hasPercentOrTrueDamage = /百分比|最大生命|生命值上限|真实伤害|真伤|固定伤害/.test(joined)
  const hasLoop = Boolean(skillProfile.energy || /能耗-|能耗降低|回复\d*能量|获得\d*能量|自动回能|技能循环|连续释放/.test(joined))
  const hasTeamUtility = Boolean(skillProfile.boostTransfer)
  const hasSustain = Boolean(skillProfile.sustain || skillProfile.defense)
  const hasControl = Boolean(skillProfile.control)
  const hasAdvancedMechanism = hasDot || hasPercentOrTrueDamage || hasTeamUtility
  const hasFocusedOutputRoute =
    ((stats.patk || 0) >= 120 && physicalCount >= 8 && physicalShare >= 0.65 && physicalRouteScore >= 12) ||
    ((stats.matk || 0) >= 120 && magicalCount >= 8 && magicalShare >= 0.65 && magicalRouteScore >= 12)
  const highOutputEvidence =
    hasSingleOutputRole &&
    strongAttackStat >= 115 &&
    attackCount >= 4 &&
    (attackAveragePower >= 75 || hasFocusedOutputRoute)
  const fastCarryEvidence =
    highOutputEvidence &&
    hasFastRole &&
    (stats.spd || 0) >= 110 &&
    hasRecommendedCore &&
    (attackShare >= 0.45 || attackAveragePower >= 90)
  const carrySuitableEvidence =
    highOutputEvidence &&
    (hasFastRole || strongAttackStat >= 130 || attackAveragePower >= 90)
  const mechanismScore =
    (hasDot ? 2 : 0) +
    (hasPercentOrTrueDamage ? 2 : 0) +
    (hasLoop ? 1.5 : 0) +
    (hasTeamUtility ? 2 : 0) +
    (hasSustain ? 1 : 0) +
    (hasControl ? 0.8 : 0)
  const basis = [
    highOutputEvidence && `输出线：主攻 ${strongAttackStat} / 攻击技能 ${attackCount} / 均威 ${formatNumber(attackAveragePower)}`,
    hasDot && '存在 DOT/层数/回合结束触发线索',
    hasPercentOrTrueDamage && '存在百分比或真伤线索',
    hasLoop && '存在能量/能耗循环线索',
    hasTeamUtility && '存在队伍增益或传递线索',
    hasSustain && '存在续航/减伤/站场线索',
    hasControl && '存在控制/异常线索',
  ].filter(Boolean)
  const tags = [
    hasDot && 'DOT/层数',
    hasPercentOrTrueDamage && '百分比/真伤',
    hasTeamUtility && '队伍插件',
    hasLoop && '能量循环',
    hasSustain && '续航站场',
    hasControl && !hasDot && '控制异常',
  ].filter(Boolean).slice(0, 4)

  const profile = { skillProfile, stats, highOutputEvidence, hasFastRole, hasBulkRole, hasAdvancedMechanism, hasDot, hasPercentOrTrueDamage, hasLoop, hasTeamUtility, hasSustain, hasControl, hasRecommendedCore, fastCarryEvidence, carrySuitableEvidence, mechanismScore, basis, tags }
  return classifyPveProfile(profile)
}

function classifyPveProfile(profile) {
  const {
    skillProfile, stats, highOutputEvidence, hasFastRole, hasBulkRole, hasAdvancedMechanism,
    hasDot, hasPercentOrTrueDamage, hasLoop, hasTeamUtility, hasSustain, hasControl,
    hasRecommendedCore, fastCarryEvidence, carrySuitableEvidence, mechanismScore, basis, tags,
  } = profile
  if (fastCarryEvidence || (highOutputEvidence && hasRecommendedCore && mechanismScore < 2.5)) {
    return {
      tier: 'priority', mechanism: 'carry',
      label: hasFastRole ? '高速主 C / 清场输出' : '主 C 输出',
      preferredStats: pvePreferredStats(skillProfile, stats, 'carry'),
      pairedStats: pveCarryPairedStats(skillProfile, stats), score: 8 + mechanismScore, basis, tags,
    }
  }
  if (carrySuitableEvidence) {
    return {
      tier: 'suitable', mechanism: 'carry',
      label: hasFastRole ? '高速输出 / PVE 打手' : '输出打手 / PVE 补强',
      preferredStats: pvePreferredStats(skillProfile, stats, 'carry'),
      pairedStats: pveCarryPairedStats(skillProfile, stats), score: 6 + mechanismScore, basis,
      tags: tags.filter((tag) => tag !== '续航站场' && tag !== '控制异常'),
    }
  }
  if (hasPercentOrTrueDamage || hasTeamUtility || (hasDot && mechanismScore >= 3.5)) {
    const label = hasDot ? 'DOT 消耗位' : hasPercentOrTrueDamage ? '机制消耗位' : '功能循环 / 队伍插件'
    const mechanism = hasDot || hasPercentOrTrueDamage ? 'dot' : 'utility'
    return {
      tier: 'suitable', mechanism, label,
      preferredStats: pvePreferredStats(skillProfile, stats, mechanism),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 6 + mechanismScore, basis, tags,
    }
  }
  if ((hasBulkRole && (hasSustain || mechanismScore >= 1.5)) || (hasLoop && hasControl) || (hasLoop && hasSustain)) {
    const utility = hasLoop && (hasControl || hasSustain)
    const mechanism = utility ? 'utility' : 'tank'
    return {
      tier: 'situational', mechanism,
      label: utility ? (hasAdvancedMechanism ? '功能循环 / 机制位' : '功能循环 / 对策位') : '站场功能 / 按需承伤位',
      preferredStats: pvePreferredStats(skillProfile, stats, mechanism),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 4 + mechanismScore, basis, tags,
    }
  }
  if (highOutputEvidence || hasLoop || hasControl || hasSustain) {
    const mechanism = highOutputEvidence ? 'carry' : 'utility'
    return {
      tier: 'watch', mechanism, label: highOutputEvidence ? '输出补位' : '功能补位',
      preferredStats: pvePreferredStats(skillProfile, stats, mechanism),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 3 + mechanismScore, basis, tags,
    }
  }
  return { tier: 'skip', mechanism: 'unknown', label: 'PVE 机制不明确', preferredStats: [], score: mechanismScore, basis, tags }
}

function baseStatsFromCandidate(candidate = {}) {
  return Object.fromEntries(STATS_DIMENSIONS.map((dimension) => {
    const adjusted = Number(candidate.adjustedStats?.[dimension.key]) || 0
    const delta = Number(candidate.deltas?.[dimension.key]) || 0
    return [dimension.key, adjusted - delta]
  }))
}

function pvePreferredStats(skillProfile = {}, stats = {}, mechanism = 'utility') {
  const mode = skillProfile.attackMode
  const attackStat = mode === 'physical' ? 'patk' : mode === 'magical' ? 'matk' : null
  const speedFirst = (stats.spd || 0) >= 100 || skillProfile.speedRequired || skillProfile.control
  if (mechanism === 'carry') return [speedFirst && 'spd', attackStat, 'hp', 'pdef', 'mdef'].filter(Boolean)
  if (mechanism === 'dot') return [speedFirst && 'spd', 'hp', (stats.mdef || 0) >= (stats.pdef || 0) ? 'mdef' : 'pdef', attackStat].filter(Boolean)
  if (mechanism === 'tank') return ['hp', (stats.pdef || 0) <= (stats.mdef || 0) ? 'pdef' : 'mdef', (stats.pdef || 0) > (stats.mdef || 0) ? 'pdef' : 'mdef']
  return [speedFirst && 'spd', 'hp', attackStat, 'pdef', 'mdef'].filter(Boolean)
}

function pveCarryPairedStats(skillProfile = {}, stats = {}) {
  const mode = skillProfile.attackMode
  const attackStat = mode === 'physical' ? 'patk' : mode === 'magical' ? 'matk' : null
  const speedUseful = (stats.spd || 0) >= 95 || skillProfile.speedRequired || skillProfile.control
  return [speedUseful && 'spd', attackStat].filter(Boolean)
}
