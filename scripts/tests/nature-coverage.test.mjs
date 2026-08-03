import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNatureCoverage, summarizeNatureCoverage } from '../../src/domain/natureCoverage.js'

const candidates = [
  { id: 'recommended-a', raise: 'patk', lower: 'matk', decision: 'recommended', score: 10 },
  { id: 'recommended-b', raise: 'patk', lower: 'spd', decision: 'recommended', score: 8 },
  { id: 'keepable-a', raise: 'hp', lower: 'matk', decision: 'keepable', score: 6 },
  { id: 'invalid-a', raise: 'patk', lower: 'hp', decision: 'notRecommended', score: 0 },
]

test('nature coverage distinguishes exact, silver-mirror repairable, and missing targets', () => {
  const coverage = buildNatureCoverage(candidates, {
    'recommended-a': [{ id: 'normal', nature: 'recommended-a', shiny: false, colorful: false }],
    'invalid-a': [{ id: 'rare', nature: 'invalid-a', shiny: true, colorful: false }],
  })

  assert.equal(coverage.status, 'incomplete')
  assert.equal(coverage.exact, 1)
  assert.equal(coverage.repairable, 1)
  assert.equal(coverage.missing, 1)
  assert.equal(coverage.entries.find((entry) => entry.candidate.id === 'recommended-b').status, 'repairable')
  assert.equal(coverage.entries.find((entry) => entry.candidate.id === 'keepable-a').status, 'missing')
})

test('one rare individual cannot cover more than one missing nature', () => {
  const coverage = buildNatureCoverage(candidates, {
    'invalid-a': [{ id: 'rare', nature: 'invalid-a', shiny: false, colorful: true }],
  })

  assert.equal(coverage.repairable, 1)
  assert.equal(coverage.missing, 2)
})

test('an exact rare individual is consumed unless a normal duplicate covers its current nature', () => {
  const rareOnly = buildNatureCoverage(candidates, {
    'recommended-a': [{ id: 'rare', nature: 'recommended-a', shiny: true, colorful: false }],
  })
  assert.equal(rareOnly.exact, 1)
  assert.equal(rareOnly.repairable, 0)

  const withNormalDuplicate = buildNatureCoverage(candidates, {
    'recommended-a': [
      { id: 'rare', nature: 'recommended-a', shiny: true, colorful: false },
      { id: 'normal', nature: 'recommended-a', shiny: false, colorful: false },
    ],
  })
  assert.equal(withNormalDuplicate.exact, 1)
  assert.equal(withNormalDuplicate.repairable, 1)
})

test('coverage summary counts completion states and remaining gaps', () => {
  const rows = [
    { coverage: { status: 'complete', missing: 0 } },
    { coverage: { status: 'repairable', missing: 0 } },
    { coverage: { status: 'incomplete', missing: 2 } },
  ]
  assert.deepEqual(summarizeNatureCoverage(rows), {
    total: 3,
    complete: 1,
    repairable: 1,
    incomplete: 1,
    missing: 2,
  })
})
