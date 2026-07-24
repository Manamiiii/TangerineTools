// 洛克王国孵蛋推荐的个人调试预置。
// 只从当前正式精灵资料中挑选“存在异色形态且可孵蛋”的精灵，不复制资料字段。

const FIXTURE_COUNT = 52
const UNBREEDABLE_GROUP = '无法孵蛋'

const NATURE_VALUES = [
  'clever',
  'focused',
  'adamant',
  'bold',
  'vigilant',
  'steady',
  'silent',
  'melancholy',
  'timid',
  'cheerful',
]

function text(value) {
  return String(value || '').trim()
}

function breedableGroups(row) {
  const groups = Array.isArray(row.values?.eggGroups) ? row.values.eggGroups : []
  return groups.map(text).filter((group) => group && group !== UNBREEDABLE_GROUP)
}

function lineKey(row) {
  return text(row.values?.breedingLine || row.values?.evolutionLine || row.values?.speciesGroup || row.id)
}

function formRank(form) {
  if (form === '最终形态' || form === '普通形态') return 0
  if (form === 'Ⅱ阶') return 1
  if (form === 'Ⅰ阶') return 2
  if (form === '首领形态') return 3
  return 4
}

function compareRows(a, b) {
  return (
    text(a.values?.no).localeCompare(text(b.values?.no), 'zh-CN', { numeric: true }) ||
    text(a.values?.name).localeCompare(text(b.values?.name), 'zh-CN') ||
    a.id.localeCompare(b.id)
  )
}

function representativesByEvolutionLine(catalogRows) {
  const candidates = catalogRows
    .filter((row) => row.values?.shiny === 'yes' && breedableGroups(row).length > 0)
    .sort(compareRows)
  const byLine = new Map()
  for (const row of candidates) {
    const key = lineKey(row)
    const existing = byLine.get(key)
    if (!existing || formRank(row.values?.form) < formRank(existing.values?.form)) {
      byLine.set(key, row)
    }
  }
  return [...byLine.values()].sort(compareRows)
}

function selectCompatiblePairs(rows, pairCount) {
  const groups = [...new Set(rows.flatMap(breedableGroups))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const used = new Set()
  const pairs = []

  while (pairs.length < pairCount) {
    let added = false
    for (const group of groups) {
      const available = rows.filter((row) => !used.has(row.id) && breedableGroups(row).includes(group))
      if (available.length < 2) continue
      const pair = available.slice(0, 2)
      pair.forEach((row) => used.add(row.id))
      pairs.push(pair)
      added = true
      if (pairs.length >= pairCount) break
    }
    if (!added) break
  }
  return pairs
}

export function buildRockKingdomBreedingFixtures(catalogRows, tableId, now) {
  const representatives = representativesByEvolutionLine(catalogRows)
  const pairs = selectCompatiblePairs(representatives, FIXTURE_COUNT / 2)
  if (pairs.length !== FIXTURE_COUNT / 2) return []

  return pairs.flatMap((pair, pairIndex) =>
    pair.map((row, parentIndex) => ({
      id: `owned-rock-breeding-fixture-${row.id}`,
      tableId,
      values: {
        ref: row.id,
        nature: NATURE_VALUES[(pairIndex * 2 + parentIndex) % NATURE_VALUES.length],
        shiny: 'yes',
        colorful: (pairIndex * 2 + parentIndex) % 8 === 0 ? 'yes' : 'no',
        gender: parentIndex === 0 ? 'male' : 'female',
        note: '孵蛋推荐调试预置（可删除）',
      },
      createdAt: now,
      updatedAt: now,
    })),
  )
}

export const ROCK_KINGDOM_BREEDING_FIXTURE_COUNT = FIXTURE_COUNT
