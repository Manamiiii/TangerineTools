import { ensureSeeded as ensureRockKingdomSeeded } from './rockKingdomSeed.js'

export async function ensureSeeded() {
  await ensureRockKingdomSeeded()
}
