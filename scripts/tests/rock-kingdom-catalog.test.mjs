import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateNatureProfiles } from '../../src/domain/nature.js'
import {
  compareRockKingdomCreatureRows,
  isRockKingdomNatureSelectableRow,
  relatedRockKingdomBossRows,
  visibleRockKingdomCreatureRows,
} from '../../src/domain/rockKingdom.js'
import { mergeFieldOptions } from '../../src/utils.js'

function row(id, no, name, form) {
  return { id, values: { no, name, form } }
}

test('hides a superseded official row only when its replacement exists', () => {
  const legacy = row('rock-creature-src-017', 'NO.012', '板板壳（本来的样子）', '本来的样子')
  const current = row('rock-creature-bwiki-bf820721eb70', 'NO.012', '板板壳', 'Ⅰ阶')

  assert.deepEqual(visibleRockKingdomCreatureRows([legacy]), [legacy])
  assert.deepEqual(visibleRockKingdomCreatureRows([legacy, current]), [current])
})

test('hides an old random-id duplicate without deleting distinct BWiki forms', () => {
  const current = row('rock-creature-src-001', 'NO.001', '迪莫', '最终形态')
  const randomLegacy = row('legacy-random-dimo', 'NO.001', '迪莫', '最终形态')
  const boss = row('rock-creature-bwiki-160c55fe2dfd', 'NO.001', '圣光迪莫', '首领形态')

  assert.deepEqual(visibleRockKingdomCreatureRows([randomLegacy, current, boss]), [current, boss])
})

test('updates only untouched legacy option icons', () => {
  const preset = [{ value: 'light', label: '光', color: '#facc15', image: 'https://bwiki.example/light.png' }]
  const defaults = {
    light: {
      labels: ['光', '光系'],
      color: '#facc15',
      images: ['', 'https://legacy.example/light.png'],
    },
  }

  assert.deepEqual(
    mergeFieldOptions(
      [{ value: 'light', label: '光', color: '#facc15', image: 'https://legacy.example/light.png' }],
      preset,
      defaults,
    ),
    preset,
  )
  const customized = [{ value: 'light', label: '光', color: '#facc15', image: 'https://user.example/light.png' }]
  assert.deepEqual(mergeFieldOptions(customized, preset, defaults), customized)
})

test('sorts creature forms by number, stage, final form, then boss form', () => {
  const rows = [
    row('boss', 'NO.007', '烈火战神', '首领形态'),
    row('final', 'NO.007', '火神', '最终形态'),
    row('stage-2', 'NO.007', '焰火', 'II阶'),
    row('variant', 'NO.007', '火神（异色）', '异色的样子'),
    row('stage-1', 'NO.007', '火花', 'Ⅰ阶'),
    row('next', 'NO.008', '水蓝蓝', 'Ⅰ阶'),
  ]

  assert.deepEqual(rows.sort(compareRockKingdomCreatureRows).map((item) => item.id), [
    'stage-1', 'stage-2', 'variant', 'final', 'boss', 'next',
  ])
})

test('nature selector hides growth stages and bosses but keeps final variants', () => {
  assert.equal(isRockKingdomNatureSelectableRow(row('stage', 'NO.007', '火花', 'I阶')), false)
  assert.equal(isRockKingdomNatureSelectableRow(row('boss', 'NO.007', '烈火战神', '首领形态')), false)
  assert.equal(isRockKingdomNatureSelectableRow(row('final', 'NO.007', '火神', '最终形态')), true)
  assert.equal(isRockKingdomNatureSelectableRow(row('variant', 'NO.011', '鸭吉吉（蓬松）', '蓬松的样子')), true)
})

test('matches a final variant with its corresponding boss variant', () => {
  const target = row('spring', 'NO.020', '岚鸟（春天的样子）', '春天的样子')
  const springBoss = row('spring-boss', 'NO.020', '霜翼领主（春天的样子）', '首领形态')
  const summerBoss = row('summer-boss', 'NO.020', '霜翼领主（夏天的样子）', '首领形态')
  assert.deepEqual(relatedRockKingdomBossRows(target, [target, summerBoss, springBoss]), [springBoss])
})

test('combined nature evaluation records boss-form participation', () => {
  const stats = { hp: 100, patk: 120, matk: 50, pdef: 80, mdef: 80, spd: 100 }
  const bossStats = { hp: 110, patk: 150, matk: 70, pdef: 90, mdef: 85, spd: 120 }
  const results = evaluateNatureProfiles(stats, ['patkLean'], { skills: [] }, [
    { stats: bossStats, traitTags: ['patkLean', 'spdLean'], skillInfo: { skills: [] } },
  ])
  assert.equal(results.length, 30)
  assert.ok(results.every((item) => item.analysisFormCount === 2))
  assert.ok(results[0].reasons.some((reason) => reason.includes('关联首领形态')))
})

test('official preset classifies 烈火战神 as a boss form', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const boss = rows.find((item) => item.values?.name === '烈火战神')
  assert.equal(boss?.values?.form, '首领形态')
})
