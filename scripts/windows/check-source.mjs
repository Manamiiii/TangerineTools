import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile, rename, lstat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { identityPath, sourceIdentity } from '../vite/source-identity.mjs'

const acceptanceFile = root => path.join(root, '.local/source-entry.json')
export async function expectedSource(root) {
  const expected = await sourceIdentity(root)
  let accepted
  try { accepted = JSON.parse(await readFile(acceptanceFile(root), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (accepted !== undefined) {
    assert.ok(accepted && typeof accepted === 'object', 'Invalid local acceptance record; preserve it for diagnosis.')
    assert.equal(accepted.schemaVersion, 1, 'Unrecognized local acceptance record; preserve it for diagnosis.')
    assert.equal(accepted.project, expected.project, 'Local acceptance record belongs to another application.')
    assert.equal(accepted.rootId, expected.rootId, 'Local acceptance record belongs to another checkout.')
    assert.equal(accepted.fingerprint, expected.fingerprint, 'Source has unaccepted changes. Complete checks and record the delivery before using the desktop entry.')
  }
  return { ...expected, acceptanceRevision: accepted?.revision ?? null }
}

export async function recordSource(root) {
  const expected = await sourceIdentity(root)
  assert.ok(expected.revision, 'Recording a delivery requires a Git checkout.')
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), '', 'Commit verified changes before recording a desktop delivery.')
  const file = acceptanceFile(root)
  for (const target of [path.dirname(file), file]) {
    try { assert.equal((await lstat(target)).isSymbolicLink(), false, 'Acceptance record cannot follow a link.') } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  try {
    const previous = JSON.parse(await readFile(file, 'utf8'))
    assert.ok(previous.schemaVersion === 1 && previous.project === expected.project, 'Preserve the unknown local file before recording a delivery.')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = file + '.' + randomUUID() + '.tmp'
  const record = { schemaVersion: 1, ...expected, recordedAt: new Date().toISOString() }
  await writeFile(temporary, JSON.stringify(record, null, 2), { flag: 'wx' })
  await rename(temporary, file)
  return record
}

export async function checkSource(root, origin = 'http://localhost:5188') {
  const target = new URL(origin)
  assert.ok(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash, 'Source checks only accept a loopback HTTP origin.')
  const expected = await expectedSource(root)
  async function get(resource) {
    const response = await fetch(new URL(resource, target), { signal: AbortSignal.timeout(2500), cache: 'no-store', redirect: 'error' })
    assert.ok(response.ok, `Source check failed for ${resource}; no service was stopped or replaced.`)
    return response
  }
  const response = await get(identityPath)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  const service = await response.json()
  assert.equal(service.schemaVersion, 1, 'Unrecognized source service.')
  assert.equal(service.mode, 'source', 'This is not the source entry.')
  for (const identity of [service.startup, service.current]) {
    assert.equal(identity?.project, expected.project, 'A different application occupies the port.')
    assert.equal(identity?.rootId, expected.rootId, 'Service belongs to another checkout. Preserve it and resolve the port conflict.')
    assert.equal(identity?.fingerprint, expected.fingerprint, 'Service/source changed since startup. Save current work before a safe restart; no automatic restart was performed.')
  }
  const html = await (await get('/')).text()
  assert.ok(html.includes(`name="tangerine-source-fingerprint" content="${expected.fingerprint}"`), 'HTML does not match the verified source service.')
  assert.ok(html.includes('/@vite/client') && html.includes('/src/main.jsx'), 'The entry is not the expected Vite source page.')
  const raw = await (await get('/src/main.jsx?raw')).text()
  const source = await readFile(path.join(root, 'src/main.jsx'), 'utf8')
  assert.ok(raw.includes(JSON.stringify(source)), 'The served entry module does not match this checkout.')
  assert.equal((await sourceIdentity(root)).fingerprint, expected.fingerprint, 'Source changed during verification; retry after development finishes.')
  return { verified: true, origin: target.origin, ...expected, servicePid: service.pid, serviceStartedAt: service.startedAt, serviceStartupRevision: service.startup.revision, browserSessionVerified: false }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '../..')
  try {
    const mode = process.argv[2]
    assert.ok(!mode || ['--record', '--expected'].includes(mode), 'Unknown source-entry option.')
    console.log(JSON.stringify(mode === '--record' ? await recordSource(root) : mode === '--expected' ? await expectedSource(root) : await checkSource(root), null, 2))
  }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
