// 洛克王国孵蛋推荐纯函数。
// 蛋组与繁育谱系读取正式资料；用户规则只影响派生排序，不写回资料库或收集记录。

import { evaluateAllNatures } from './nature.js'
import { extractSkillInfoFromReferenceRows, extractSkillRefsFromRow, extractStatsFromRow, extractTraitTagsFromRow } from './natureRowAdapter.js'
import { BILI_EGG_GROUP_SOURCE_URL } from './breedingData.js'

export const EGG_GROUP_SOURCE_URL = BILI_EGG_GROUP_SOURCE_URL
export const BREEDING_RULE_STORAGE_KEY = 'tangerine:rock-kingdom:breeding-rules'

export const DEFAULT_BREEDING_RULES = Object.freeze([
  { id: 'missingShiny', label: '缺异色', description: '目标谱系尚无异色时，优先选择能提供异色概率的父母。', goal: true },
  { id: 'missingColorful', label: '缺炫彩', description: '目标谱系尚无炫彩时，优先选择能提供炫彩概率的父母。', goal: true },
  { id: 'missingShinyMale', label: '缺异色公', description: '已有异色但缺少异色公时，优先继续补齐性别。', goal: true },
  { id: 'missingShinyFemale', label: '缺异色母', description: '已有异色但缺少异色母时，优先继续补齐性别。', goal: true },
  { id: 'missingGoodNature', label: '缺好性格', description: '目标谱系没有推荐或可保留性格时，优先使用能遗传好性格的父母。', goal: true },
  { id: 'goodNatureCarrier', label: '好性格遗传', description: '父母性格按孩子目标判断；推荐优先于可保留。' },
  { id: 'shinyParents', label: '异色父母更多', description: '相同目标下优先提高异色概率。' },
  { id: 'colorfulParents', label: '炫彩父母更多', description: '相同目标下优先提高炫彩概率。' },
  { id: 'recordOrder', label: '收集记录靠前', description: '其余条件相同时保持稳定的收集记录顺序。' },
])

export const BREEDING_PRIORITY_RULES = DEFAULT_BREEDING_RULES.map((rule) => rule.label)

const FEMALE = 'female'
const MALE = 'male'
const UNBREEDABLE_GROUP = '无法孵蛋'

function normText(value) {
  return String(value || '').trim()
}

function yes(value) {
  return value === true || value === 'yes' || value === '异色' || value === '是'
}

export function splitGroups(value) {
  if (Array.isArray(value)) return value.map(normText).filter(Boolean)
  return normText(value).split(/[、,，/|\s]+/).map(normText).filter(Boolean)
}

export function speciesKey(row) {
  const explicit = normText(row.values?.speciesGroup || row.values?.breedingLine || row.values?.sameSpecies)
  if (explicit) return explicit
  const no = normText(row.values?.no).replace(/^NO\.?/i, '')
  const n = Number(no)
  if (Number.isFinite(n) && n > 1) return String(Math.ceil(n / 3))
  return normText(row.values?.name) || row.id
}

function displayName(row) {
  return [row.values?.no, row.values?.name, row.values?.form].filter(Boolean).join(' · ')
}

function getEggGroups(row) {
  return splitGroups(row.values?.eggGroups || row.values?.eggGroup || row.values?.蛋组)
    .filter((group) => group !== UNBREEDABLE_GROUP)
}

function commonGroup(a, b) {
  const set = new Set(a.catalog.eggGroups)
  return b.catalog.eggGroups.find((group) => set.has(group)) || ''
}

function natureRanksForRow(row, catalogFields, skillRows) {
  const skillRefs = extractSkillRefsFromRow(row, catalogFields)
  const referencedSkillRows = skillRows.filter((skillRow) => skillRefs.includes(skillRow.id))
  const skillInfo = extractSkillInfoFromReferenceRows(referencedSkillRows)
  const ranks = new Map()
  for (const result of evaluateAllNatures(
    extractStatsFromRow(row, catalogFields) || {},
    extractTraitTagsFromRow(row, catalogFields),
    skillInfo,
  )) {
    const rank = result.decision === 'recommended' ? 2 : result.decision === 'keepable' ? 1 : 0
    if (!rank) continue
    ranks.set(result.id, Math.max(ranks.get(result.id) || 0, rank))
    ranks.set(result.name, Math.max(ranks.get(result.name) || 0, rank))
  }
  return ranks
}

