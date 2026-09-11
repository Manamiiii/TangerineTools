import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NRC_PAGES, parseNrcCreatures, parseNrcSkills, parseNrcBreeding, parseNrcDetail } from './lib/nrc-parser.mjs'
import { readSnapshot, saveSnapshot } from './lib/snapshots.mjs'
import { validateBrowserCapture } from './lib/browser-capture.mjs'

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => !/^--(version|key|file|capture|snapshots)=/.test(arg))) throw new Error('Unknown snapshot argument')
  if (new Set(args.map((arg) => arg.split('=')[0])).size !== args.length) throw new Error('Duplicate snapshot argument')
  const option = (key) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3)
  const version = option('version'), key = option('key'), file = option('file'), capture = option('capture')
  if (!version || !/^[\w][\w.-]*$/.test(version) || Boolean(file) === Boolean(capture) || !/^(creatures|skills|breeding|pet_\d+)$/.test(key ?? '')) throw new Error('Required: --version=... --key=creatures|skills|breeding|pet_NNNNNN and exactly one of --file=... / --capture=...')
  if (capture && !key.startsWith('pet_')) throw new Error('Browser capture imports support details only')
  const directory = resolve(option('snapshots') ?? `artifacts/bwiki/nrc-snapshots/${version}`)
  const record = capture ? JSON.parse(await readFile(resolve(capture), 'utf8')) : null
  const html = record ? record.html : await readFile(resolve(file), 'utf8')
  let sourceUrl = NRC_PAGES[key]
  if (sourceUrl) ({ creatures: parseNrcCreatures, skills: parseNrcSkills, breeding: parseNrcBreeding })[key](html)
  else {
    const catalog = await readSnapshot(directory, 'creatures', NRC_PAGES.creatures, version)
    const creature = parseNrcCreatures(catalog.html).find((row) => row.sourceId === key)
    if (!creature) throw new Error('Detail key not present in this version of catalog')
    if (record) validateBrowserCapture(record, { version, sourceId: key, sourceUrl: creature.detailUrl })
    parseNrcDetail(html, creature)
    sourceUrl = creature.detailUrl
  }
  try {
    const existing = await readSnapshot(directory, key, sourceUrl, version)
    if (existing.html !== html) throw new Error('Snapshot already exists with different content; use a new version instead of overwriting')
    console.log(`Already imported ${key}; preserved existing snapshot`)
    return
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await saveSnapshot(directory, key, { sourceUrl, version, html, ...(record ? { capturedAt: record.capturedAt, method: 'browser-dom-verified' } : { method: 'local-html-import' }) })
  console.log(`Validated and imported ${key}; this does not update staging or presets`)
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
