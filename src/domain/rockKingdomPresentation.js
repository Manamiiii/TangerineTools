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

export function creatureReferenceLabel(row) {
  const values = row?.values ?? {}
  return [values.no, values.name, values.form].filter(Boolean).join(' · ')
}

export function creatureReferenceImage(field, row) {
  return isRockKingdomCreatureReference(field) ? row?.values?.image || '' : ''
}

export function rockKingdomStatus(fieldKey, value) {
  if (fieldKey === 'gender' && value) {
    const female = value === 'female'
    return { kind: 'gender', enabled: true, label: female ? '雌性' : '雄性', symbol: female ? '♀' : '♂', variant: female ? 'female' : 'male' }
  }
  if (fieldKey === 'shiny' && value !== '' && value != null) {
    const enabled = value === 'yes' || value === true
    return { kind: 'image', enabled, label: enabled ? '异色' : '非异色', image: enabled
      ? 'https://patchwiki.biligame.com/images/rocom/2/2e/buxc6y4s0r7d8ix03zzkahnk4h8urtv.png'
      : 'https://patchwiki.biligame.com/images/rocom/4/4f/20dseynhfc393c6jys1rnwhwwf94xvv.png' }
  }
  if (fieldKey === 'colorful' && value !== '' && value != null) {
    const enabled = value === 'yes' || value === true
    return { kind: 'colorful', enabled, label: enabled ? '炫彩' : '非炫彩', symbol: '✦' }
  }
  return null
}
