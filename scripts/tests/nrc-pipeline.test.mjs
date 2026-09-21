import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseNrcCreatures, parseNrcSkills, parseNrcBreeding, parseNrcDetail } from '../bwiki/lib/nrc-parser.mjs'
import { fetchSnapshot, saveSnapshot, readSnapshot, sha256 } from '../bwiki/lib/snapshots.mjs'
import { buildSourceManifest } from '../bwiki/lib/source-manifest.mjs'
import { assertPublishablePreview } from '../bwiki/lib/release-gate.mjs'
import { parseSyncOptions } from '../bwiki/sync-nrc.mjs'

const fixture = async (name) => readFile(new URL(`./fixtures/nrc/${name}.html`, import.meta.url), 'utf8')

test('NRC sync accepts slow resumable batches and rejects unsafe or ambiguous options', () => {
  const defaults = parseSyncOptions(['--version=S4'])
  assert.equal(defaults.interval, 30)
  assert.equal(defaults.limit, 24)
  const slow = parseSyncOptions(['--version=S4', '--interval=60', '--limit=all'])
  assert.equal(slow.interval, 60)
  assert.equal(slow.limit, Infinity)
  assert.equal(parseSyncOptions(['--version=S4', '--offline']).offline, true)
  for (const argument of ['--interval=0', '--interval=29', '--interval=', '--interval=Infinity', '--interval=3601', '--limit=-1', '--limit=', '--limit=Infinity', '--limit=1.5', '--unknown=1']) {
    assert.throws(() => parseSyncOptions(['--version=S4', argument]))
  }
  assert.throws(() => parseSyncOptions(['--version=S4', '--interval=30', '--interval=60']), /Duplicate/)
  for (const version of ['.', '..', '../outside']) assert.throws(() => parseSyncOptions([`--version=${version}`]), /Specify/)
})

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

test('NRC preserves the observed legendary skill source without accepting arbitrary sources', async () => {
  const creature = parseNrcCreatures(await fixture('creatures'))[0]
  const html = (await fixture('detail')).replace(/<\/div>\s*$/, `${await fixture('skill-legendary')}</div>`)
  const skill = parseNrcDetail(html, creature).skills.find(row => row.sourceType === 'legendary')
  assert.deepEqual(skill, { name: '疾风连袭', sourceType: 'legendary', category: '状态', element: '翼', unlock: '传说' })
  assert.throws(() => parseNrcDetail(html.replace('data-source="legendary"', 'data-source="unknown"'), creature), /unknown skill sources/)
})

test('Empty, blocked and duplicate aggregate pages fail closed', async () => {
  assert.throws(() => parseNrcCreatures('<html>Access denied</html>'), /no rows/)
  const html = await fixture('creatures')
  assert.throws(() => parseNrcCreatures(html + html), /duplicate name/)
  assert.throws(() => parseNrcCreatures(html.replaceAll('https://patchwiki.biligame.com/', 'https://example.com/')), /Unexpected source URL/)
})

test('NRC evolution retains special-form identities from selflinks and link titles', async () => {
  const samples = [
    ['detail-duck', 'pet_000393', '鸭吉吉（燃了鸭）', 1],
    ['detail-shell', 'pet_000409', '板板壳（蜕皮时的样子）', 1],
    ['detail-chess', 'pet_000574', '棋契陛下（白棋棋齐垒分支）', 1],
    ['detail-cherry', 'pet_000114', '香草甜甜（樱桃饰品）', 3],
  ]
  for (const [file, sourceId, name, branches] of samples) {
    const html = await fixture(file)
    const creature = { sourceId, name, detailUrl: `https://wiki.biligame.com/nrc/${encodeURIComponent(name)}` }
    const detail = parseNrcDetail(html, creature)
    assert.equal(detail.evolutionReviewRequired, false, name)
    assert.equal(detail.evolutionBranches.length, branches)
    assert(detail.evolution.some((node) => node.name === name && node.displayName !== name))
    const withoutEvidence = parseNrcDetail(html.replaceAll('mw-selflink', 'unidentified'), creature)
    assert.equal(withoutEvidence.evolutionReviewRequired, true, 'No suffix-stripping fallback')
    assert.throws(() => parseNrcDetail(html + html, creature), /identity mismatch/)
    assert.throws(() => parseNrcDetail(html + '[Truncated]', creature), /truncated/)
    if (file === 'detail-shell') assert.equal(detail.evolution[1].name, '咔咔壳（蜕皮时的样子）')
    if (file === 'detail-chess') assert.equal(detail.evolution[2].isBoss, true)
  }
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
  assert.throws(() => assertPublishablePreview({ ...payload, releaseBlockers: ['缺少详情'] }, 'test'), /缺少 NRC/)
  const complete = { ...payload, sourceVersion: 'S4', stagingHashes: { creatures: 'hash' }, releaseBlockers: ['技能来源待审阅'] }
  const approval = { source: 'nrc-user-release-approval', version: 'S4', approvedAt: '2026-09-21', decision: '确认具体候选', stagingHashes: complete.stagingHashes, reviewedBlockers: complete.releaseBlockers, rowHashes: { creatures: sha256(JSON.stringify(complete.rows)) } }
  assert.throws(() => assertPublishablePreview(complete, 'test'), /用户发布确认/)
  assert.doesNotThrow(() => assertPublishablePreview(complete, 'test', approval, 'creatures'))
  for (const changed of [
    { ...complete, sourceVersion: 'S5' },
    { ...complete, stagingHashes: { creatures: 'changed' } },
    { ...complete, releaseBlockers: [] },
    { ...complete, rows: [{ id: 'changed', values: {} }], rowCount: 1 },
  ]) assert.throws(() => assertPublishablePreview(changed, 'test', approval, 'creatures'), /用户发布确认/)
  assert.throws(() => assertPublishablePreview(complete, 'test', approval, 'skills'), /用户发布确认/)
})

test('NRC source manifest retains the rocom attribution of confirmed shiny images', () => {
  const row = { id: 'sample', values: { name: '火红尾', shiny: 'yes', shinyImage: 'https://patchwiki.biligame.com/images/rocom/example.png' } }
  const preview = { rows: [{ ...row, previewMeta: { detailUrl: 'https://wiki.biligame.com/nrc/火红尾', shinyDecision: '用户确认有异色', shinyImageSource: 'existing-public-preset' } }], sourceVersion: 'S4' }
  const manifest = buildSourceManifest({ creatures: [row], skills: [], creaturePreview: preview, skillPreview: { rows: [] } })
  assert.equal(manifest.rows.sample.source, 'nrc')
  assert.equal(manifest.rows.sample.fieldSources.shinyImage.source, 'rocom')
  assert.equal(manifest.rows.sample.fieldSources.shiny.source, 'user-confirmed')
  assert(manifest.sources.rocom)
})
