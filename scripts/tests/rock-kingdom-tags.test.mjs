import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveSkillEffectTags } from '../../src/domain/rockKingdomTags.js'

test('shared skill tag rules preserve explicit tags and derive runtime text tags', () => {
  const tags = deriveSkillEffectTags({
    effectTags: ['custom'],
    description: '先手攻击，命中后回复2能量并提升速度',
  })
  assert.deepEqual(new Set(tags), new Set(['custom', 'priority', 'speed', 'healing', 'energyGain', 'statBoost']))
})
