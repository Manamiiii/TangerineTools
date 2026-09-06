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
const {
  db,
  ensureSeeded,
  importAllData,
} = await import('../../src/db.js')

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
    ['catalog', 'owned', 'stock', 'nature', 'breeding'],
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

test('startup preserves collection records including legacy demo and fixture ids', async () => {
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

  const before = await db.catalogRows.where('tableId').equals(ownedTableId).toArray()
  await db.meta.delete('rockKingdomRuntimeMigrationVersion')
  await ensureSeeded()
  await ensureSeeded()

  assert.deepEqual(await db.catalogRows.where('tableId').equals(ownedTableId).toArray(), before)
  assert.equal((await db.catalogRows.get('owned-rock-breeding-demo-1')).values.note, '旧演示')
  assert.equal((await db.catalogRows.get('owned-rock-breeding-fixture-test')).values.note, '孵蛋推荐调试预置（可删除）')
  assert.equal((await db.catalogRows.get('owned-user-kept')).values.note, '用户记录')
  assert.equal((await db.catalogRows.get('owned-user-same-note')).values.note, '孵蛋推荐调试预置（可删除）')
  assert.equal((await db.meta.get('seededRockKingdomBreedingDemoOwnedRows')).value, true)
  assert.equal((await db.meta.get('seededRockKingdomBreedingFixturesV1')).value, true)
})


test('startup preserves imported scene tools and field preferences without migration markers', async () => {
  await resetDatabase()
  globalThis.fetch = async (url) => presetResponse(url)
  const { ROCK_KINGDOM_PRESET } = await import('../../src/presets/rockKingdom.js')
  const scene = { ...ROCK_KINGDOM_PRESET.scene, name: '我的洛克', tools: ['catalog', 'owned', 'stock', 'nature', 'breeding'] }
  const field = {
    ...ROCK_KINGDOM_PRESET.fields.find((item) => item.key === 'traitName'),
    name: '我的特性列', order: 123, hidden: false, display: { custom: true },
  }
  await importAllData({ data: { scenes: [scene], catalogFields: [field] } })
  await ensureSeeded()
  await ensureSeeded()
  assert.deepEqual(await db.scenes.get(scene.id), scene)
  assert.deepEqual(await db.catalogFields.get(field.id), field)

  // 导入主动关闭工具的配置，同样不能凭旧默认数组重新打开工具。
  await importAllData({ data: { scenes: [{ ...scene, tools: ['catalog'] }] } })
  await ensureSeeded()
  assert.deepEqual((await db.scenes.get(scene.id)).tools, ['catalog'])
})

test.after(async () => {
  await db.delete()
})
