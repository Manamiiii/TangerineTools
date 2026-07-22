import { compareRockKingdomCreatureRows, visibleRockKingdomCreatureRows } from './rockKingdom.js'
import { ROCK_KINGDOM_CREATURE_TABLE_ID } from '../presets/rockKingdom.js'

export function isRockKingdomCreatureReference(field) {
  return field?.referenceTableId === ROCK_KINGDOM_CREATURE_TABLE_ID
}

export function selectableReferenceRows(field, rows = []) {
  return isRockKingdomCreatureReference(field)
    ? visibleRockKingdomCreatureRows(rows).sort(compareRockKingdomCreatureRows)
    : rows
}
