import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveNrcShiny } from '../bwiki/build-preview.mjs'

const version = 'S4-2026-09-11-browser-full'
const fire = { sourceId: 'pet_000515', name: '火红尾', shinyLabel: '否', shinyImage: '' }
const old = { id: 'rock-creature-src-345', values: { shiny: 'yes', shinyImage: 'https://patchwiki.biligame.com/images/rocom/example.png' } }

test('Confirmed shiny exception preserves the old source and does not change raw evidence', () => {
  const before = structuredClone(fire)
  const result = resolveNrcShiny(fire, old, version)
  assert.equal(result.value, 'yes')
  assert.equal(result.image, old.values.shinyImage)
  assert.equal(result.source, 'existing-public-preset')
  assert.match(result.decision, /2026-09-21/)
  assert.deepEqual(fire, before)
  assert.throws(() => resolveNrcShiny(fire, { ...old, id: 'different' }, version), /重新审阅/)
})

test('Shiny confirmation is limited to one identity and batch; no-shiny never inherits a stale image', () => {
  for (const [creature, batch] of [[{ ...fire, name: '雅丹鬃', sourceId: 'pet_000516' }, version], [fire, 'future-batch']]) {
    const result = resolveNrcShiny(creature, old, batch)
    assert.equal(result.value, 'no')
    assert.equal(result.image, '')
    assert.equal(result.decision, '')
  }
  assert.equal(resolveNrcShiny({ ...fire, name: '其他', shinyLabel: '是' }, old, version).image, '')
})
