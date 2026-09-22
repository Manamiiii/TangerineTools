import { db, writeOwnedRecords } from '../../db.js'
import { findScannerDuplicateCandidates, isScannerFrameReady } from '../../domain/rockKingdomScanner.js'
import { valuesWithAppearance } from '../../domain/rockKingdomAppearance.js'

export function scannerDuplicateCandidates(frame, frames, ownedRows) {
  const preceding = frames.slice(0, frames.indexOf(frame)).filter(isScannerFrameReady)
  return findScannerDuplicateCandidates(frame.values, [
    ...ownedRows, ...preceding.map((item) => ({ id: item.id, values: item.values })),
  ])
}

export async function saveScannerFrames(tableId, frames) {
  if (!frames.length || frames.some((frame) => !isScannerFrameReady(frame))) throw new Error('请先确认完整的扫描记录')
  return db.transaction('rw', db.catalogTables, db.catalogFields, db.catalogRows, async () => {
    const existing = await db.catalogRows.where('tableId').equals(tableId).toArray()
    for (const frame of frames) {
      if (scannerDuplicateCandidates(frame, frames, existing).some((item) => item.blocking)
        && frame.duplicateDecision !== 'add') throw new Error('发现相似记录，请复核后选择仍然新增或跳过')
    }
    return writeOwnedRecords(tableId, frames.map((frame) => ({ values: valuesWithAppearance(frame.values) })), { appendOnly: true })
  })
}
