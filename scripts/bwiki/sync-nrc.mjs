import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { getBwikiPaths } from './lib/paths.mjs'
import { fetchSnapshot, readSnapshot, writeJsonAtomic } from './lib/snapshots.mjs'
import { NRC_PAGES, parseNrcCreatures, parseNrcSkills, parseNrcBreeding, parseNrcDetail } from './lib/nrc-parser.mjs'
import { SOURCE_NOTICES } from './lib/source-manifest.mjs'

export function parseSyncOptions(args) {
  if (args.some((a) => !/^(--version=|--snapshots=|--limit=|--interval=|--offline$)/.test(a))) throw new Error('Unknown argument')
  if (new Set(args.map((arg) => arg.split('=')[0])).size !== args.length) throw new Error('Duplicate argument')
  const option = (key) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3)
  const version = option('version')
  if (!version || !/^[\w][\w.-]*$/.test(version)) throw new Error('Specify --version=S4-2026-09-10; snapshots cannot cross source versions')
  const requestedLimit = option('limit') ?? '24'
  const limit = requestedLimit === 'all' ? Infinity : Number(requestedLimit)
  if (requestedLimit !== 'all' && (!/^\d+$/.test(requestedLimit) || !Number.isSafeInteger(limit))) throw new Error('Invalid --limit')
  const intervalText = option('interval') ?? '30'
  const interval = Number(intervalText)
  if (!/^\d+$/.test(intervalText) || !Number.isSafeInteger(interval) || interval < 30 || interval > 3600) throw new Error('Invalid --interval: use 30–3600 seconds')
  const directory = resolve(option('snapshots') ?? `artifacts/bwiki/nrc-snapshots/${version}`)
  const offline = args.includes('--offline')
  return { version, limit, interval, directory, offline }
}

async function main() {
  const { version, limit, interval, directory, offline } = parseSyncOptions(process.argv.slice(2))
  const paths = getBwikiPaths('nrc')
  let fetched = 0
  let stopped = ''
  async function snapshot(key, sourceUrl) {
    try { return await readSnapshot(directory, key, sourceUrl, version) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      if (offline || stopped) return null
      console.log(`NRC waiting ${interval}s before ${key}: ${sourceUrl}`)
      await delay(interval * 1000)
      try { return await fetchSnapshot(directory, key, sourceUrl, version) } catch (failure) {
        stopped = failure.message
        console.error(`NRC requests stopped: ${stopped}`)
        await writeJsonAtomic(resolve(directory, 'last-failure.json'), { sourceUrl, version, attemptedAt: new Date().toISOString(), error: stopped })
        return null
      }
    }
  }
  const aggregate = {}
  const provenance = []
  for (const [key, sourceUrl] of Object.entries(NRC_PAGES)) {
    const record = await snapshot(key, sourceUrl)
    if (!record) throw new Error(`Missing ${key} snapshot. ${stopped || 'Offline mode'}`)
    aggregate[key] = record.html
    const { html: _, ...sourceRecord } = record
    provenance.push(sourceRecord)
  }
  const creatures = parseNrcCreatures(aggregate.creatures)
  const skills = parseNrcSkills(aggregate.skills)
  const breeding = parseNrcBreeding(aggregate.breeding)
  const baselineCreatures = JSON.parse(await readFile(paths.presets.creatures, 'utf8'))
  const baselineSkills = JSON.parse(await readFile(paths.presets.skills, 'utf8'))
  if (creatures.length < baselineCreatures.length || skills.length < baselineSkills.length) throw new Error('Aggregate snapshot is smaller than the published baseline; investigate truncation or removals before staging')
  if (new Set(creatures.map((row) => row.sourceId)).size !== creatures.length || creatures.some((row) => !/^pet_\d+$/.test(row.sourceId))) throw new Error('Invalid or duplicate creature source IDs')
  const breedingNames = new Set(breeding.map((row) => row.name))
  if (creatures.length !== breeding.length || creatures.some((row) => !breedingNames.has(row.name))) throw new Error('Creature/breeding lists differ')
  const details = []
  const missing = []
  const failures = []
  const skillNames = new Set(skills.map((row) => row.name))
  for (const creature of creatures) {
    let record
    try { record = await readSnapshot(directory, creature.sourceId, creature.detailUrl, version) } catch (error) {
      if (error.code !== 'ENOENT') { failures.push({ name: creature.name, reason: error.message }); continue }
      if (fetched < limit && !offline && !stopped) { record = await snapshot(creature.sourceId, creature.detailUrl); fetched++ }
    }
    if (!record) { missing.push({ name: creature.name, url: creature.detailUrl, sourceId: creature.sourceId }); continue }
    try {
      const row = parseNrcDetail(record.html, creature)
      if (row.skills.some((skill) => !skillNames.has(skill.name))) throw new Error('Detail references skills absent from aggregate')
      const { html: _, ...sourceRecord } = record
      row.provenance = sourceRecord
      details.push(row)
      Object.assign(creature, row.stats, { traitName: row.trait.name })
    } catch (error) { failures.push({ name: creature.name, reason: error.message }) }
    if (details.length % 25 === 0) console.log(`NRC details: ${details.length}/${creatures.length}; requests ${fetched}`)
  }
  const syncedAt = new Date().toISOString()
  const unresolved = [
    ...missing.map((row) => `缺少详情：${row.name}`), ...failures.map((row) => `${row.name}：${row.reason}`),
    '技能来源 level / machine / blood 与正式引用口径待审阅',
    '改名、编号及异色撤销冲突待审阅；未确认前禁止发布',
  ]
  const wrapper = (rows, extra = {}) => ({ source: 'bwiki-nrc', version, syncedAt, attribution: SOURCE_NOTICES.nrc, modifications: '解析为结构化记录；名称与数值保留源页面内容；未发现蛋组映射为无法孵蛋。', provenance, rowCount: rows.length, rows, ...extra })
  await writeJsonAtomic(paths.staging.creatures, wrapper(creatures, { releaseBlockers: unresolved }))
  await writeJsonAtomic(paths.staging.skills, wrapper(skills, { releaseBlockers: unresolved }))
  await writeJsonAtomic(paths.staging.breeding, wrapper(breeding))
  await writeJsonAtomic(paths.staging.details, wrapper(details, { errorCount: missing.length + failures.length, missing, failures }))
  await writeJsonAtomic(paths.artifacts.stagingJson, { version, syncedAt, creatures: creatures.length, skills: skills.length, details: details.length, stopped, missing, failures, releaseBlockers: unresolved })
  console.log(`NRC staging: ${creatures.length} creatures, ${skills.length} skills, ${details.length} details; ${missing.length} missing, ${failures.length} invalid. ${stopped}`)
  if (missing.length || failures.length || stopped) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
