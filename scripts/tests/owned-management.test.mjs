import test from 'node:test'
import assert from 'node:assert/strict'

import { matchesOwnedFieldFilters, ownedFieldValue } from '../../src/domain/owned.js'

test('owned record filters combine exact select, reference, boolean, and multiselect conditions', () => {
  const fields = [
    { key: 'ref', type: 'reference' },
    { key: 'nature', type: 'select' },
    { key: 'favorite', type: 'boolean' },
    { key: 'tags', type: 'multiselect' },
  ]
  const row = {
    values: {
      ref: 'creature-1',
      nature: 'timid',
      favorite: true,
      tags: ['rare', 'trained'],
    },
  }
  assert.equal(matchesOwnedFieldFilters(row, fields, {}), true)
  assert.equal(matchesOwnedFieldFilters(row, fields, { ref: 'creature-1', nature: 'timid' }), true)
  assert.equal(matchesOwnedFieldFilters(row, fields, { favorite: 'true', tags: 'rare' }), true)
  assert.equal(matchesOwnedFieldFilters(row, fields, { nature: 'adamant' }), false)
  assert.equal(matchesOwnedFieldFilters(row, fields, { tags: 'missing' }), false)
})

test('appearance filtering derives a compatible value for records saved before appearance detail existed', () => {
  const appearanceField = { key: 'appearance', type: 'select' }
  const oldShinyColorful = { values: { shiny: 'yes', colorful: 'yes' } }
  const oldOrdinary = { values: { shiny: 'no', colorful: 'no' } }
  assert.equal(ownedFieldValue(oldShinyColorful, appearanceField), 'shiny-colorful')
  assert.equal(ownedFieldValue(oldOrdinary, appearanceField), 'none')
  assert.equal(matchesOwnedFieldFilters(oldShinyColorful, [appearanceField], { appearance: 'shiny-colorful' }), true)
})
