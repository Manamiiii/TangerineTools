import { db } from './core.js'
import { normalizeLegacyOptions } from '../utils.js'
import { ensureSeeded as ensureRockKingdomSeeded } from './rockKingdomSeed.js'

export async function ensureSeeded() {
  await db.transaction('rw', db.catalogFields, async () => {
    const fields = await db.catalogFields.toArray()
    for (const field of fields) {
      if (Array.isArray(field.options) && field.options.some((option) => typeof option === 'string')) {
        await db.catalogFields.update(field.id, { options: normalizeLegacyOptions(field.options) })
      }
    }
  })
  await ensureRockKingdomSeeded()
}
