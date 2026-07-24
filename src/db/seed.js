import { ensureReadingCompanionSeeded } from '../features/reading-companion/db/seed.js'
import { ensureSeeded as ensureRockKingdomSeeded } from './rockKingdomSeed.js'

export async function ensureSeeded() {
  await ensureRockKingdomSeeded()
  await ensureReadingCompanionSeeded()
}
