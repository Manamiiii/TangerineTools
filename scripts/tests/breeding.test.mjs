import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BREEDING_PRIORITY_RULES,
  recommendBreedingPairs,
  summarizeMissingEggGroups,
} from '../../src/domain/breeding.js'

function creature(id, gender, {
  recommended = false,
  colorful = false,
  shiny = true,
  speciesKey = id,
} = {}) {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) || 0,
    gender,
    shiny,
    colorful,
    owned: { values: { nature: 'focused' } },
    catalog: {
      eggGroups: ['测试组'],
      speciesKey,
      recommendedNatures: recommended ? ['focused'] : [],
    },
  }
}

test('breeding recommends exactly five disjoint pairs and prioritizes recommended natures', () => {
  const creatures = [
    ...Array.from({ length: 6 }, (_, index) => creature(`m${index + 1}`, 'male', {
      recommended: index === 5,
    })),
    ...Array.from({ length: 6 }, (_, index) => creature(`f${index + 1}`, 'female')),
  ]

  const pairs = recommendBreedingPairs(creatures)
  assert.equal(pairs.length, 5)
  assert.equal(new Set(pairs.flatMap((pair) => [pair.father.id, pair.mother.id])).size, 10)
  assert.equal(pairs[0].canRecommendedNature, true)
  assert.equal(pairs[0].priorityReason, '仅有异色母优先')
})

test('breeding exposes the same priority order shown in the UI', () => {
  assert.deepEqual(BREEDING_PRIORITY_RULES, [
    '母方对应种类尚未拥有异色',
    '母方对应种类只有异色母、尚缺异色公',
    '任一父母的性格命中对应精灵的推荐性格',
    '异色父母数量更多',
    '炫彩父母数量更多',
    '收集记录顺序更靠前',
  ])
})

test('breeding fills missing shiny species before female-only shiny species', () => {
  const creatures = [
    creature('missing-mother', 'female', { shiny: false, speciesKey: 'missing-target' }),
    creature('female-only-mother', 'female', { speciesKey: 'female-only-target' }),
    creature('complete-mother', 'female', { speciesKey: 'complete-target', recommended: true }),
    creature('complete-male', 'male', { speciesKey: 'complete-target' }),
    creature('donor-male-1', 'male', { speciesKey: 'donor-1' }),
    creature('donor-male-2', 'male', { speciesKey: 'donor-2' }),
    creature('ordinary-male', 'male', { shiny: false, speciesKey: 'ordinary-donor' }),
  ]

  const pairs = recommendBreedingPairs(creatures, { pairCount: 3 })

  assert.equal(pairs[0].mother.id, 'missing-mother')
  assert.equal(pairs[0].priorityReason, '尚无异色优先')
  assert.equal(pairs[0].mother.shiny, false)
  assert.equal(pairs[0].father.shiny, true)
  assert.equal(pairs[1].mother.id, 'female-only-mother')
  assert.equal(pairs[1].priorityReason, '仅有异色母优先')
  assert.ok(pairs.every((pair) => pair.father.id !== 'ordinary-male'))
})

test('breeding missing egg group summary lists distinct creatures and owned record counts', () => {
  const complete = creature('complete', 'male')
  const missingFirst = creature('missing-1', 'female')
  const missingSecond = creature('missing-2', 'male')
  const missingOther = creature('other', 'female')
  missingFirst.catalog = {
    ...missingFirst.catalog,
    row: { id: 'catalog-missing' },
    eggGroups: [],
  }
  missingSecond.catalog = {
    ...missingSecond.catalog,
    row: { id: 'catalog-missing' },
    eggGroups: [],
  }
  missingOther.catalog = {
    ...missingOther.catalog,
    row: { id: 'catalog-other' },
    eggGroups: [],
  }
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
