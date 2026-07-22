import assert from 'node:assert/strict'
import test from 'node:test'
import { pveOverviewSummary, pveSpeciesProfile, pveStarText } from '../../src/domain/naturePve.js'

const baseStats = { hp: 100, patk: 140, matk: 70, pdef: 90, mdef: 85, spd: 120 }

function candidate(overrides = {}) {
  return {
    raise: 'patk',
    lower: 'matk',
    adjustedStats: baseStats,
    deltas: { hp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0, spd: 0 },
    decision: 'recommended',
    hardRisk: false,
    score: 80,
    reasons: [],
    warnings: [],
    roleTags: ['physicalAttacker', 'fastAttacker'],
    skillProfile: {
      attackMode: 'physical',
      texts: [],
      breakdown: {
        attackCount: 10,
        attackShare: 0.7,
        attackAveragePower: 90,
        physicalCount: 10,
        physicalShare: 0.8,
        physicalRouteScore: 16,
      },
    },
    ...overrides,
  }
}

test('PVE star text clamps invalid input to the five-star scale', () => {
  assert.equal(pveStarText(3), '★★★☆☆')
  assert.equal(pveStarText(9), '★★★★★')
  assert.equal(pveStarText(-2), '☆☆☆☆☆')
})

test('PVE profile recognizes a fast focused carry without UI dependencies', () => {
  const profile = pveSpeciesProfile([candidate()])
  assert.equal(profile.tier, 'priority')
  assert.equal(profile.mechanism, 'carry')
  assert.deepEqual(profile.preferredStats.slice(0, 2), ['spd', 'patk'])

  const summary = pveOverviewSummary([candidate()])
  assert.equal(summary.badge, '优先培养')
  assert.equal(summary.primaryStat, '物攻')
  assert.equal(summary.stars, 5)
})

test('PVE profile keeps mechanism-only and no-evidence cases distinct', () => {
  const mechanismCandidate = candidate({
    adjustedStats: { hp: 110, patk: 80, matk: 80, pdef: 100, mdef: 100, spd: 70 },
    roleTags: ['support'],
    skillProfile: {
      attackMode: 'mixed',
      texts: ['造成目标最大生命百分比伤害'],
      breakdown: {},
    },
  })
  assert.equal(pveSpeciesProfile([mechanismCandidate]).tier, 'suitable')

  const unknownCandidate = candidate({
    adjustedStats: { hp: 80, patk: 70, matk: 70, pdef: 70, mdef: 70, spd: 70 },
    roleTags: [],
    skillProfile: { attackMode: 'mixed', texts: [], breakdown: {} },
  })
  assert.equal(pveSpeciesProfile([unknownCandidate]).tier, 'skip')
})
