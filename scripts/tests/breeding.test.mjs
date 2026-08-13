import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BREEDING_PRIORITY_RULES,
  buildBreedingDataset,
  DEFAULT_BREEDING_RULES,
  normalizeBreedingRules,
  recommendBreedingPairs,
  summarizeMissingEggGroups,
} from '../../src/domain/breeding.js'

function creature(id, gender, {
  colorful = false,
  nature = 'focused',
  shiny = false,
  speciesKey = id,
} = {}) {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) || 0,
    gender,
    shiny,
    colorful,
    nature,
    owned: { values: { nature } },
    catalog: {
      row: { id: `catalog-${id}` },
      eggGroups: ['测试组'],
      speciesKey,
      natureRanks: new Map(),
    },
  }
}

function target(id, {
  colorful = { total: 0, male: 0, female: 0 },
  goodNature = { total: 0, recommended: 0, keepable: 0 },
  natureRanks = new Map([['focused', 2]]),
  shiny = { total: 0, male: 0, female: 0 },
} = {}) {
  return {
    id,
    name: id,
    natureRanks,
    shiny,
    colorful,
    goodNature,
    missing: {
      shiny: shiny.total === 0,
      colorful: colorful.total === 0,
      shinyMale: shiny.total > 0 && shiny.male === 0,
      shinyFemale: shiny.total > 0 && shiny.female === 0,
      colorfulMale: colorful.total > 0 && colorful.male === 0,
      colorfulFemale: colorful.total > 0 && colorful.female === 0,
      goodNature: goodNature.total === 0,
    },
  }
}

test('breeding recommends five disjoint pairs from configurable goal rules', () => {
  const males = Array.from({ length: 6 }, (_, index) => creature(`m${index + 1}`, 'male', {
    speciesKey: `donor-${index + 1}`,
  }))
  const females = Array.from({ length: 6 }, (_, index) => creature(`f${index + 1}`, 'female', {
    speciesKey: `target-${index + 1}`,
  }))
  const species = females.map((item) => target(item.catalog.speciesKey))
  const pairs = recommendBreedingPairs([...males, ...females], { species })

  assert.equal(pairs.length, 5)
  assert.equal(new Set(pairs.flatMap((pair) => [pair.father.id, pair.mother.id])).size, 10)
  assert.ok(pairs.every((pair) => pair.goodNatureRank === 2))
})

test('breeding exposes the same default priority order shown in the UI', () => {
  assert.deepEqual(BREEDING_PRIORITY_RULES, [
    '缺异色',
    '缺炫彩',
    '缺异色公',
    '缺异色母',
    '缺好性格',
    '好性格遗传',
    '异色父母更多',
    '炫彩父母更多',
    '收集记录靠前',
  ])
})

test('enabled rule order changes which collection gap is selected first', () => {
  const shinyMother = creature('f1', 'female', { speciesKey: 'missing-shiny' })
  const colorfulMother = creature('f2', 'female', { speciesKey: 'missing-colorful' })
  const shinyFather = creature('m1', 'male', { shiny: true })
  const colorfulFather = creature('m2', 'male', { colorful: true })
  const species = [
    target('missing-shiny', { colorful: { total: 1, male: 1, female: 0 }, goodNature: { total: 1, recommended: 1, keepable: 0 } }),
    target('missing-colorful', { shiny: { total: 1, male: 1, female: 0 }, goodNature: { total: 1, recommended: 1, keepable: 0 } }),
  ]
  const onlyTwoGoals = normalizeBreedingRules([
    { id: 'missingColorful', enabled: true },
    { id: 'missingShiny', enabled: true },
    ...DEFAULT_BREEDING_RULES.filter((rule) => !['missingColorful', 'missingShiny'].includes(rule.id))
      .map((rule) => ({ id: rule.id, enabled: false })),
  ])

  const pairs = recommendBreedingPairs(
    [shinyMother, colorfulMother, shinyFather, colorfulFather],
    { pairCount: 2, rules: onlyTwoGoals, species },
  )

  assert.equal(pairs[0].mother.id, 'f2')
  assert.equal(pairs[0].father.id, 'm2')
  assert.equal(pairs[0].priorityReason, '缺炫彩')
  assert.equal(pairs[1].mother.id, 'f1')
  assert.equal(pairs[1].father.id, 'm1')
})

