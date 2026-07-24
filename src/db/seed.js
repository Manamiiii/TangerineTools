import { ensureReadingCompanionSeeded } from './readingCompanionSeed.js'
import { ensureSeeded as ensureRockKingdomSeeded } from './rockKingdomSeed.js'

export async function ensureSeeded() {
  await ensureRockKingdomSeeded()
  await ensureReadingCompanionSeeded()
}
