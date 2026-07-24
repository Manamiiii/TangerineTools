import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import 'fake-indexeddb/auto'

const repoUrl = new URL('../../', import.meta.url)
const [creatures, skills, migration] = await Promise.all([
  readFile(new URL('public/presets/rockKingdomRows.json', repoUrl), 'utf8').then(JSON.parse),
  readFile(new URL('public/presets/rockKingdomSkillRows.json', repoUrl), 'utf8').then(JSON.parse),
  readFile(new URL('public/presets/rockKingdomPresetMigration.json', repoUrl), 'utf8').then(JSON.parse),
])
const { db, ensureSeeded, getReadingState, importAllData, saveReadingState } = await import('../../src/db.js')

function presetResponse(url, failCreatureRows = false) {
  const value = String(url)
  if (value.endsWith('rockKingdomPresetMigration.json')) return new Response(JSON.stringify(migration))
  if (value.endsWith('rockKingdomRows.json')) {
    return failCreatureRows
      ? new Response('unavailable', { status: 503 })
      : new Response(JSON.stringify(creatures))
  }
  if (value.endsWith('rockKingdomSkillRows.json')) return new Response(JSON.stringify(skills))
  return new Response('not found', { status: 404 })
}

async function resetDatabase() {
  await db.delete()
  await db.open()
}

test('official shiny creature rows have audited BWiki images', () => {
  const shinyRows = creatures.filter((row) => row.values.shiny === 'yes')
  assert.equal(shinyRows.length, 145)
  assert.equal(shinyRows.filter((row) => row.values.shinyImage).length, shinyRows.length)
  assert.equal(
    creatures.filter((row) => row.values.shiny !== 'yes' && row.values.shinyImage).length,
    0,
  )
  for (const row of shinyRows) {
    assert.match(row.values.shinyImage, /^https:\/\/patchwiki\.biligame\.com\//)
  }
})

test('reading progress uses namespaced meta records and merges updates', async () => {
  await resetDatabase()
  const sceneId = 'scene-reader-test'
  const editionId = 'gone-with-the-wind-zh-9787570202188'
  await saveReadingState(sceneId, editionId, {
    packageId: 'reader-package-gone-with-the-wind-zh-9787570202188',
    currentChapterId: 'chapter-01',
    observedEntities: [{
      id: 'observed-place',
      name: '读者确认的地点',
      kind: 'place',
      firstSeenChapterId: 'chapter-01',
    }],
  })
  await saveReadingState(sceneId, editionId, { currentChapterId: 'chapter-12' })
  const state = await getReadingState(sceneId, editionId)
  assert.equal(state.packageId, 'reader-package-gone-with-the-wind-zh-9787570202188')
  assert.equal(state.currentChapterId, 'chapter-12')
  assert.deepEqual(state.observedEntities, [{
    id: 'observed-place',
    name: '读者确认的地点',
    kind: 'place',
    firstSeenChapterId: 'chapter-01',
  }])
  assert.equal(state.sceneId, sceneId)
  assert.equal(state.editionId, editionId)
})

test('seed migration is versioned and preserves imported custom preset values', async () => {
  await resetDatabase()
  let fetchCount = 0
  globalThis.fetch = async (url) => {
    fetchCount += 1
    return presetResponse(url)
  }
  await ensureSeeded()

  assert.equal(await db.catalogRows.where('tableId').equals('table-rock-kingdom-elf-basic').count(), creatures.length)
  assert.equal(await db.catalogRows.where('tableId').equals('table-rock-kingdom-skills').count(), skills.length)
  assert.equal((await db.meta.get('rockKingdomRuntimeMigrationVersion'))?.value, migration.version)

  const first = await db.catalogRows.get(creatures[0].id)
  const customDescription = '用户自定义特性说明，正式预置迁移不得覆盖。'
  await importAllData({ data: { catalogRows: [{ ...first, values: { ...first.values, traitDesc: customDescription } }] } })
  assert.equal(await db.meta.get('rockKingdomRuntimeMigrationVersion'), undefined)
  await ensureSeeded()
  assert.equal((await db.catalogRows.get(first.id)).values.traitDesc, customDescription)

  fetchCount = 0
  globalThis.fetch = async () => { fetchCount += 1; throw new Error('same version must not fetch presets') }
  await db.scenes.update('scene-rock-kingdom', {
    tools: ['catalog', 'owned', 'stock', 'nature', 'breeding'],
  })
  await ensureSeeded()
  assert.equal(fetchCount, 0)
  assert.deepEqual(
    (await db.scenes.get('scene-rock-kingdom')).tools,
    ['catalog', 'nature', 'owned', 'breeding', 'stock'],
  )
})

test('startup seeds one reader scene and never overwrites user customization', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url)
  await ensureSeeded()

  const sceneId = 'scene-reading-companion'
  const seededScene = await db.scenes.get(sceneId)
  assert.equal(seededScene.name, '经典文学阅读')
  assert.equal(seededScene.type, 'reading')
  assert.deepEqual(seededScene.tools, ['reader'])
  assert.equal((await db.meta.get('seededReadingCompanionScene'))?.value, true)

  await db.scenes.update(sceneId, { name: '我的文学阅读', tools: ['reader', 'catalog'] })
  await db.meta.delete('seededReadingCompanionScene')
  await ensureSeeded()
  const customizedScene = await db.scenes.get(sceneId)
  assert.equal(customizedScene.name, '我的文学阅读')
  assert.deepEqual(customizedScene.tools, ['reader', 'catalog'])

  await db.scenes.delete(sceneId)
  await ensureSeeded()
  assert.equal(await db.scenes.get(sceneId), undefined)
})

