import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
function snapshotPath(directory, key) {
  if (!/^[\w-]+$/.test(key)) throw new Error('Invalid snapshot key')
  return resolve(directory, `${key}.json`)
}
export async function writeJsonAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, file)
}
export async function readSnapshot(directory, key, sourceUrl, version) {
  const record = JSON.parse(await readFile(snapshotPath(directory, key), 'utf8'))
  if (record.version !== version || record.sourceUrl !== sourceUrl || !record.capturedAt || record.sha256 !== sha256(record.html)) throw new Error(`Invalid/stale snapshot: ${key}`)
  return record
}
export async function saveSnapshot(directory, key, { sourceUrl, version, html, capturedAt = new Date().toISOString(), method = 'http' }) {
  const record = { sourceUrl, version, capturedAt, method, sha256: sha256(html), html }
  await writeJsonAtomic(snapshotPath(directory, key), record)
  return record
}
// No alternate client, proxy, authentication or anti-bot retry fallback.
export async function fetchSnapshot(directory, key, sourceUrl, version, fetcher = fetch) {
  const parsed = new URL(sourceUrl)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'wiki.biligame.com' || !parsed.pathname.startsWith('/nrc/')) throw new Error('Unexpected NRC source URL')
  const response = await fetcher(sourceUrl, { signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'TangerineTools personal data maintenance' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}: stopped; keep existing snapshots`)
  const html = await response.text()
  if (!html.includes('mw-content-text') && !html.includes('roco-dex')) throw new Error('Not a Wiki content page; stopped')
  return saveSnapshot(directory, key, { sourceUrl, version, html })
}
