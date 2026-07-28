import {
  evaluateNatureProfiles,
  natureName,
} from './nature.js'
import { buildNatureAnalysisInput } from './natureRowAdapter.js'
import { pveOverviewSummary } from './naturePve.js'
import {
  findNumberField,
  getSameNumberRows,
  visibleRockKingdomCreatureRows,
} from './rockKingdom.js'

export const PROTECTED_PARTNER_MARKS = new Set(['hp', 'pdef', 'mdef', 'spd'])
export const IMPORTANT_PARTNER_SPECIALTIES = new Set(['rideTogether', 'sharing'])
export const STARTER_SPECIES_GROUPS = new Set([
  '喵喵',
  '火花',
  '水蓝蓝',
  '松仔',
  '小勇狮',
  '水滴蛇',
])

function markValue(value) {
  return String(value || 'none')
}

function appearanceIsRare(value) {
  return Boolean(value && value !== 'none')
}

function usableNature(decision) {
  return decision === 'recommended' || decision === 'keepable'
}

function specialtyRank(value) {
  if (IMPORTANT_PARTNER_SPECIALTIES.has(value)) return 2
  return value ? 1 : 0
}

function stableCandidateCompare(left, right) {
  return (
    specialtyRank(right.specialty) - specialtyRank(left.specialty)
    || Number(markValue(right.actualMark) !== 'none') - Number(markValue(left.actualMark) !== 'none')
    || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
    || String(left.id).localeCompare(String(right.id))
  )
}

function recommendation(item, recommendedMark, reason, extra = {}) {
  const actualMark = markValue(item.actualMark)
  return {
    id: item.id,
    actualMark,
    recommendedMark,
    keep: recommendedMark !== 'none',
    protected: false,
    needsAdjustment: actualMark !== recommendedMark,
    reason,
    ...extra,
  }
}

function setRecommendation(results, item, recommendedMark, reason, extra) {
  results.set(item.id, recommendation(item, recommendedMark, reason, extra))
}

function preferredUsableMark(item) {
  if (item.pveEligible && (item.rare || item.starterException)) return 'lightning'
  return 'fruit'
}

// 输入是已经补齐性格分档和 PVE 资格的个体。该层只负责用户确认的保留、
// 去重和伙伴标记优先级，便于用小型固定样例回归，不依赖资料库或 React。
export function recommendPartnerMarks(items = []) {
  const results = new Map()
  const groups = new Map()
  for (const item of items) {
    const key = item.groupKey || item.creatureId || item.id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({
      ...item,
      actualMark: markValue(item.actualMark),
      rare: Boolean(item.rare),
    })
  }

  for (const group of groups.values()) {
    const coveredNatures = new Set()
    const coveredSpecialties = new Set()

    // 人工用途的四种标记是最高优先级输入：保持原样、跳过判断，但仍参与
    // “这个性格/特长已经有一只”的覆盖统计。
    for (const item of group) {
      if (!PROTECTED_PARTNER_MARKS.has(item.actualMark)) continue
      results.set(item.id, {
        id: item.id,
        actualMark: item.actualMark,
        recommendedMark: item.actualMark,
        keep: true,
        protected: true,
        needsAdjustment: false,
        reason: '生命、速度、物防或魔防属于人工保护标记，工具跳过判断。',
      })
      if (item.natureId) coveredNatures.add(item.natureId)
      if (item.specialty) coveredSpecialties.add(item.specialty)
    }

    // 稀有外观至少使用房屋；性格可用时果实优先，符合高投入 PVE 条件时
    // 闪电优先。稀有个体也会覆盖普通个体的相同性格和关键特长。
    for (const item of group) {
      if (results.has(item.id) || !item.rare) continue
      let mark = 'home'
      let reason = '稀有外观至少保留；性格未进入推荐或可保留，建议使用房屋。'
      if (usableNature(item.natureDecision)) {
        mark = preferredUsableMark(item)
        reason = mark === 'lightning'
          ? '稀有外观、性格适合高投入 PVE，建议使用闪电。'
          : '稀有外观且性格为推荐或可保留，建议使用果实。'
      }
      setRecommendation(results, item, mark, reason)
      if (item.natureId) coveredNatures.add(item.natureId)
      if (item.specialty) coveredSpecialties.add(item.specialty)
    }

    // 普通外观按性格去重。同一性格只留一只，关键特长优先于普通特长，
    // 普通特长优先于无特长；仍相同时尽量沿用已有标记，避免反复切换。
    const usableByNature = new Map()
    for (const item of group) {
      if (
        results.has(item.id)
        || item.rare
        || !item.natureId
        || !usableNature(item.natureDecision)
      ) continue
      if (!usableByNature.has(item.natureId)) usableByNature.set(item.natureId, [])
      usableByNature.get(item.natureId).push(item)
    }
    for (const [natureId, candidates] of usableByNature) {
      if (coveredNatures.has(natureId)) continue
      const winner = [...candidates].sort(stableCandidateCompare)[0]
      const mark = preferredUsableMark(winner)
      setRecommendation(
        results,
        winner,
        mark,
        mark === 'lightning'
          ? '普通御三家例外、性格适合高投入 PVE，建议使用闪电。'
          : '普通外观中保留这一只可用性格，建议使用果实。',
      )
      coveredNatures.add(natureId)
      if (winner.specialty) coveredSpecialties.add(winner.specialty)
    }

    // 同乘、爱分享允许各补一只性格不合适的普通个体；已经由受保护、
    // 稀有或可用性格个体覆盖时不再增加重复记录。
    for (const specialty of IMPORTANT_PARTNER_SPECIALTIES) {
      if (coveredSpecialties.has(specialty)) continue
      const candidates = group
        .filter((item) =>
          !results.has(item.id)
          && !item.rare
          && item.specialty === specialty
          && !usableNature(item.natureDecision))
        .sort(stableCandidateCompare)
      const winner = candidates[0]
      if (!winner) continue
      setRecommendation(
        results,
        winner,
        'home',
        `${specialty === 'sharing' ? '爱分享' : '同乘'}尚未由同组保留个体覆盖，性格不合适也额外保留一只。`,
      )
      coveredSpecialties.add(specialty)
    }

    for (const item of group) {
      if (results.has(item.id)) continue
      const duplicate = item.natureId && coveredNatures.has(item.natureId)
      setRecommendation(
        results,
        item,
        'none',
        duplicate
          ? '同组其他标记或优先个体已经覆盖这个性格，不再重复保留。'
          : '普通外观不符合性格保留规则，也没有未覆盖的同乘或爱分享特长。',
      )
    }
  }

  return results
}

