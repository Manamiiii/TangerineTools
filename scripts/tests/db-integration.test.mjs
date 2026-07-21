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
const { db, ensureSeeded, importAllData } = await import('../../src/db.js')

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
  await ensureSeeded()
  assert.equal(fetchCount, 0)
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

test.after(async () => {
  await db.delete()
})
