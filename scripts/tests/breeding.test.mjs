import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BREEDING_PRIORITY_RULES,
  recommendBreedingPairs,
} from '../../src/domain/breeding.js'

function creature(id, gender, { recommended = false, colorful = false } = {}) {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) || 0,
    gender,
    shiny: true,
    colorful,
    owned: { values: { nature: 'focused' } },
    catalog: {
      eggGroups: ['测试组'],
      speciesKey: id,
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
  assert.equal(pairs[0].priorityReason, '推荐性格优先')
})

test('breeding exposes the same priority order shown in the UI', () => {
  assert.deepEqual(BREEDING_PRIORITY_RULES, [
    '任一父母的性格命中对应精灵的推荐性格',
    '炫彩父母数量更多',
    '收集记录顺序更靠前',
  ])
})
