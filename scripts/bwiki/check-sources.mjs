import { readFile } from 'node:fs/promises'
import { BWIKI_PATHS } from './lib/paths.mjs'
import { buildSourceManifest } from './lib/source-manifest.mjs'
import { writeJsonAtomic } from './lib/snapshots.mjs'

async function main() {
  if (process.argv.slice(2).some((arg) => !['--write', '--source=nrc'].includes(arg))) throw new Error('Unknown source verification argument')
  const read = async (path) => JSON.parse(await readFile(path, 'utf8'))
  const [creatures, skills, creaturePreview, skillPreview] = await Promise.all([
    read(BWIKI_PATHS.presets.creatures), read(BWIKI_PATHS.presets.skills), read(BWIKI_PATHS.preview.creatures), read(BWIKI_PATHS.preview.skills),
  ])
  const manifest = buildSourceManifest({ creatures, skills, creaturePreview, skillPreview })
  const target = BWIKI_PATHS.presets.sources
  if (process.argv.includes('--write')) await writeJsonAtomic(target, manifest)
  else if (JSON.stringify(await read(target)) !== JSON.stringify(manifest)) throw new Error('来源清单与正式资料不一致')
  console.log(`Verified provenance for ${Object.keys(manifest.rows).length} preset rows`)
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
