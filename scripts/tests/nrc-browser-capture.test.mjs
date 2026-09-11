import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { captureBrowserDetail, validateBrowserCapture } from '../bwiki/lib/browser-capture.mjs'
import { parseNrcCreatures, NRC_PAGES } from '../bwiki/lib/nrc-parser.mjs'
import { saveSnapshot, readSnapshot } from '../bwiki/lib/snapshots.mjs'

const expected = { version: 'browser-test', sourceId: 'pet_000004', sourceUrl: 'https://wiki.biligame.com/nrc/%E8%BF%AA%E8%8E%AB' }
const html = '<div>' + '样本😀'.repeat(60000) + '</div>'
const metadata = { ...expected, rootCount: 1, ready: true, characters: html.length }
const options = (changes = {}) => ({ expected, readMetadata: async () => metadata, readChunk: async (start, end) => html.slice(start, end), pause: async () => {}, ...changes })

test('Browser capture preserves large Unicode content and verifies two complete passes', async () => {
  let reads = 0
  const record = await captureBrowserDetail(options({ readChunk: async (start, end) => { reads++; assert(end - start <= 50000); return html.slice(start, end) } }))
  assert.equal(record.html, html)
  assert.equal(reads, 2 * Math.ceil(html.length / 50000))
  assert.equal(validateBrowserCapture(record, expected), record)
  for (const change of [{ version: 'older' }, { sourceId: 'pet_000005' }, { sourceUrl: expected.sourceUrl + '?x=1' }, { html: html.slice(0, -1) }, { verifiedPasses: 1 }]) {
    assert.throws(() => validateBrowserCapture({ ...record, ...change }, expected))
  }
})

test('Browser capture fails closed on wrong pages, unsettled DOM and truncated chunks', async () => {
  for (const change of [{ sourceId: 'pet_000005' }, { sourceUrl: 'https://example.com/' }, { rootCount: 2 }, { ready: false }]) {
    await assert.rejects(captureBrowserDetail(options({ readMetadata: async () => ({ ...metadata, ...change }) })))
  }
  await assert.rejects(captureBrowserDetail(options({ readChunk: async () => '[Truncated]' })), /Incomplete/)
  let reads = 0
  await assert.rejects(captureBrowserDetail(options({ readMetadata: async () => ({ ...metadata, characters: metadata.characters + reads++ }) })), /settling/)
  let chunks = 0
  await assert.rejects(captureBrowserDetail(options({ readChunk: async (start, end) => {
    const part = html.slice(start, end)
    return ++chunks > Math.ceil(html.length / 50000) ? part.replace('样', '异') : part
  } })), /between reads/)
})

test('Browser capture import preserves provenance, resumes and rejects replacement or cross-version records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nrc-browser-'))
  try {
    const catalogHtml = await readFile(new URL('./fixtures/nrc/creatures.html', import.meta.url), 'utf8')
    const detailHtml = (await readFile(new URL('./fixtures/nrc/detail.html', import.meta.url), 'utf8')).trim()
    const creature = parseNrcCreatures(catalogHtml)[0]
    const identity = { ...expected, sourceUrl: creature.detailUrl }
    const record = await captureBrowserDetail(options({ expected: identity, readMetadata: async () => ({ ...metadata, ...identity, characters: detailHtml.length }), readChunk: async (start, end) => detailHtml.slice(start, end) }))
    await saveSnapshot(directory, 'creatures', { sourceUrl: NRC_PAGES.creatures, version: identity.version, html: catalogHtml })
    const file = join(directory, 'capture.json')
    await writeFile(file, JSON.stringify(record))
    const run = () => spawnSync(process.execPath, ['scripts/bwiki/import-nrc-snapshot.mjs', `--version=${identity.version}`, `--key=${identity.sourceId}`, `--capture=${file}`, `--snapshots=${directory}`], { encoding: 'utf8' })
    let result = run()
    assert.equal(result.status, 0, result.stderr)
    const saved = await readSnapshot(directory, identity.sourceId, identity.sourceUrl, identity.version)
    assert.equal(saved.capturedAt, record.capturedAt)
    assert.equal(saved.method, 'browser-dom-verified')
    assert.match(run().stdout, /Already imported/)
    await writeFile(file, JSON.stringify({ ...record, version: 'other' }))
    assert.notEqual(run().status, 0)
    const changed = record.html.replace('data-val="120"', 'data-val="121"').replace('data-val="582"', 'data-val="583"')
    await writeFile(file, JSON.stringify({ ...record, html: changed }))
    result = run()
    assert.match(result.stderr, /already exists/)
    assert.equal((await readSnapshot(directory, identity.sourceId, identity.sourceUrl, identity.version)).sha256, saved.sha256)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
