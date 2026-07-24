import { db } from '../../../db/core.js'
import { nowIso } from '../../../utils.js'
import { READING_COMPANION_PRESET } from '../preset.js'

const SEED_KEY = 'seededReadingCompanionScene'

export async function ensureReadingCompanionSeeded() {
  const seeded = await db.meta.get(SEED_KEY)
  if (seeded?.value) return

  const existing = await db.scenes.get(READING_COMPANION_PRESET.scene.id)
  await db.transaction('rw', db.scenes, db.meta, async () => {
    if (!existing) {
      const scenes = await db.scenes.toArray()
      const order = scenes.length
        ? Math.max(...scenes.map((scene) => scene.order ?? 0)) + 1
        : 0
      const now = nowIso()
      await db.scenes.put({
        ...READING_COMPANION_PRESET.scene,
        order,
        createdAt: now,
        updatedAt: now,
      })
    }
    await db.meta.put({ key: SEED_KEY, value: true })
  })
}
