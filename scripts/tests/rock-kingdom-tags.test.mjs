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

test('skill tag rules cover attacks and previously unlabelled status mechanics', () => {
  assert.deepEqual(deriveSkillEffectTags({
    category: 'physical',
    power: 80,
    effect: '造成物伤。',
  }), ['directDamage'])
  assert.deepEqual(new Set(deriveSkillEffectTags({
    category: 'status',
    effect: '选择：驱散敌方所有增益，或自己获得1层光合印记。',
  })), new Set(['dispel', 'mark', 'choice']))
  assert.deepEqual(deriveSkillEffectTags({
    category: 'status',
    effect: '每回合变成其他技能。',
  }), ['specialMechanic'])
})
