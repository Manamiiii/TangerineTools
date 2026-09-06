import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import { db } from '../../src/db/core.js'
import { exportAllData, importAllData, previewImportData } from '../../src/db/importExport.js'

test.beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.scenes.put({ id: 'scene', name: '个人游戏', tools: ['catalog', 'owned'] })
  await db.catalogTables.bulkPut([
    { id: 'catalog', sceneId: 'scene', name: '资料' },
    { id: 'owned', sceneId: 'scene', name: '收集', kind: 'owned' },
  ])
  await db.catalogFields.put({ id: 'ref-field', tableId: 'owned', key: 'ref', type: 'reference', referenceTableId: 'catalog' })
  await db.catalogRows.bulkPut([
    { id: 'creature', tableId: 'catalog', values: { name: '资料' } },
    { id: 'kept', tableId: 'owned', values: { ref: 'creature', note: '文件未包含' } },
    { id: 'overwritten', tableId: 'owned', values: { ref: 'creature', note: '原值', old: true } },
  ])
  await db.meta.put({ key: 'rockKingdomRuntimeMigrationVersion', value: 'test-version' })
})

test.after(async () => { await db.delete() })

test('preview counts additions and overwrites without writing, resolving references against local data', async () => {
  const payload = { data: { catalogRows: [
    { id: 'overwritten', tableId: 'owned', values: { ref: 'creature', note: '导入值' } },
    { id: 'new-random-id', tableId: 'owned', values: { ref: 'creature' } },
  ] } }
  const before = (await exportAllData()).data
  const summary = await previewImportData(payload)
  assert.deepEqual(summary.collections.find((item) => item.key === 'catalogRows'), {
    key: 'catalogRows', label: '资料行与收集记录', added: 1, overwritten: 1,
  })
  assert.equal(summary.warningCount, 0)
  assert.deepEqual((await exportAllData()).data, before)
  await importAllData(payload)
  assert.deepEqual((await db.catalogRows.get('overwritten')).values, { ref: 'creature', note: '导入值' })
  assert.deepEqual(await db.catalogRows.get('kept'), before.catalogRows.find((row) => row.id === 'kept'))
  assert.ok(await db.catalogRows.get('new-random-id'))
  assert.equal(await db.meta.get('rockKingdomRuntimeMigrationVersion'), undefined)
})

test('broken payloads leave every collection and migration marker unchanged', async () => {
  const before = (await exportAllData()).data
  const row = { id: 'duplicate', tableId: 'owned', values: {} }
  for (const catalogRows of [[row, row], [{ id: 'missing-parent', values: {} }]]) {
    const payload = { data: { scenes: [{ id: 'scene', name: '不能写入' }], catalogRows } }
    await assert.rejects(previewImportData(payload))
    await assert.rejects(importAllData(payload))
    assert.deepEqual((await exportAllData()).data, before)
  }
})

test('a write failure rolls back earlier collections and keeps migration markers', async () => {
  const before = (await exportAllData()).data
  // 模拟事务中后续集合写入失败，不触及浏览器数据库。
  function fail() { throw new Error('simulated storage failure') }
  db.catalogRows.hook('creating', fail)
  try {
    await assert.rejects(importAllData({ data: {
      scenes: [{ id: 'scene', name: '不能部分写入' }],
      catalogRows: [{ id: 'fail', tableId: 'owned', values: {} }],
    } }), /simulated storage failure/)
  } finally {
    db.catalogRows.hook('creating').unsubscribe(fail)
  }
  assert.deepEqual((await exportAllData()).data, before)
})

test('preview resolves incoming targets and reports missing or wrong-table references without deleting data', async () => {
  const payload = { data: {
    catalogFields: [{ id: 'refs-field', tableId: 'owned', key: 'refs', type: 'references', referenceTableId: 'catalog' }],
    catalogRows: [
      { id: 'new-target', tableId: 'catalog', values: { name: '新增资料' } },
      { id: 'valid', tableId: 'owned', values: { refs: ['new-target', 'creature'] } },
      { id: 'missing', tableId: 'owned', values: { refs: ['absent'] } },
      { id: 'wrong-table', tableId: 'owned', values: { ref: 'kept' } },
      { id: 'orphan', tableId: 'missing-table', values: { note: '仍可恢复' } },
    ],
  } }
  const summary = await previewImportData(payload)
  assert.equal(summary.warningCount, 3)
  assert.ok(summary.warnings.some((message) => message.includes('absent')))
  assert.ok(summary.warnings.some((message) => message.includes('wrong-table')))
  assert.ok(summary.warnings.some((message) => message.includes('missing-table')))
  await importAllData(payload)
  for (const row of payload.data.catalogRows) assert.deepEqual(await db.catalogRows.get(row.id), row)
})

test('export and reimport preserve all five collections and random ids', async () => {
  await db.meta.put({ key: 'readerState:old-random-scene:edition', value: { page: 42 } })
  await db.meta.delete('rockKingdomRuntimeMigrationVersion')
  const payload = await exportAllData()
  assert.equal(payload.schemaVersion, 1)
  await db.delete()
  await db.open()
  await importAllData(JSON.parse(JSON.stringify(payload)))
  assert.deepEqual((await exportAllData()).data, payload.data)
})
