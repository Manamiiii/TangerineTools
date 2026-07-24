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
const { db, ensureOwnedTable, ensureSeeded, importAllData } = await import('../../src/db.js')

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

test('startup removes only retired breeding demo rows from collection data', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url)
  await ensureSeeded()
  const ownedTableId = 'table-owned-scene-rock-kingdom'
  const now = new Date().toISOString()
  await db.catalogRows.bulkPut([
    { id: 'owned-rock-breeding-demo-1', tableId: ownedTableId, values: { note: '旧演示' }, createdAt: now, updatedAt: now },
    { id: 'owned-user-kept', tableId: ownedTableId, values: { note: '用户记录' }, createdAt: now, updatedAt: now },
  ])

  await ensureSeeded()

  assert.equal(await db.catalogRows.get('owned-rock-breeding-demo-1'), undefined)
  assert.equal((await db.catalogRows.get('owned-user-kept')).values.note, '用户记录')
})

test('owned table receives 52 removable shiny breeding fixtures only once', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url)
  await ensureSeeded()

  const table = await ensureOwnedTable('scene-rock-kingdom')
  const fixtureRows = (await db.catalogRows.where('tableId').equals(table.id).toArray())
    .filter((row) => row.values?.note === '孵蛋推荐调试预置（可删除）')
  assert.equal(fixtureRows.length, 52)
  assert.equal(new Set(fixtureRows.map((row) => row.values.ref)).size, 52)
  assert.equal(fixtureRows.filter((row) => row.values.gender === 'male').length, 26)
  assert.equal(fixtureRows.filter((row) => row.values.gender === 'female').length, 26)

  const creaturesById = new Map(creatures.map((row) => [row.id, row]))
  for (const row of fixtureRows) {
    const creature = creaturesById.get(row.values.ref)
    assert.ok(creature)
    assert.equal(creature.values.shiny, 'yes')
    assert.ok(creature.values.eggGroups.some((group) => group !== '无法孵蛋'))
  }

  await db.catalogRows.delete(fixtureRows[0].id)
  await ensureOwnedTable('scene-rock-kingdom')
  assert.equal(await db.catalogRows.get(fixtureRows[0].id), undefined)
  assert.equal(
    (await db.catalogRows.where('tableId').equals(table.id).toArray())
      .filter((row) => row.values?.note === '孵蛋推荐调试预置（可删除）').length,
    51,
  )
})

test.after(async () => {
  await db.delete()
})