function groupKeyForCreature(row, numberField) {
  const number = numberField ? String(row?.values?.[numberField.key] || '').trim() : ''
  return number ? `number:${number}` : `row:${row?.id || ''}`
}

function isStarterException(row) {
  const values = row?.values || {}
  const speciesGroup = String(values.speciesGroup || '').trim()
  if (STARTER_SPECIES_GROUPS.has(speciesGroup)) return true
  const evolutionStart = String(values.evolutionLine || '').split(/→|->/)[0].trim()
  return STARTER_SPECIES_GROUPS.has(evolutionStart)
}

function pveNatureIsEligible(candidates, candidate) {
  if (!candidate) return false
  const summary = pveOverviewSummary(candidates)
  if (!summary || !['priority', 'suitable'].includes(summary.tierKey)) return false
  const suggestedNames = String(summary.capture || '')
    .split('/')
    .map((value) => value.trim())
    .filter(Boolean)
  return suggestedNames.includes(natureName(candidate))
}

// 将资料库与收集记录适配成上面的纯规则输入。性格/PVE 计算按同编号形态组
// 缓存，同一组有数百个个体时也只分析一次。
export function buildRockPartnerMarkRecommendations({
  records = [],
  ownedFields = [],
  creatureRows = [],
  creatureFields = [],
  skillRows = [],
}) {
  const refField = ownedFields.find((field) => field.type === 'reference')
  const visibleRows = visibleRockKingdomCreatureRows(creatureRows)
  const creatureById = new Map(creatureRows.map((row) => [row.id, row]))
  const numberField = findNumberField(creatureFields)
  const groupAnalysis = new Map()

  function analysisFor(target) {
    const groupKey = groupKeyForCreature(target, numberField)
    if (groupAnalysis.has(groupKey)) return groupAnalysis.get(groupKey)
    const sameNumberRows = getSameNumberRows(target, visibleRows, creatureFields)
    const analysis = buildNatureAnalysisInput(
      target,
      sameNumberRows,
      creatureFields,
      skillRows,
      visibleRows,
    )
    const candidates = evaluateNatureProfiles(
      analysis.stats,
      analysis.traitTags,
      analysis.skillInfo,
      analysis.analysisProfiles,
      {
        primaryProfileId: target.id,
        primaryProfileLabel: [analysis.name, target.values?.form].filter(Boolean).join(' · '),
      },
    )
    const value = { groupKey, candidates }
    groupAnalysis.set(groupKey, value)
    return value
  }

  const items = records.map((record) => {
    const creatureId = refField ? record.values?.[refField.key] : ''
    const target = creatureById.get(creatureId)
    const natureId = String(record.values?.nature || '').trim()
    const rare = appearanceIsRare(record.values?.appearance)
      || record.values?.shiny === 'yes'
      || record.values?.colorful === 'yes'
    if (!target || !natureId) {
      return {
        id: record.id,
        creatureId,
        groupKey: target ? groupKeyForCreature(target, numberField) : `missing:${creatureId || record.id}`,
        natureId,
        natureDecision: '',
        pveEligible: false,
        starterException: target ? isStarterException(target) : false,
        rare,
        specialty: record.values?.specialty || '',
        actualMark: record.values?.partnerMark || 'none',
        createdAt: record.createdAt,
      }
    }
    const { groupKey, candidates } = analysisFor(target)
    const candidate = candidates.find((item) => item.id === natureId)
    return {
      id: record.id,
      creatureId,
      groupKey,
      natureId,
      natureDecision: candidate?.decision || '',
      pveEligible: pveNatureIsEligible(candidates, candidate),
      starterException: isStarterException(target),
      rare,
      specialty: record.values?.specialty || '',
      actualMark: record.values?.partnerMark || 'none',
      createdAt: record.createdAt,
    }
  })
  return recommendPartnerMarks(items)
}