function mergeNatureRanks(target, source) {
  for (const [nature, rank] of source) {
    target.set(nature, Math.max(target.get(nature) || 0, rank))
  }
}

function createCatalogProfiles(catalogRows) {
  return new Map(catalogRows.map((row) => [row.id, {
    row,
    speciesKey: speciesKey(row),
    eggGroups: getEggGroups(row),
    natureRanks: new Map(),
  }]))
}

function hydrateNatureRanks(profiles, speciesKeys, catalogFields, skillRows) {
  for (const profile of profiles.values()) {
    if (!speciesKeys.has(profile.speciesKey)) continue
    profile.natureRanks = natureRanksForRow(profile.row, catalogFields, skillRows)
  }
}

function buildOwnedFromProfiles(ownedRows, profiles) {
  return ownedRows.map((owned, index) => {
    const catalog = profiles.get(owned.values?.ref) || null
    if (!catalog) return null
    return {
      id: owned.id,
      order: index,
      name: displayName(catalog.row),
      owned,
      gender: owned.values?.gender,
      nature: owned.values?.nature,
      shiny: yes(owned.values?.shiny),
      colorful: yes(owned.values?.colorful),
      catalog,
    }
  }).filter(Boolean)
}

export function buildOwnedCreatures({ ownedRows = [], catalogRows = [], catalogFields = [], skillRows = [] }) {
  const profiles = createCatalogProfiles(catalogRows)
  const creatures = buildOwnedFromProfiles(ownedRows, profiles)
  hydrateNatureRanks(profiles, new Set(creatures.map((item) => item.catalog.speciesKey)), catalogFields, skillRows)
  return creatures
}

function emptyRareSummary() {
  return { total: 0, male: 0, female: 0 }
}

