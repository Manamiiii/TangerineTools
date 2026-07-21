import assert from 'node:assert/strict'
import test from 'node:test'
import { visibleRockKingdomCreatureRows } from '../../src/domain/rockKingdom.js'
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
