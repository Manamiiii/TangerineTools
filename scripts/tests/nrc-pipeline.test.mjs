import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseNrcCreatures, parseNrcSkills, parseNrcBreeding, parseNrcDetail } from '../bwiki/lib/nrc-parser.mjs'
import { fetchSnapshot, saveSnapshot, readSnapshot } from '../bwiki/lib/snapshots.mjs'
import { buildSourceManifest } from '../bwiki/lib/source-manifest.mjs'
import { assertPublishablePreview } from '../bwiki/lib/release-gate.mjs'

const fixture = async (name) => readFile(new URL(`./fixtures/nrc/${name}.html`, import.meta.url), 'utf8')

test('NRC aggregate parser keeps form identity, actual image URLs and skill numbers', async () => {
  const creatures = parseNrcCreatures(await fixture('creatures'))
  assert.equal(creatures.length, 2)
  assert.equal(creatures[0].name, '迪莫')
  assert.equal(creatures[1].formCategoryLabel, '首领形态')
  assert.notEqual(creatures[0].sourceId, creatures[1].sourceId)
  assert.equal(creatures[0].no, creatures[1].no)
  const skills = parseNrcSkills(await fixture('skills'))
  assert.equal(skills[0].name, '抓挠')
  assert.equal(skills[0].cost, 0)
  assert.equal(skills[0].power, 35)
  assert.deepEqual(parseNrcBreeding(await fixture('breeding'))[0].eggGroups, ['无法孵蛋'])
})

test('NRC detail reads data-val, checks six-stat sum and validates page identity', async () => {
  const creature = parseNrcCreatures(await fixture('creatures'))[0]
  const html = await fixture('detail')
  const detail = parseNrcDetail(html, creature)
  assert.equal(detail.stats.hp, 120)
  assert.equal(detail.stats.bst, 582)
  assert.equal(detail.skills[0].sourceType, 'level')
  assert.equal(detail.evolution[1].name, '圣光迪莫')
  assert.throws(() => parseNrcDetail(html.replace('data-val="120"', 'data-val="0"'), creature), /invalid six stats/)
  assert.throws(() => parseNrcDetail(html, { ...creature, sourceId: 'pet_999999' }), /identity mismatch/)
  assert.throws(() => parseNrcDetail(html.replaceAll('data-source="level"', 'data-source="unknown"'), creature), /unknown skill sources/)
})

test('Empty, blocked and duplicate aggregate pages fail closed', async () => {
  assert.throws(() => parseNrcCreatures('<html>Access denied</html>'), /no rows/)
  const html = await fixture('creatures')
  assert.throws(() => parseNrcCreatures(html + html), /duplicate name/)
  assert.throws(() => parseNrcCreatures(html.replaceAll('https://patchwiki.biligame.com/', 'https://example.com/')), /Unexpected source URL/)
})

test('Snapshot cache is versioned and a 567 never retries or replaces a successful snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tangerine-nrc-'))
  try {
    const sourceUrl = 'https://wiki.biligame.com/nrc/迪莫'
    await saveSnapshot(directory, 'pet_000004', { sourceUrl, version: 'S4', html: '<html>snapshot</html>' })
    await assert.rejects(readSnapshot(directory, 'pet_000004', sourceUrl, 'S3'), /stale snapshot/)
    let requests = 0
    await assert.rejects(fetchSnapshot(directory, 'pet_000004', sourceUrl, 'S4', async () => { requests++; return { ok: false, status: 567 } }), /HTTP 567/)
    assert.equal(requests, 1)
    assert.equal((await readSnapshot(directory, 'pet_000004', sourceUrl, 'S4')).html, '<html>snapshot</html>')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('Source manifest refuses attribution from a different preset revision', () => {
  const row = { id: 'sample', values: { name: '测试' } }
  const preview = { rows: [{ ...row, previewMeta: { detailUrl: 'https://wiki.biligame.com/nrc/测试' } }], sourceVersion: 'S4' }
  const manifest = buildSourceManifest({ creatures: [row], skills: [], creaturePreview: preview, skillPreview: { rows: [] } })
  assert.equal(manifest.sources.nrc.license, 'CC BY-SA 4.0')
  assert.throws(() => buildSourceManifest({ creatures: [{ ...row, values: { name: '其他' } }], skills: [], creaturePreview: preview, skillPreview: { rows: [] } }), /不一致/)
})

test('NRC release gate rejects missing review metadata and incomplete candidates', () => {
  const payload = { source: 'bwiki-preview', sourceProfile: 'nrc', rows: [], rowCount: 0 }
  assert.throws(() => assertPublishablePreview(payload, 'test'), /缺少 NRC/)
  assert.throws(() => assertPublishablePreview({ ...payload, releaseBlockers: ['缺少详情'] }, 'test'), /发布阻塞/)
  assert.doesNotThrow(() => assertPublishablePreview({ ...payload, sourceVersion: 'S4', stagingHashes: {}, releaseBlockers: [] }, 'test'))
})