test('good nature is evaluated for the child target and includes keepable natures', () => {
  const mother = creature('f1', 'female', { nature: 'bad', speciesKey: 'child' })
  const recommendedFather = creature('m1', 'male', { nature: 'child-best' })
  const keepableFather = creature('m2', 'male', { nature: 'child-keep' })
  const species = [target('child', {
    shiny: { total: 1, male: 1, female: 1 },
    colorful: { total: 1, male: 1, female: 1 },
    natureRanks: new Map([['child-best', 2], ['child-keep', 1]]),
  })]
  const rules = normalizeBreedingRules(DEFAULT_BREEDING_RULES.map((rule) => ({
    id: rule.id,
    enabled: ['missingGoodNature', 'goodNatureCarrier'].includes(rule.id),
  })))

  const pairs = recommendBreedingPairs(
    [mother, keepableFather, recommendedFather],
    { pairCount: 1, rules, species },
  )

  assert.equal(pairs[0].father.id, 'm1')
  assert.equal(pairs[0].goodNatureRank, 2)
})

test('breeding dataset summarizes rare appearances and sexes by species group', () => {
  const catalogRows = [
    { id: 'catalog-a1', values: { name: '幼体', speciesGroup: '测试谱系', eggGroups: ['动物组'], image: 'a.png' } },
    { id: 'catalog-a2', values: { name: '成体', speciesGroup: '测试谱系', eggGroups: ['动物组'] } },
    { id: 'catalog-no-egg', values: { name: '不可孵化', speciesGroup: '不可孵化', eggGroups: ['无法孵蛋'] } },
  ]
  const ownedRows = [
    { id: 'owned-1', values: { ref: 'catalog-a1', gender: 'male', shiny: 'yes', colorful: 'no' } },
    { id: 'owned-2', values: { ref: 'catalog-a2', gender: 'female', shiny: 'yes', colorful: 'yes' } },
  ]
  const dataset = buildBreedingDataset({ ownedRows, catalogRows, catalogFields: [], skillRows: [] })

  assert.equal(dataset.species.length, 1)
  assert.equal(dataset.species[0].name, '测试谱系')
  assert.equal(dataset.species[0].ownedCount, 2)
  assert.deepEqual(dataset.species[0].shiny, { total: 2, male: 1, female: 1 })
  assert.deepEqual(dataset.species[0].colorful, { total: 1, male: 0, female: 1 })
  assert.equal(dataset.species[0].missing.colorfulMale, true)
})

test('breeding missing egg group summary lists distinct creatures and owned record counts', () => {
  const complete = creature('complete', 'male')
  const missingFirst = creature('missing-1', 'female')
  const missingSecond = creature('missing-2', 'male')
  const missingOther = creature('other', 'female')
  missingFirst.catalog = { ...missingFirst.catalog, row: { id: 'catalog-missing' }, eggGroups: [] }
  missingSecond.catalog = { ...missingSecond.catalog, row: { id: 'catalog-missing' }, eggGroups: [] }
  missingOther.catalog = { ...missingOther.catalog, row: { id: 'catalog-other' }, eggGroups: [] }
  missingFirst.name = '缺失精灵'
  missingSecond.name = '缺失精灵'
  missingOther.name = '另一只'

  const summary = summarizeMissingEggGroups([complete, missingFirst, missingSecond, missingOther])

  assert.equal(summary.recordCount, 3)
  assert.equal(summary.creatureCount, 2)
  assert.deepEqual(summary.creatures, [
    { catalogRowId: 'catalog-missing', name: '缺失精灵', recordCount: 2 },
    { catalogRowId: 'catalog-other', name: '另一只', recordCount: 1 },
  ])
})