function buildSpeciesSummary(profiles, creatures) {
  const groups = new Map()
  for (const profile of profiles.values()) {
    if (profile.eggGroups.length === 0) continue
    const key = profile.speciesKey
    const current = groups.get(key) || {
      id: key,
      name: key,
      image: '',
      eggGroups: [],
      catalogRows: [],
      natureRanks: new Map(),
      ownedCount: 0,
      shiny: emptyRareSummary(),
      colorful: emptyRareSummary(),
      goodNature: { total: 0, recommended: 0, keepable: 0 },
    }
    current.catalogRows.push(profile.row)
    current.image ||= profile.row.values?.image || ''
    current.eggGroups = [...new Set([...current.eggGroups, ...profile.eggGroups])]
    mergeNatureRanks(current.natureRanks, profile.natureRanks)
    groups.set(key, current)
  }

  for (const creature of creatures) {
    const summary = groups.get(creature.catalog.speciesKey)
    if (!summary) continue
    summary.ownedCount += 1
    for (const [rareKey, hasRare] of [['shiny', creature.shiny], ['colorful', creature.colorful]]) {
      if (!hasRare) continue
      summary[rareKey].total += 1
      if (creature.gender === MALE) summary[rareKey].male += 1
      if (creature.gender === FEMALE) summary[rareKey].female += 1
    }
    const natureRank = summary.natureRanks.get(creature.nature) || 0
    if (natureRank > 0) {
      summary.goodNature.total += 1
      if (natureRank === 2) summary.goodNature.recommended += 1
      else summary.goodNature.keepable += 1
    }
  }

  for (const summary of groups.values()) {
    summary.missing = {
      shiny: summary.shiny.total === 0,
      colorful: summary.colorful.total === 0,
      shinyMale: summary.shiny.total > 0 && summary.shiny.male === 0,
      shinyFemale: summary.shiny.total > 0 && summary.shiny.female === 0,
      colorfulMale: summary.colorful.total > 0 && summary.colorful.male === 0,
      colorfulFemale: summary.colorful.total > 0 && summary.colorful.female === 0,
      goodNature: summary.goodNature.total === 0,
    }
    summary.hasGap = Object.values(summary.missing).some(Boolean)
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function buildBreedingDataset(input = {}) {
  const profiles = createCatalogProfiles(input.catalogRows || [])
  const creatures = buildOwnedFromProfiles(input.ownedRows || [], profiles)
  hydrateNatureRanks(
    profiles,
    new Set(creatures.map((item) => item.catalog.speciesKey)),
    input.catalogFields || [],
    input.skillRows || [],
  )
  return {
    creatures,
    species: buildSpeciesSummary(profiles, creatures),
  }
}

export function summarizeMissingEggGroups(creatures = []) {
  const missing = creatures.filter((item) => item.catalog.eggGroups.length === 0)
  const grouped = new Map()
  for (const item of missing) {
    const key = item.catalog.row.id
    const current = grouped.get(key) || { catalogRowId: key, name: item.name, recordCount: 0 }
    current.recordCount += 1
    grouped.set(key, current)
  }
  return { recordCount: missing.length, creatureCount: grouped.size, creatures: [...grouped.values()] }
}

export function normalizeBreedingRules(rules) {
  const configured = Array.isArray(rules) ? rules : []
  const defaults = new Map(DEFAULT_BREEDING_RULES.map((rule) => [rule.id, rule]))
  const normalized = []
  for (const item of configured) {
    const fallback = defaults.get(item?.id)
    if (!fallback || normalized.some((rule) => rule.id === fallback.id)) continue
    normalized.push({ ...fallback, enabled: item.enabled !== false })
  }
  for (const fallback of DEFAULT_BREEDING_RULES) {
    if (!normalized.some((rule) => rule.id === fallback.id)) {
      normalized.push({ ...fallback, enabled: true })
    }
  }
  return normalized
}

function ruleValue(ruleId, context) {
  const { target, shinyParents, colorfulParents, goodNatureRank, mother, father } = context
  switch (ruleId) {
    case 'missingShiny': return target.missing.shiny ? shinyParents : 0
    case 'missingColorful': return target.missing.colorful ? colorfulParents : 0
    case 'missingShinyMale': return target.missing.shinyMale ? shinyParents : 0
    case 'missingShinyFemale': return target.missing.shinyFemale ? shinyParents : 0
    case 'missingGoodNature': return target.missing.goodNature ? goodNatureRank : 0
    case 'goodNatureCarrier': return goodNatureRank
    case 'shinyParents': return shinyParents
    case 'colorfulParents': return colorfulParents
    case 'recordOrder': return -(mother.order + father.order)
    default: return 0
  }
}

export function recommendBreedingPairs(
  creatures,
  { pairCount = 5, rules = DEFAULT_BREEDING_RULES, species = [] } = {},
) {
  const activeRules = normalizeBreedingRules(rules).filter((rule) => rule.enabled)
  const activeGoalRules = activeRules.filter((rule) => rule.goal)
  const speciesByKey = new Map(species.map((item) => [item.id, item]))
  const males = creatures.filter((item) => item.gender === MALE && item.catalog.eggGroups.length)
  const females = creatures.filter((item) => item.gender === FEMALE && item.catalog.eggGroups.length)
  const pairs = []

  for (const mother of females) {
    const target = speciesByKey.get(mother.catalog.speciesKey)
    if (!target) continue
    for (const father of males) {
      const eggGroup = commonGroup(mother, father)
      if (!eggGroup) continue
      const shinyParents = Number(father.shiny) + Number(mother.shiny)
      const colorfulParents = Number(father.colorful) + Number(mother.colorful)
      const goodNatureRank = Math.max(
        target.natureRanks.get(father.nature) || 0,
        target.natureRanks.get(mother.nature) || 0,
      )
      const context = { target, shinyParents, colorfulParents, goodNatureRank, mother, father }
      const values = Object.fromEntries(activeRules.map((rule) => [rule.id, ruleValue(rule.id, context)]))
      if (activeGoalRules.length > 0 && !activeGoalRules.some((rule) => values[rule.id] > 0)) continue
      const matchedRules = activeRules.filter((rule) => values[rule.id] > 0)
      pairs.push({
        mother,
        father,
        eggGroup,
        targetSpecies: target.id,
        target,
        goodNatureRank,
        canRecommendedNature: goodNatureRank === 2,
        ruleValues: values,
        matchedRules,
        priorityReason: matchedRules[0]?.label || '同蛋组配对',
      })
    }
  }

  pairs.sort((left, right) => {
    for (const rule of activeRules) {
      const difference = (right.ruleValues[rule.id] || 0) - (left.ruleValues[rule.id] || 0)
      if (difference) return difference
    }
    return left.mother.order - right.mother.order || left.father.order - right.father.order
  })

  const selected = []
  const used = new Set()
  for (const pair of pairs) {
    if (used.has(pair.father.id) || used.has(pair.mother.id)) continue
    selected.push(pair)
    used.add(pair.father.id)
    used.add(pair.mother.id)
    if (selected.length >= pairCount) break
  }
  return selected
}
