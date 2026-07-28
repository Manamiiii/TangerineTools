import assert from 'node:assert/strict'
import test from 'node:test'

import { recommendPartnerMarks } from '../../src/domain/rockKingdomPartnerMarks.js'

function item(id, overrides = {}) {
  return {
    id,
    creatureId: 'creature-a',
    groupKey: 'number:NO.001',
    natureId: `nature-${id}`,
    natureDecision: 'recommended',
    pveEligible: false,
    starterException: false,
    rare: false,
    specialty: '',
    actualMark: 'none',
    createdAt: `2026-07-${String(id.length).padStart(2, '0')}`,
    ...overrides,
  }
}

test('protected game marks are preserved and suppress an ordinary duplicate nature', () => {
  const result = recommendPartnerMarks([
    item('protected', { natureId: 'adamant', actualMark: 'hp' }),
    item('duplicate', { natureId: 'adamant' }),
  ])

  assert.equal(result.get('protected').recommendedMark, 'hp')
  assert.equal(result.get('protected').protected, true)
  assert.equal(result.get('protected').needsAdjustment, false)
  assert.equal(result.get('duplicate').recommendedMark, 'none')
})

test('rare appearance uses lightning, fruit, then home by rule priority', () => {
  const result = recommendPartnerMarks([
    item('pve', { rare: true, pveEligible: true }),
    item('usable', { rare: true }),
    item('collection', { rare: true, natureDecision: 'notRecommended' }),
  ])

  assert.equal(result.get('pve').recommendedMark, 'lightning')
  assert.equal(result.get('usable').recommendedMark, 'fruit')
  assert.equal(result.get('collection').recommendedMark, 'home')
})

test('ordinary duplicate nature keeps one and prioritizes an important specialty', () => {
  const result = recommendPartnerMarks([
    item('plain', { natureId: 'adamant', actualMark: 'fruit' }),
    item('sharing', { natureId: 'adamant', specialty: 'sharing' }),
  ])

  assert.equal(result.get('sharing').recommendedMark, 'fruit')
  assert.equal(result.get('plain').recommendedMark, 'none')
})

test('ordinary usable nature remains fruit even with ride or sharing specialty', () => {
  const result = recommendPartnerMarks([
    item('sharing', { specialty: 'sharing' }),
  ])

  assert.equal(result.get('sharing').recommendedMark, 'fruit')
})

test('wrong-nature ride and sharing each add one home only when not already covered', () => {
  const result = recommendPartnerMarks([
    item('covered-sharing', {
      natureId: 'protected-nature',
      natureDecision: 'notRecommended',
      specialty: 'sharing',
      actualMark: 'mdef',
    }),
    item('duplicate-sharing', {
      natureId: 'bad-sharing',
      natureDecision: 'notRecommended',
      specialty: 'sharing',
    }),
    item('ride', {
      natureId: 'bad-ride',
      natureDecision: 'notRecommended',
      specialty: 'rideTogether',
    }),
  ])

  assert.equal(result.get('covered-sharing').recommendedMark, 'mdef')
  assert.equal(result.get('duplicate-sharing').recommendedMark, 'none')
  assert.equal(result.get('ride').recommendedMark, 'home')
})

test('ordinary first or second generation starter can use lightning for a PVE nature', () => {
  const result = recommendPartnerMarks([
    item('starter', { pveEligible: true, starterException: true }),
    item('ordinary', { groupKey: 'number:NO.002', pveEligible: true }),
  ])

  assert.equal(result.get('starter').recommendedMark, 'lightning')
  assert.equal(result.get('ordinary').recommendedMark, 'fruit')
})
