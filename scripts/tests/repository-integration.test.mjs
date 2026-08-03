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
  updateRows,
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
  assert.equal(rockFields.find((field) => field.key === 'ref')?.name, '图鉴名')
  assert.equal(rockFields.find((field) => field.key === 'nickname')?.name, '精灵名')
  assert.ok(
    rockFields.find((field) => field.key === 'ref').order
    < rockFields.find((field) => field.key === 'nickname').order
    && rockFields.find((field) => field.key === 'nickname').order
    < rockFields.find((field) => field.key === 'nature').order,
  )
  assert.equal(rockFields.find((field) => field.key === 'ref')?.display?.plainReference, true)
  assert.equal(rockFields.find((field) => field.key === 'gender')?.options?.[0]?.symbol, '♂')
  assert.equal(rockFields.find((field) => field.key === 'shiny')?.display?.mode, 'icon')
  assert.equal(rockFields.find((field) => field.key === 'shiny')?.hidden, true)
  assert.equal(rockFields.find((field) => field.key === 'colorful')?.hidden, true)
  assert.equal(rockFields.find((field) => field.key === 'appearance')?.display?.allowEmpty, false)
  assert.equal(rockFields.find((field) => field.key === 'partnerMark')?.display?.defaultValue, 'none')

  await db.catalogFields.update(
    rockFields.find((field) => field.key === 'shiny').id,
    { hidden: false },
  )
  await db.catalogFields.update(
    rockFields.find((field) => field.key === 'nickname').id,
    { hidden: true, name: '旧昵称' },
  )
  await ensureOwnedTable(ROCK_KINGDOM_PRESET.scene.id)
  assert.equal(await db.catalogFields.where('tableId').equals(rockOwned.id).count(), rockFields.length)
  assert.equal((await db.catalogFields.get(rockFields.find((field) => field.key === 'shiny').id)).hidden, true)
  assert.deepEqual(
    await db.catalogFields.get(rockFields.find((field) => field.key === 'nickname').id)
      .then((field) => ({ name: field.name, hidden: field.hidden })),
    { name: '精灵名', hidden: false },
  )
})

test('batch row updates change only the supplied rows and values in one repository operation', async () => {
  await resetDatabase()
  const scene = await createScene({ name: '批量修改场景', type: 'generic', tools: ['owned'] })
  const owned = await ensureOwnedTable(scene.id)
  const first = await createRow(owned.id, { nature: 'timid', note: '保留一' })
  const second = await createRow(owned.id, { nature: 'timid', note: '保留二' })
  const untouched = await createRow(owned.id, { nature: 'calm', note: '不修改' })

  await updateRows([
    { id: first.id, values: { ...first.values, nature: 'adamant' } },
    { id: second.id, values: { ...second.values, nature: 'adamant' } },
  ])

  assert.deepEqual((await db.catalogRows.get(first.id)).values, { nature: 'adamant', note: '保留一' })
  assert.deepEqual((await db.catalogRows.get(second.id)).values, { nature: 'adamant', note: '保留二' })
  assert.deepEqual((await db.catalogRows.get(untouched.id)).values, { nature: 'calm', note: '不修改' })
})

test.after(async () => {
  await db.delete()
})
