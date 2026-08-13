import assert from 'node:assert/strict'
import test from 'node:test'
import { sceneToolsFor } from '../../src/constants.js'

test('custom games receive generic management tools only', () => {
  assert.deepEqual(sceneToolsFor({ id: 'scene-custom-game' }).map((tool) => tool.value), [
    'catalog',
    'owned',
    'stock',
  ])
})

test('Rock Kingdom receives its dedicated recommendation tools', () => {
  assert.deepEqual(sceneToolsFor({ id: 'scene-rock-kingdom' }).map((tool) => tool.value), [
    'catalog',
    'nature',
    'owned',
    'breeding',
    'stock',
  ])
})
