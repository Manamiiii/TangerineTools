import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, realpath, lstat } from 'node:fs/promises'
import path from 'node:path'

export const identityPath = '/__tangerine_source'
const inputs = ['src', 'public', 'scripts/vite', 'scripts/windows', 'TangerineTools.vbs', 'vite.config.js', 'index.html', 'package.json', 'package-lock.json', 'LICENSE', 'COPYRIGHT']
const sha256 = value => createHash('sha256').update(value).digest('hex')

// Hash runtime inputs, not personal data, ignored reports or machine paths.
export async function sourceIdentity(root) {
  const canonical = await realpath(root)
  const hash = createHash('sha256')
  async function visit(relative) {
    const full = path.join(canonical, relative)
    const entries = await readdir(full, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const name = `${relative}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error('Source identity does not accept linked runtime inputs.')
      if (entry.isDirectory()) await visit(name)
      else { hash.update(name + '\0'); hash.update(await readFile(path.join(canonical, name))); hash.update('\0') }
    }
  }
  for (const name of inputs) {
    if ((await lstat(path.join(canonical, name))).isSymbolicLink()) throw new Error('Source identity does not accept linked runtime inputs.')
    if (['src', 'public', 'scripts/vite', 'scripts/windows'].includes(name)) await visit(name)
    else { hash.update(name + '\0'); hash.update(await readFile(path.join(canonical, name))); hash.update('\0') }
  }
  let revision = null
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: canonical, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim() } catch { /* Source ZIPs have no Git metadata. */ }
  const manifest = JSON.parse(await readFile(path.join(canonical, 'package.json'), 'utf8'))
  return { project: 'TangerineTools', version: manifest.version, revision, rootId: sha256(process.platform === 'win32' ? canonical.toLowerCase() : canonical), fingerprint: hash.digest('hex') }
}

export function sourceIdentityPlugin() {
  let root
  let startup
  let startedAt
  return {
    name: 'tangerine-source-identity', apply: 'serve',
    configResolved(config) { root = config.root },
    async configureServer(server) {
      startup = await sourceIdentity(root)
      startedAt = new Date().toISOString()
      server.middlewares.use(async (req, res, next) => {
        if (new URL(req.url, 'http://localhost').pathname !== identityPath) return next()
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        const remote = req.socket.remoteAddress
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
          || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) { res.statusCode = 403; res.end('{}'); return }
        if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return }
        try { res.end(JSON.stringify({ schemaVersion: 1, mode: 'source', pid: process.pid, startedAt, startup, current: await sourceIdentity(root) })) }
        catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Source identity unavailable; preserve the running service.' })) }
      })
    },
    transformIndexHtml() {
      return startup ? [{ tag: 'meta', attrs: { name: 'tangerine-source-fingerprint', content: startup.fingerprint }, injectTo: 'head' }] : []
    },
  }
}
