import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { sourceIdentity, sourceIdentityPlugin, identityPath } from '../vite/source-identity.mjs'
import { checkSource, expectedSource, recordSource } from '../windows/check-source.mjs'

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), 'tangerine-source-'))
  for (const folder of ['src', 'public', 'scripts/vite', 'scripts/windows']) await mkdir(path.join(root, folder), { recursive: true })
  for (const name of ['package.json', 'package-lock.json']) await writeFile(path.join(root, name), JSON.stringify({ name: 'tangerine-source-fixture', version: '0.1.1', type: 'module' }))
  for (const name of ['LICENSE', 'COPYRIGHT', 'vite.config.js', 'TangerineTools.vbs']) await writeFile(path.join(root, name), '// fictional fixture')
  await writeFile(path.join(root, 'src/main.jsx'), 'console.log("fictional entry")')
  await writeFile(path.join(root, 'index.html'), '<!doctype html><html><head><title>TangerineTools fixture</title></head><body><script type="module" src="/src/main.jsx"></script></body></html>')
  return root
}

test('source entry proves checkout and loaded entry; changed inputs, different root and restart are distinguished', { timeout: 30000 }, async () => {
  const root = await fixture()
  const other = await fixture()
  let server
  async function start() {
    server = await createServer({ root, configFile: false, plugins: [sourceIdentityPlugin()], server: { host: '127.0.0.1', port: 0, open: false }, optimizeDeps: { noDiscovery: true } })
    await server.listen()
    return `http://127.0.0.1:${server.httpServer.address().port}`
  }
  try {
    let origin = await start()
    const checked = await checkSource(root, origin)
    assert.equal(checked.verified, true)
    assert.equal(checked.browserSessionVerified, false)
    const response = await fetch(origin + identityPath)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
    const raw = await response.text()
    assert.ok(!raw.includes(root) && !raw.includes(os.homedir()))
    assert.equal((await fetch(origin + identityPath, { method: 'POST' })).status, 405)
    assert.equal((await fetch(origin + identityPath, { headers: { Origin: 'https://foreign.example' } })).status, 403)
    await assert.rejects(checkSource(other, origin), /another checkout/)
    await writeFile(path.join(root, 'src/main.jsx'), 'console.log("modified fictional entry")')
    await assert.rejects(checkSource(root, origin), /changed since startup/)
    // Closing this test-owned service is safe; the production checker never does so.
    await server.close()
    origin = await start()
    const refreshed = await checkSource(root, origin)
    assert.notEqual(refreshed.fingerprint, checked.fingerprint)
    assert.equal(refreshed.fingerprint, (await sourceIdentity(root)).fingerprint)
    await mkdir(path.join(root, 'artifacts'), { recursive: true })
    await writeFile(path.join(root, 'artifacts/ignored.txt'), 'not a runtime input')
    assert.equal((await checkSource(root, origin)).fingerprint, refreshed.fingerprint)
    await mkdir(path.join(root, '.local'))
    await writeFile(path.join(root, '.local/source-entry.json'), JSON.stringify({ schemaVersion: 1, ...(await sourceIdentity(root)) }))
    assert.equal((await expectedSource(root)).fingerprint, refreshed.fingerprint)
    await writeFile(path.join(root, 'public/unaccepted.txt'), 'unfinished development')
    await assert.rejects(expectedSource(root), /unaccepted changes/)
    await writeFile(path.join(root, '.local/source-entry.json'), '{broken')
    await assert.rejects(expectedSource(root), /JSON|Unexpected|Expected/)
    await writeFile(path.join(root, '.local/source-entry.json'), 'null')
    await assert.rejects(expectedSource(root), /Invalid local acceptance/)
  } finally {
    await server?.close()
    for (const directory of [root, other]) { assert.equal(path.dirname(directory), await realpath(os.tmpdir())); await rm(directory, { recursive: true, force: true }) }
  }
})

test('recording desktop acceptance requires a clean committed checkout and preserves unknown local records', async () => {
  const root = await fixture()
  const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=unused-fixture-hooks', '-c', 'commit.gpgSign=false', '-c', 'user.name=Source fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  try {
    git('init')
    await writeFile(path.join(root, '.gitignore'), '.local/\n')
    git('add', '.')
    git('commit', '-m', 'Synthetic source fixture')
    const accepted = await recordSource(root)
    assert.equal(accepted.revision, git('rev-parse', 'HEAD').trim())
    assert.equal((await expectedSource(root)).acceptanceRevision, accepted.revision)
    await writeFile(path.join(root, 'src/main.jsx'), 'unfinished changes')
    await assert.rejects(recordSource(root), /Commit verified changes/)
    assert.equal(JSON.parse(await readFile(path.join(root, '.local/source-entry.json'), 'utf8')).fingerprint, accepted.fingerprint)
    git('add', '.')
    git('commit', '-m', 'Synthetic changed source')
    await writeFile(path.join(root, '.local/source-entry.json'), '{"schemaVersion":1,"project":"Other"}')
    await assert.rejects(recordSource(root), /unknown local file/)
    assert.equal(JSON.parse(await readFile(path.join(root, '.local/source-entry.json'), 'utf8')).project, 'Other')
  } finally {
    assert.equal(path.dirname(root), await realpath(os.tmpdir()))
    await rm(root, { recursive: true, force: true })
  }
})

test('HTTP source worker does not cache runtime responses; package/web worker eligibility is preserved', async () => {
  const worker = await readFile('public/sw.js', 'utf8')
  assert.match(worker, /const ENABLE_RUNTIME_CACHE = self.location.protocol === 'https:'/)
  assert.match(worker, /if \(!ENABLE_RUNTIME_CACHE \|\| event.request.method !== 'GET'\) return/)
  await assert.rejects(checkSource(process.cwd(), 'https://example.com'), /loopback HTTP/)
})
