import assert from 'node:assert/strict'
import test from 'node:test'
import 'fake-indexeddb/auto'
import { db } from '../../src/db/core.js'
import {
  exportReadingCompanionData,
  READING_BACKUP_FORMAT,
} from '../../src/db/importExport.js'

test.beforeEach(async () => {
  await db.meta.clear()
})

test.after(async () => {
  db.close()
})

test('reading migration export keeps only reading state and personal books', async () => {
  await db.meta.bulkPut([
    { key: 'readerState:scene-reading-companion:edition-1', value: { editionId: 'edition-1' } },
    { key: 'readerPersonalPackage:book-1', value: { package: { id: 'book-1' } } },
    { key: 'seededRockKingdom', value: true },
  ])

  const payload = await exportReadingCompanionData()
  assert.equal(payload.format, READING_BACKUP_FORMAT)
  assert.deepEqual(payload.data.meta.map((record) => record.key).sort(), [
    'readerPersonalPackage:book-1',
    'readerState:scene-reading-companion:edition-1',
  ])
})
