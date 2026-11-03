import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assetPath, createAssetHandler, externalUrl, downloadAllowed, permissionAllowed, navigationAllowed, mimeType, WINDOW_PREFERENCES } from '../../desktop/security.mjs'
import { canRegisterWebServiceWorker } from '../../src/serviceWorker.js'

const host = 'rock-kingdom'
test('desktop resources cannot escape the bundled frontend or expose arbitrary files', () => {
  const root = path.resolve('dist')
  assert.equal(assetPath(root, `app://${host}/`, host), path.join(root, 'index.html'))
  assert.equal(assetPath(root, `app://${host}/assets/module.js`, host), path.join(root, 'assets/module.js'))
  for (const url of [
    `app://${host}/../package.json`, `app://${host}/assets/%2e%2e/index.html`, `app://${host}/assets/..%2fsecret.json`,
    `app://${host}/assets/%252e%252e/secret.json`, `app://${host}/assets/a%5cb.js`, `app://${host}/assets/a%00.js`,
    `app://${host}/assets/a:stream.js`, `app://${host}/assets/%zz`, `app://${host}/desktop/main.mjs`,
    `app://${host}/sw.js`, `app://${host}/package.json`, 'app://foreign/index.html', `app://user@${host}/index.html`,
    `app://${host}:80/index.html`, 'file:///index.html', 'invalid',
  ]) assert.equal(assetPath(root, url, host), null, url)
})

test('desktop navigation, permissions and downloads have narrow origin boundaries', () => {
  assert.ok(navigationAllowed(`app://${host}/index.html#scene=test`, host))
  assert.equal(navigationAllowed(`app://${host}/assets/injected.svg`, host), false)
  for (const value of ['file:///secret', 'javascript:alert(1)', 'ms-settings:test', 'data:text/html,test', 'http://example.test', 'https://user:password@example.test', 'https://example.test/\n']) assert.equal(externalUrl(value), null)
  assert.equal(externalUrl('https://example.test/path?q=1'), 'https://example.test/path?q=1')
  const blob = `blob:app://${host}/00000000-0000-4000-8000-000000000000`
  assert.ok(downloadAllowed(blob, 'backup.json', host))
  for (const [url, file] of [[blob, '../backup.json'], [blob, 'script.exe'], [blob.replace(host, host + '.evil'), 'backup.json'], ['https://example.test/a.json', 'a.json']]) assert.equal(downloadAllowed(url, file, host), false)
  assert.ok(permissionAllowed('persistent-storage', `app://${host}/index.html`, `app://${host}`, host))
  for (const permission of ['media', 'clipboard-read', 'clipboard-sanitized-write', 'fileSystem', 'geolocation', 'notifications', 'openExternal']) assert.equal(permissionAllowed(permission, `app://${host}/index.html`, `app://${host}`, host), false)
  assert.equal(permissionAllowed('persistent-storage', `app://${host}/index.html`, 'https://foreign.test', host), false)
  assert.equal(permissionAllowed('persistent-storage', `app://${host}/index.html`, `app://${host}`, host, false), false)
  assert.equal(permissionAllowed('loopback-network', `app://${host}/index.html`, `app://${host}`, host), false)
  assert.ok(permissionAllowed('loopback-network', `app://${host}/index.html`, `app://${host}`, host, true, true))
  assert.equal(permissionAllowed('loopback-network', `app://${host}/index.html`, 'https://foreign.test', host, true, true), false)
  assert.equal(WINDOW_PREFERENCES.sandbox, true)
  assert.equal(WINDOW_PREFERENCES.contextIsolation, true)
  assert.equal(WINDOW_PREFERENCES.webSecurity, true)
  assert.equal(WINDOW_PREFERENCES.nodeIntegration, false)
})

test('resource handler enforces methods, MIME, origin, missing files and symlink boundaries', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tangerine-protocol-'))
  const root = path.join(directory, 'dist')
  try {
    await mkdir(path.join(root, 'assets'), { recursive: true })
    await writeFile(path.join(root, 'assets/module.js'), 'export const answer = 42')
    await writeFile(path.join(root, 'assets/module.wasm'), Buffer.from([0, 97, 115, 109]))
    const outside = path.join(directory, 'private')
    await mkdir(outside)
    await writeFile(path.join(outside, 'private.json'), '{"private":true}')
    await symlink(outside, path.join(root, 'assets/escape'), process.platform === 'win32' ? 'junction' : 'dir')
    let reads = 0
    const handle = createAssetHandler(root, host, async target => { reads++; return new Response(await readFile(target)) })
    const resource = `app://${host}/assets/module.js`
    const response = await handle(new Request(resource))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /javascript/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.match(response.headers.get('content-security-policy'), /object-src 'none'/)
    assert.equal(await response.text(), 'export const answer = 42')
    assert.equal(await (await handle(new Request(resource, { method: 'HEAD' }))).text(), '')
    assert.equal((await handle(new Request(resource, { method: 'POST' }))).status, 405)
    assert.equal((await handle(new Request(resource, { headers: { origin: 'https://foreign.test' } }))).status, 403)
    assert.equal((await handle(new Request(`app://${host}/assets/escape/private.json`))).status, 404)
    assert.equal((await handle(new Request(`app://${host}/assets/missing.js`))).status, 404)
    assert.equal(reads, 2)
    assert.equal(mimeType('module.wasm'), 'application/wasm')
    assert.equal(mimeType('eng.traineddata.gz'), 'application/octet-stream')
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()))
    await rm(directory, { recursive: true, force: true })
  }
})

test('web service worker remains enabled for websites and excluded from packaged app', () => {
  assert.ok(canRegisterWebServiceWorker('https:'))
  assert.ok(canRegisterWebServiceWorker('http:'))
  assert.equal(canRegisterWebServiceWorker('app:'), false)
  assert.equal(canRegisterWebServiceWorker('file:'), false)
})
