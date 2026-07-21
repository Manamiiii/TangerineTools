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
