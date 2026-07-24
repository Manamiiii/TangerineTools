// 洛克王国孵蛋推荐纯函数。
// 数据来源口径：蛋组优先读取资料库 eggGroups 字段；繁育谱系优先读取 speciesGroup 字段，
// 未填写时按连续编号/基础名做保守推断，避免改 Dexie schema 或写死个体数据。

import { evaluateAllNatures } from './nature.js'
import { extractSkillInfoFromReferenceRows, extractSkillRefsFromRow, extractStatsFromRow, extractTraitTagsFromRow } from './natureRowAdapter.js'
import { BILI_EGG_GROUP_SOURCE_URL } from './breedingData.js'

export const EGG_GROUP_SOURCE_URL = BILI_EGG_GROUP_SOURCE_URL
export const BREEDING_PRIORITY_RULES = [
  '任一父母的性格命中对应精灵的推荐性格',
  '炫彩父母数量更多',
  '收集记录顺序更靠前',
]

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

function pairScore(pair) {
  const canRecommendedNature = [pair.father, pair.mother].some((item) =>
    item.catalog.recommendedNatures.includes(item.owned.values?.nature),
  )
  const colorfulParents = Number(pair.father.colorful) + Number(pair.mother.colorful)
  return (canRecommendedNature ? 0 : 1) * 1000 - colorfulParents * 30
}

export function recommendBreedingPairs(creatures, { pairCount = 5 } = {}) {
  const shinyCreatures = creatures.filter((item) => item.shiny)
  const males = shinyCreatures.filter((item) => item.gender === MALE && item.catalog.eggGroups.length)
  const females = shinyCreatures.filter((item) => item.gender === FEMALE && item.catalog.eggGroups.length)
  const pairs = []
  for (const mother of females) {
    for (const father of males) {
      const eggGroup = commonGroup(mother, father)
      if (!eggGroup) continue
      const pair = { mother, father, eggGroup }
      const canRecommendedNature = [father, mother].some((item) =>
        item.catalog.recommendedNatures.includes(item.owned.values?.nature),
      )
      const colorfulParents = Number(father.colorful) + Number(mother.colorful)
      pairs.push({
        ...pair,
        score: pairScore(pair),
        targetSpecies: mother.catalog.speciesKey,
        canRecommendedNature,
        priorityReason: canRecommendedNature
          ? '推荐性格优先'
          : colorfulParents > 0
            ? `${colorfulParents} 只炫彩父母`
            : '同蛋组异色配对',
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
    if (selected.length >= pairCount) break
  }
  return selected
}
