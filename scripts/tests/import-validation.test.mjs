import assert from 'node:assert/strict'
import test from 'node:test'

import { EXPORT_SCHEMA_VERSION, validateImportPayload } from '../../src/db/importExport.js'

test('export schema remains compatible with existing backups', () => {
  assert.equal(EXPORT_SCHEMA_VERSION, 1)
})

test('import validation accepts partial merge payloads', () => {
  assert.equal(validateImportPayload({ data: { catalogRows: [] } }), null)
})

test('import validation rejects malformed collections', () => {
  assert.match(validateImportPayload(null), /JSON/)
  assert.match(validateImportPayload({}), /data/)
  assert.match(validateImportPayload({ data: {} }), /不包含/)
  assert.match(validateImportPayload({ data: { catalogRows: {} } }), /必须是数组/)
})

test('import validation checks record shape, versions and duplicate primary keys', () => {
  for (const record of [null, [], 'row', {}, { id: ' ' }, { id: 'row', values: {} }, { id: 'row', tableId: 'table', values: [] }]) {
    assert.ok(validateImportPayload({ data: { catalogRows: [record] } }))
  }
  const row = { id: 'random-id', tableId: 'random-table', values: { legacy: ['保留'] } }
  assert.equal(validateImportPayload({ data: { catalogRows: [row] } }), null)
  assert.match(validateImportPayload({ data: { catalogRows: [row, row] } }), /重复/)
  assert.match(validateImportPayload({ schemaVersion: 2, data: { catalogRows: [] } }), /schemaVersion/)
  assert.match(validateImportPayload({ schemaVersion: '1', data: { catalogRows: [] } }), /schemaVersion/)
  assert.match(validateImportPayload({ format: 'tangerine-reading-companion-backup', data: { meta: [] } }), /其他应用/)
  assert.match(validateImportPayload({ data: { meta: [{ key: 'x' }, { key: 'x' }] } }), /重复/)
  assert.match(validateImportPayload({ data: { scenes: [{ id: 'scene', tools: {} }] } }), /tools/)
  assert.match(validateImportPayload({ data: { catalogTables: [{ id: 'table' }] } }), /sceneId/)
  assert.match(validateImportPayload({ data: { catalogFields: [{ id: 'field', tableId: 'table', type: 'text' }] } }), /key/)
})

test('field validation accepts legacy option strings and rejects broken display structures', () => {
  const field = { id: 'field', tableId: 'table', key: 'status', type: 'select', options: ['已收集'] }
  assert.equal(validateImportPayload({ schemaVersion: 1, data: { catalogFields: [field] } }), null)
  for (const patch of [{ options: [null] }, { display: [] }, { statsDimensions: [null] }, { statsMap: 'invalid' }]) {
    assert.ok(validateImportPayload({ data: { catalogFields: [{ ...field, ...patch }] } }))
  }
})
