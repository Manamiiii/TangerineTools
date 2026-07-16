// 洛克王国孵蛋推荐纯函数。
// 数据来源口径：蛋组优先读取资料库 eggGroups 字段；同种精灵优先读取 speciesGroup 字段，
// 未填写时按连续编号/基础名做保守推断，避免改 Dexie schema 或写死个体数据。

import { evaluateAllNatures, extractSkillInfoFromReferenceRows, extractSkillRefsFromRow, extractStatsFromRow, extractTraitTagsFromRow } from './nature.js'
import { BILI_EGG_GROUP_SOURCE_URL } from './breedingData.js'

export const EGG_GROUP_SOURCE_URL = BILI_EGG_GROUP_SOURCE_URL

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
  const explicit = normText(row.values?.speciesGroup || row.values?.sameSpecies || row.values?.进化链)
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
  return splitGroups(row.values?.eggGroups || row.values?.eggGroup || row.values?.蛋组).filter((group) => group !== UNBREEDABLE_GROUP)
}

function commonGroup(a, b) {
  const set = new Set(a.catalog.eggGroups)
  return b.catalog.eggGroups.find((g) => set.has(g)) || ''
}

export function buildOwnedCreatures({ ownedRows = [], catalogRows = [], catalogFields = [], skillRows = [] }) {
  const catalogById = new Map(catalogRows.map((row) => [row.id, row]))
  return ownedRows.map((owned, index) => {
    const catalog = catalogById.get(owned.values?.ref) || null
    if (!catalog) return null
    const skillRefs = extractSkillRefsFromRow(catalog, catalogFields)
    const referencedSkillRows = skillRows.filter((row) => skillRefs.includes(row.id))
    const skillInfo = extractSkillInfoFromReferenceRows(referencedSkillRows)
    const recommendedNatures = evaluateAllNatures(
      extractStatsFromRow(catalog, catalogFields),
      extractTraitTagsFromRow(catalog, catalogFields),
      skillInfo,
    ).filter((item) => item.decision === 'recommended').flatMap((item) => [item.id, item.name])
    return {
      id: owned.id,
      order: index,
      name: displayName(catalog),
      owned,
      gender: owned.values?.gender,
      nature: owned.values?.nature,
      shiny: yes(owned.values?.shiny),
      colorful: yes(owned.values?.colorful),
      catalog: {
        row: catalog,
        speciesKey: speciesKey(catalog),
        eggGroups: getEggGroups(catalog),
        recommendedNatures,
      },
    }
  }).filter(Boolean)
}

function pairScore(pair, allBySpecies) {
  const motherSpecies = pair.mother.catalog.speciesKey
  const speciesOwned = allBySpecies.get(motherSpecies) || []
  const hasOwnedShiny = speciesOwned.some((item) => item.shiny)
  const canRecommendedNature = [pair.father, pair.mother].some((item) =>
    item.catalog.recommendedNatures.includes(item.owned.values?.nature),
  )
  const shinyParents = Number(pair.father.shiny) + Number(pair.mother.shiny)
  const colorfulParents = Number(pair.father.colorful) + Number(pair.mother.colorful)
  let tier = 80
  if (!hasOwnedShiny) tier = 10
  else if (canRecommendedNature) tier = 20
  else if (pair.mother.shiny && pair.father.shiny) tier = 30
  else if (!pair.mother.shiny && pair.father.shiny && pair.father.colorful) tier = 40
  return tier * 1000 - shinyParents * 80 - colorfulParents * 30 - (canRecommendedNature ? 20 : 0)
}

export function recommendBreedingBatches(creatures, { batchCount = 5, pairsPerBatch = 5 } = {}) {
  const shinyCreatures = creatures.filter((item) => item.shiny)
  const males = shinyCreatures.filter((item) => item.gender === MALE && item.catalog.eggGroups.length)
  const females = shinyCreatures.filter((item) => item.gender === FEMALE && item.catalog.eggGroups.length)
  const allBySpecies = new Map()
  for (const item of shinyCreatures) {
    const key = item.catalog.speciesKey
    allBySpecies.set(key, [...(allBySpecies.get(key) || []), item])
  }
  const pairs = []
  for (const mother of females) {
    for (const father of males) {
      const eggGroup = commonGroup(mother, father)
      if (!eggGroup) continue
      const pair = { mother, father, eggGroup }
      pairs.push({
        ...pair,
        score: pairScore(pair, allBySpecies),
        targetSpecies: mother.catalog.speciesKey,
        canRecommendedNature: [father, mother].some((item) => item.catalog.recommendedNatures.includes(item.owned.values?.nature)),
      })
    }
  }
  pairs.sort((a, b) => a.score - b.score || a.mother.order - b.mother.order || a.father.order - b.father.order)
  const selected = []
  const used = new Set()
  for (const pair of pairs) {
    if (used.has(pair.father.id) || used.has(pair.mother.id)) continue
    selected.push(pair)
    used.add(pair.father.id)
    used.add(pair.mother.id)
    if (selected.length >= batchCount * pairsPerBatch) break
  }
  return Array.from({ length: batchCount }, (_, index) => ({
    id: `batch-${index + 1}`,
    pairs: selected.slice(index * pairsPerBatch, (index + 1) * pairsPerBatch),
  })).filter((batch) => batch.pairs.length > 0)
}