test('an offline preset failure remains retryable', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url, true)
  await ensureSeeded()
  assert.equal(await db.meta.get('rockKingdomRuntimeMigrationVersion'), undefined)

  globalThis.fetch = async (url) => presetResponse(url)
  await ensureSeeded()
  assert.equal((await db.meta.get('rockKingdomRuntimeMigrationVersion'))?.value, migration.version)
  assert.equal(await db.catalogRows.where('tableId').equals('table-rock-kingdom-elf-basic').count(), creatures.length)
})

test('startup removes only retired breeding test rows from collection data', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url)
  await ensureSeeded()
  const ownedTableId = 'table-owned-scene-rock-kingdom'
  const now = new Date().toISOString()
  await db.catalogRows.bulkPut([
    { id: 'owned-rock-breeding-demo-1', tableId: ownedTableId, values: { note: '旧演示' }, createdAt: now, updatedAt: now },
    { id: 'owned-rock-breeding-fixture-test', tableId: ownedTableId, values: { note: '孵蛋推荐调试预置（可删除）' }, createdAt: now, updatedAt: now },
    { id: 'owned-user-kept', tableId: ownedTableId, values: { note: '用户记录' }, createdAt: now, updatedAt: now },
    { id: 'owned-user-same-note', tableId: ownedTableId, values: { note: '孵蛋推荐调试预置（可删除）' }, createdAt: now, updatedAt: now },
  ])
  await db.meta.bulkPut([
    { key: 'seededRockKingdomBreedingDemoOwnedRows', value: true },
    { key: 'seededRockKingdomBreedingFixturesV1', value: true },
  ])

  await ensureSeeded()

  assert.equal(await db.catalogRows.get('owned-rock-breeding-demo-1'), undefined)
  assert.equal(await db.catalogRows.get('owned-rock-breeding-fixture-test'), undefined)
  assert.equal((await db.catalogRows.get('owned-user-kept')).values.note, '用户记录')
  assert.equal((await db.catalogRows.get('owned-user-same-note')).values.note, '孵蛋推荐调试预置（可删除）')
  assert.equal(await db.meta.get('seededRockKingdomBreedingDemoOwnedRows'), undefined)
  assert.equal(await db.meta.get('seededRockKingdomBreedingFixturesV1'), undefined)
})

test.after(async () => {
  await db.delete()
})
