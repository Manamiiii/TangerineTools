import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import { db } from '../../src/db/core.js'
import {
  createCatalogTable,
  createField,
  createRow,
  createScene,
  deleteCatalogTable,
  deleteScene,
  ensureOwnedTable,
} from '../../src/db/repository.js'
import { ROCK_KINGDOM_COLLECTION_FIELDS } from '../../src/domain/owned.js'
import { ROCK_KINGDOM_PRESET } from '../../src/presets/rockKingdom.js'

async function resetDatabase() {
  await db.delete()
  await db.open()
}

test('catalog deletion cascades to fields and rows without deleting its scene', async () => {
  await resetDatabase()
  const scene = await createScene({ name: '测试场景', type: 'generic', tools: ['catalog'] })
  const table = await createCatalogTable(scene.id, '测试资料')
  const tail = await createField(table.id, { name: '备注', type: 'text' })
  const head = await createField(table.id, { name: '名称', type: 'text' }, 0)
  await createRow(table.id, { [head.key]: '测试项', [tail.key]: '保留到删表前' })

  const orderedFields = await db.catalogFields.where('tableId').equals(table.id).sortBy('order')
  assert.deepEqual(orderedFields.map((field) => field.id), [head.id, tail.id])

  await deleteCatalogTable(table.id)
  assert.ok(await db.scenes.get(scene.id))
  assert.equal(await db.catalogTables.get(table.id), undefined)
  assert.equal(await db.catalogFields.where('tableId').equals(table.id).count(), 0)
  assert.equal(await db.catalogRows.where('tableId').equals(table.id).count(), 0)
})

test('scene deletion cascades through ordinary and owned tables', async () => {
  await resetDatabase()
  const scene = await createScene({ name: '级联场景', type: 'generic', tools: ['catalog', 'owned'] })
  const table = await createCatalogTable(scene.id, '资料')
  const field = await createField(table.id, { name: '名称', type: 'text' })
  await createRow(table.id, { [field.key]: '记录' })
  const owned = await ensureOwnedTable(scene.id)
  await createField(owned.id, { name: '状态', type: 'boolean' })
  await createRow(owned.id, { status: true })

  await deleteScene(scene.id)
  assert.equal(await db.scenes.get(scene.id), undefined)
  assert.equal(await db.catalogTables.where('sceneId').equals(scene.id).count(), 0)
  assert.equal(await db.catalogFields.where('tableId').anyOf(table.id, owned.id).count(), 0)
  assert.equal(await db.catalogRows.where('tableId').anyOf(table.id, owned.id).count(), 0)
})

test('owned table creation is idempotent and only presets Rock Kingdom fields', async () => {
  await resetDatabase()
  const generic = await createScene({ name: '通用场景', type: 'generic', tools: ['owned'] })
  const genericOwned = await ensureOwnedTable(generic.id)
  assert.equal(genericOwned.collectionMode, 'single')
  assert.equal(await db.catalogFields.where('tableId').equals(genericOwned.id).count(), 0)
  assert.equal((await ensureOwnedTable(generic.id)).id, genericOwned.id)

  await db.scenes.put(ROCK_KINGDOM_PRESET.scene)
  await db.catalogTables.put(ROCK_KINGDOM_PRESET.tables[0])
  const rockOwned = await ensureOwnedTable(ROCK_KINGDOM_PRESET.scene.id)
  const rockFields = await db.catalogFields.where('tableId').equals(rockOwned.id).sortBy('order')
  assert.equal(rockOwned.collectionMode, 'multiple')
  assert.deepEqual(rockFields.map((field) => field.key), ROCK_KINGDOM_COLLECTION_FIELDS.map((field) => field.key))
  assert.equal(rockFields.find((field) => field.key === 'ref')?.referenceTableId, ROCK_KINGDOM_PRESET.tables[0].id)
  assert.equal(rockFields.find((field) => field.key === 'ref')?.display?.plainReference, true)
  assert.equal(rockFields.find((field) => field.key === 'gender')?.options?.[0]?.symbol, '♂')
  assert.equal(rockFields.find((field) => field.key === 'shiny')?.display?.mode, 'icon')

  await ensureOwnedTable(ROCK_KINGDOM_PRESET.scene.id)
  assert.equal(await db.catalogFields.where('tableId').equals(rockOwned.id).count(), rockFields.length)
})

test.after(async () => {
  await db.delete()
})
