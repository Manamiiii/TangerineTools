import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NRC_PAGES, parseNrcCreatures, parseNrcSkills, parseNrcBreeding, parseNrcDetail } from './lib/nrc-parser.mjs'
import { readSnapshot, saveSnapshot } from './lib/snapshots.mjs'

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => !/^--(version|key|file|snapshots)=/.test(arg))) throw new Error('Unknown snapshot argument')
  const option = (key) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3)
  const version = option('version'), key = option('key'), file = option('file')
  if (!version || !/^[\w.-]+$/.test(version) || !file || !/^(creatures|skills|breeding|pet_\d+)$/.test(key ?? '')) throw new Error('Required: --version=... --key=creatures|skills|breeding|pet_NNNNNN --file=...')
  const directory = resolve(option('snapshots') ?? `artifacts/bwiki/nrc-snapshots/${version}`)
  const html = await readFile(resolve(file), 'utf8')
  let sourceUrl = NRC_PAGES[key]
  if (sourceUrl) ({ creatures: parseNrcCreatures, skills: parseNrcSkills, breeding: parseNrcBreeding })[key](html)
  else {
    const catalog = await readSnapshot(directory, 'creatures', NRC_PAGES.creatures, version)
    const creature = parseNrcCreatures(catalog.html).find((row) => row.sourceId === key)
    if (!creature) throw new Error('Detail key not present in this version of catalog')
    parseNrcDetail(html, creature)
    sourceUrl = creature.detailUrl
  }
  await saveSnapshot(directory, key, { sourceUrl, version, html, method: 'local-html-import' })
  console.log(`Validated and imported ${key}; this does not update staging or presets`)
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
