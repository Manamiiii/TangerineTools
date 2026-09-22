import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { offlineAssets } from '../vite/offline-assets.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { rowMatchesFilters, mergeFieldOptions } from '../../src/utils.js'
import { buildStockSummary } from '../../src/domain/stock.js'
import { speciesKey, buildBreedingDataset, summarizeMissingEggGroups } from '../../src/domain/breeding.js'
import { requestModelJson } from '../../src/features/model/modelClient.js'

test('empty numbers are distinct from zero and legacy option values merge once', () => {
  const fields = [{ key: 'n', type: 'number' }]
  for (const n of ['', null, undefined]) assert.equal(rowMatchesFilters({ values: { n } }, fields, { n: { max: 0 } }), false)
  assert.equal(rowMatchesFilters({ values: { n: 0 } }, fields, { n: { max: 0 } }), true)
  assert.equal(mergeFieldOptions(['a'], [{ value: 'a', label: 'A' }]).length, 1)
})

test('reference names do not merge distinct identities and multi references expand', () => {
  const summary = buildStockSummary([{ values: { ref: ['a', 'b'] } }], { key: 'ref', type: 'references' }, null, '', new Map([['a', 'Same'], ['b', 'Same']]))
  assert.deepEqual(summary.groups, [{ key: 'a', label: 'Same', count: 1 }, { key: 'b', label: 'Same', count: 1 }])
})

test('breeding does not guess families and respects appearance and unbreedable declarations', () => {
  assert.notEqual(speciesKey({ id: 'a', values: { no: '004' } }), speciesKey({ id: 'b', values: { no: '005' } }))
  const dataset = buildBreedingDataset({
    catalogRows: [{ id: 'a', values: { name: 'A', eggGroups: ['动物组'] } }, { id: 'b', values: { name: 'B', eggGroups: ['无法孵蛋'] } }, { id: 'c', values: { name: 'C' } }],
    ownedRows: [{ id: 'oa', values: { ref: 'a', appearance: 'shiny', shiny: 'no' } }, { id: 'ob', values: { ref: 'b' } }, { id: 'oc', values: { ref: 'c' } }],
  })
  assert.equal(dataset.creatures[0].shiny, true)
  assert.equal(summarizeMissingEggGroups(dataset.creatures).recordCount, 1)
})

test('model timeout remains armed while response body is pending', async () => {
  const originalSet = globalThis.setTimeout
  const originalClear = globalThis.clearTimeout
  let cleared = false
  let expire
  globalThis.setTimeout = (fn) => { expire = fn; return 1 }
  globalThis.clearTimeout = () => { cleared = true }
  try {
    await assert.rejects(requestModelJson({ endpoint: 'https://example.test/v1', model: 'test', apiKey: 'test', messages: [], fetchImpl: async (_url, { signal }) => ({
      ok: true,
      json: async () => {
        assert.equal(cleared, false)
        expire()
        signal.throwIfAborted()
      },
    }) }), /超时/)
    assert.equal(cleared, true)
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear }
})

test('release rejects unspecified sources and any candidate omitting stable ids', () => {
  const unspecified = spawnSync(process.execPath, ['scripts/bwiki/apply-preset.mjs'], { encoding: 'utf8' })
  assert.equal(unspecified.status, 1)
  assert.match(unspecified.stderr, /必须明确选择/)
  const old = spawnSync(process.execPath, ['scripts/bwiki/apply-preset.mjs', '--source=rocom'], { encoding: 'utf8' })
  assert.equal(old.status, 1)
  assert.match(old.stderr, /遗漏正式稳定 ID/)
})


test('service worker cache version includes stable public assets and worker policy', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tangerine-cache-'))
  const asset = path.join(directory, 'template.json')
  const worker = path.join(directory, 'sw.js')
  const source = await readFile('public/sw.js', 'utf8')
  const plugin = offlineAssets()
  plugin.configResolved({ root: directory, build: { outDir: '.' }, command: 'build' })
  try {
    await writeFile(asset, '{"version":1}')
    await writeFile(worker, source)
    await plugin.closeBundle()
    const first = await readFile(worker, 'utf8')
    assert.ok(!first.includes('__BUILD_VERSION__'))
    await writeFile(worker, source)
    await plugin.closeBundle()
    assert.equal(await readFile(worker, 'utf8'), first)
    await writeFile(asset, '{"version":2}')
    await writeFile(worker, source)
    await plugin.closeBundle()
    assert.notEqual(await readFile(worker, 'utf8'), first)
  } finally {
    await unlink(asset)
    await unlink(worker)
    await rmdir(directory)
  }
})
