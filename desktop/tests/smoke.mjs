import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { isolatedEnvironment } from './environment.mjs'
import { openPackaged, addCreature, exportJson, importJson, ownedRows } from './helpers.mjs'
import { ROCK_SCANNER_CROP_PROFILE } from '../../src/domain/rockKingdomScanner.js'

assert.equal(process.platform, 'win32')
const identity = JSON.parse(await fs.readFile('desktop/config.json', 'utf8'))
const executable = path.resolve(process.argv[2] || 'artifacts/desktop/release/win-unpacked/TangerineTools.exe')
assert.ok(executable.startsWith(path.resolve('artifacts/desktop/release') + path.sep))
const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'tangerine-desktop-'))
const env = await isolatedEnvironment(root)
const checks = []
function record(message) { checks.push(message); console.log(message) }
let app
let corsServer
try {
  let opened = await openPackaged(executable, env, identity)
  app = opened.application
  let page = opened.page
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const [key, expected] of Object.entries({ sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false })) assert.equal(opened.runtime.preferences[key], expected, key)
  assert.deepEqual(await page.evaluate(() => [typeof window.require, typeof window.process, typeof window.electron]), ['undefined', 'undefined', 'undefined'])
  record('packaged app starts with isolated storage, sandbox, context isolation and no renderer Node/IPC bridge')

  const files = await app.evaluate(async ({ app }) => {
    const fs = process.getBuiltinModule('fs/promises')
    const path = process.getBuiltinModule('path')
    const crypto = process.getBuiltinModule('crypto')
    const directory = app.getAppPath()
    const info = JSON.parse(await fs.readFile(path.join(directory, 'build-info.json'), 'utf8'))
    for (const entry of info.files) {
      const bytes = await fs.readFile(path.join(directory, entry.file))
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Packaged content mismatch: ' + entry.file)
    }
    return { info, root: await fs.readdir(directory), dist: await fs.readdir(path.join(directory, 'dist')) }
  })
  assert.ok(!files.root.includes('node_modules'))
  for (const name of ['artifacts', 'scripts', 'docs', '.env', '.git']) assert.ok(!files.root.includes(name))
  assert.ok(!files.dist.includes('sw.js'))
  for (const file of ['LICENSE', 'COPYRIGHT', 'THIRD_PARTY_NOTICES.txt']) assert.ok(files.root.includes(file))
  assert.equal(await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 0
    try { return (await navigator.serviceWorker.getRegistrations()).length } catch (error) {
      if (['InvalidStateError', 'SecurityError'].includes(error.name)) return 0
      throw error
    }
  }), 0)
  record('package manifest hashes match actual files; private/dev files and web service worker absent; licenses included')

  const responses = await page.evaluate(async () => Promise.all(['LICENSE', 'COPYRIGHT', 'THIRD_PARTY_NOTICES.txt', 'ocr-runtime/tesseract-core-lstm.wasm', 'reader-ocr/eng.traineddata.gz', 'desktop/main.mjs', '../package.json', 'sw.js'].map(async resource => {
    const response = await fetch(new URL(resource, document.baseURI))
    return { resource, status: response.status, type: response.headers.get('content-type') }
  })))
  assert.ok(responses.slice(0, 5).every(response => response.status === 200))
  assert.equal(responses[3].type, 'application/wasm')
  assert.ok(responses.slice(5).every(response => response.status === 404))
  assert.ok(await page.evaluate(async () => { const image = new Image(); image.src = 'icons/tangerine-tools-192.png'; await image.decode(); return image.naturalWidth === 192 }))
  record('custom protocol serves JavaScript/JSON/images/OCR/WASM with correct MIME and denies non-public paths')

  await app.evaluate(({ dialog, shell }) => {
    globalThis.originalTestDialog = dialog.showMessageBox
    globalThis.originalTestOpenExternal = shell.openExternal
    globalThis.testExternalUrls = []
    globalThis.testExternalPrompts = []
    dialog.showMessageBox = async (_window, options) => {
      globalThis.testExternalPrompts.push(options.message)
      return { response: options.message.includes('本机模型') ? 1 : 0 }
    }
    shell.openExternal = async url => { globalThis.testExternalUrls.push(url) }
  })
  for (const url of ['file:///forbidden', 'ms-settings:test', 'https://example.test/']) {
    await page.evaluate(url => { window.open(url) }, url)
  }
  assert.deepEqual(await app.evaluate(() => globalThis.testExternalUrls), [])
  assert.ok((await app.evaluate(() => globalThis.testExternalPrompts)).includes('在系统浏览器中打开链接？'))
  assert.equal(await page.evaluate(() => {
    window.cspProbe = 0
    const script = document.createElement('script'); script.textContent = 'window.cspProbe = 1'; document.head.appendChild(script)
    return window.cspProbe
  }), 0)
  await page.evaluate(() => { window.location.href = 'app://rock-kingdom/desktop/main.mjs' })
  assert.ok(page.url().startsWith('app://rock-kingdom/index.html'))
  corsServer = createServer((request, response) => {
    if (request.url === '/allowed') response.setHeader('Access-Control-Allow-Origin', 'app://rock-kingdom')
    response.setHeader('Content-Type', 'application/json')
    response.end('{"fixture":true}')
  })
  await new Promise(resolve => corsServer.listen(0, '127.0.0.1', resolve))
  const corsBase = `http://127.0.0.1:${corsServer.address().port}`
  const cors = await page.evaluate(async base => {
    const allowed = await fetch(base + '/allowed').then(response => response.json())
    const denied = await fetch(base + '/denied').then(() => false, () => true)
    const fileDenied = await fetch('file:///forbidden').then(() => false, () => true)
    return { allowed, denied, fileDenied }
  }, corsBase)
  assert.deepEqual(cors, { allowed: { fixture: true }, denied: true, fileDenied: true })
  await new Promise(resolve => corsServer.close(resolve)); corsServer = undefined
  await app.evaluate(({ dialog, shell }) => { dialog.showMessageBox = globalThis.originalTestDialog; shell.openExternal = globalThis.originalTestOpenExternal })
  record('live CSP, navigation and external protocol protection hold; localhost model fetch obeys CORS and file access is denied')
  // A deliberately cancelled native navigation can leave Playwright's navigation waiter pending.
  await app.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows()[0].loadURL(url), `app://${identity.host}/index.html`)
  await page.getByRole('button', { name: '洛克王国', exact: true }).waitFor()

  await addCreature(page)
  await addCreature(page, 'bold', 'colorful')
  assert.match(await page.locator('.data-grid').innerText(), /普通个体仅作备选/)
  await page.getByRole('button', { name: '孵蛋推荐', exact: true }).click()
  await page.locator('.breeding-pair-card').first().waitFor()
  await page.getByRole('button', { name: '性格推荐', exact: true }).click()
  await page.getByRole('combobox').fill('火神')
  await page.getByRole('option').filter({ hasText: '火神' }).first().click()
  await page.locator('.nature-candidate').filter({ hasText: '固执' }).click()
  assert.match(await page.locator('.nature-retention-card').innerText(), /银镜可修/)
  record('bundled presets, lazy collection/nature/breeding modules and real record forms complete core workflow')

  await page.getByRole('button', { name: '模型设置' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('模型供应商').selectOption('custom')
  await dialog.getByLabel('Chat Completions 兼容地址').fill('https://example.test/chat/completions')
  await dialog.getByLabel('模型 ID', { exact: true }).fill('desktop-test-model')
  await dialog.getByLabel('API Key', { exact: true }).fill('desktop-test-only-key')
  await dialog.getByRole('button', { name: '保存配置' }).click()
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  assert.equal(await page.evaluate(() => sessionStorage.getItem('rockKingdomModelApiKey:custom')), 'desktop-test-only-key')

  await page.getByRole('button', { name: '收集记录', exact: true }).click()
  await page.getByRole('button', { name: '扫描录入', exact: true }).click()
  dialog = page.getByRole('dialog')
  const synthetic = await page.evaluate(profile => {
    const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 1440
    const context = canvas.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'black'; context.font = '48px sans-serif'; context.textBaseline = 'top'
    for (const [key, text] of [['name', '火神'], ['nature', '固执'], ['bloodline', '火'], ['specialty', '无']]) {
      const crop = profile[key]; context.fillText(text, crop.x * canvas.width + 5, crop.y * canvas.height + 5)
    }
    return canvas.toDataURL('image/png').split(',')[1]
  }, ROCK_SCANNER_CROP_PROFILE)
  await dialog.locator('input[accept="image/*"]').setInputFiles({ name: 'synthetic-creature.png', mimeType: 'image/png', buffer: Buffer.from(synthetic, 'base64') })
  await dialog.getByRole('button', { name: '识别当前画面', exact: true }).click()
  await dialog.getByText(/识别完成，用时/).waitFor({ timeout: 120000 })
  await dialog.getByRole('button', { name: '关闭', exact: true }).last().click()
  record('file selection, blob image and actual local OCR worker/WASM recognize synthetic input without saving media')

  const backup = await exportJson(app, page, path.join(root, 'backup.json'))
  assert.equal(ownedRows(backup).length, 2)
  assert.ok(!JSON.stringify(backup).includes('desktop-test-only-key'))
  const partial = { schemaVersion: 1, data: { catalogRows: [{ ...ownedRows(backup)[0], values: { ...ownedRows(backup)[0].values, desktopTestMarker: 'merged' } }] } }
  await importJson(page, partial, false)
  assert.deepEqual(ownedRows(await exportJson(app, page, path.join(root, 'cancelled.json'))), ownedRows(backup))
  await importJson(page, partial)
  const merged = ownedRows(await exportJson(app, page, path.join(root, 'merged.json')))
  assert.equal(merged.length, 2)
  assert.equal(merged.find(row => row.id === partial.data.catalogRows[0].id).values.desktopTestMarker, 'merged')
  assert.deepEqual(merged.find(row => row.id !== partial.data.catalogRows[0].id), ownedRows(backup).find(row => row.id !== partial.data.catalogRows[0].id))
  record('JSON export excludes API key; cancel is read-only; confirmed partial merge overwrites same ID and retains omitted records')
  assert.deepEqual(errors, [])
  await app.close(); app = undefined
  opened = await openPackaged(executable, env, identity); app = opened.application; page = opened.page
  assert.deepEqual(ownedRows(await exportJson(app, page, path.join(root, 'reopened.json'))), merged)
  assert.equal(await page.evaluate(() => sessionStorage.getItem('rockKingdomModelApiKey:custom')), null)
  assert.match(await page.evaluate(() => JSON.stringify(localStorage)), /desktop-test-model/)
  record('exit and reopen preserve database and non-secret settings; API key does not survive the session')
  await app.close(); app = undefined
  const cleanRoot = path.join(root, 'restore')
  const cleanEnv = await isolatedEnvironment(cleanRoot)
  opened = await openPackaged(executable, cleanEnv, identity); app = opened.application; page = opened.page
  assert.equal(ownedRows(await exportJson(app, page, path.join(root, 'empty.json'))).length, 0)
  await importJson(page, backup)
  assert.deepEqual(ownedRows(await exportJson(app, page, path.join(root, 'restored.json'))), ownedRows(backup))
  record('fresh isolated profile restores the existing JSON format with stable IDs')
  await fs.mkdir('artifacts/desktop/test-results', { recursive: true })
  await fs.writeFile('artifacts/desktop/test-results/packaged.json', JSON.stringify({ passed: true, version: files.info.version, build: files.info, executableSha256: createHash('sha256').update(await fs.readFile(executable)).digest('hex'), checks, limitation: 'Packaged production identity under temporary profiles; no production installer or clean Windows manual acceptance.' }, null, 2))
  console.log(`Packaged desktop passed ${checks.length} verification groups.`)
} finally { await app?.close(); if (corsServer) await new Promise(resolve => corsServer.close(resolve)) }
