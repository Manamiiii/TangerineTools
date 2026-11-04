import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fixture } from '../fixture.mjs'
import { isolatedEnvironment } from './environment.mjs'
import { openPackaged, addCreature, exportJson, ownedRows } from './helpers.mjs'

assert.equal(process.platform, 'win32')
const manifest = JSON.parse(await fs.readFile('package.json', 'utf8'))
const production = process.argv.includes('--production')
const identity = production ? JSON.parse(await fs.readFile('desktop/config.json', 'utf8')) : fixture
const base = path.resolve('artifacts/desktop/installer-acceptance')
const candidate = production ? path.resolve(`artifacts/desktop/release/TangerineTools-${manifest.version}-win-x64-Setup.exe`) : path.join(base, 'current', `TangerineTools-${manifest.version}-win-x64-Setup.exe`)
const previous = production ? candidate : path.join(base, 'previous/TangerineTools-0.0.9-win-x64-Setup.exe')
for (const file of [candidate, previous]) await fs.access(file)
const run = promisify(execFile)
const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
const ps = async script => (await run(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n" + script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 30000 })).stdout.trim()
const registryScript = `@('HKCU','HKLM') | ForEach-Object {
  $hive = $_
  @('Software\\${identity.installerGuid}', 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${identity.installerGuid}', 'Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${identity.installerGuid}') | ForEach-Object {
    if (Test-Path -LiteralPath ($hive + ':\\' + $_)) { Write-Output 'present' }
  }
}`
assert.equal(await ps(registryScript), '', 'An existing acceptance installation must not be overwritten.')
const active = await ps(`Get-CimInstance Win32_Process -Filter "Name = '${identity.executableName}.exe'" -ErrorAction Stop | ForEach-Object { 'active' }`)
assert.equal(active, '', 'A running application must be preserved.')
const hostShortcut = await ps(`[IO.Path]::Combine([Environment]::GetFolderPath('Programs'), '${identity.productName}.lnk')`)
const exists = file => fs.stat(file).then(() => true, () => false)
assert.equal(await exists(hostShortcut), false, 'Existing shortcut must be preserved.')
const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'tangerine-installer-'))
const env = await isolatedEnvironment(root)
const programs = path.join(env.LOCALAPPDATA, 'Programs')
const family = path.join(programs, 'Tangerine')
const standard = path.join(family, identity.executableName)
const legacy = path.join(programs, identity.executableName)
let installed = production ? standard : legacy
const sibling = path.join(family, 'SiblingFixture', 'keep.txt')
await fs.mkdir(path.dirname(sibling), { recursive: true })
await fs.writeFile(sibling, 'retain', { flag: 'wx' })
const isolatedShortcut = path.join(env.APPDATA, 'Microsoft/Windows/Start Menu/Programs', `${identity.productName}.lnk`)
const shortcuts = [...new Set([hostShortcut, isolatedShortcut])]
for (const file of shortcuts) assert.equal(await exists(file), false)
const executable = () => path.join(installed, `${identity.executableName}.exe`)
const uninstaller = () => path.join(installed, `Uninstall ${identity.executableName}.exe`)
let app
let installedByTest = false
const checks = []
async function setup(file, initialLegacy = false) {
  assert.ok([candidate, previous].includes(file))
  assert.ok([legacy, standard].includes(installed) && installed.startsWith(root + path.sep))
  // NSIS requires /D to be the final argument, without embedded quote characters.
  const args = ['/S', '/currentuser']
  if (initialLegacy) args.push(`/D=${legacy}`)
  await run(file, args, { env, windowsVerbatimArguments: true, windowsHide: true, timeout: 180000 })
  installedByTest = true
  await fs.access(executable())
  const location = await ps(`(Get-ItemProperty -LiteralPath 'HKCU:/Software/${identity.installerGuid}' -ErrorAction Stop).InstallLocation`)
  assert.equal(path.normalize(location), installed)
}
async function remove() {
  assert.equal(path.dirname(uninstaller()), installed)
  assert.ok([legacy, standard].includes(installed) && installed.startsWith(root + path.sep))
  await run(uninstaller(), ['/S', '/currentuser', `_?=${installed}`], { env, windowsVerbatimArguments: true, windowsHide: true, timeout: 180000 })
  installedByTest = false
  assert.equal(await exists(executable()), false)
  assert.equal(await ps(registryScript), '')
  // _?= runs the uninstaller in place. Its own stub can only be removed after exit.
  await fs.rm(uninstaller(), { force: true })
  if (await exists(installed)) await fs.rmdir(installed)
}
async function close() { if (app) { await app.close(); app = undefined } }
async function open() { const result = await openPackaged(executable(), env, identity); app = result.application; return result }
async function dataFiles() {
  const directory = path.join(env.APPDATA, identity.dataDirectory)
  const results = []
  async function walk(folder) {
    for (const item of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name)
      if (item.isDirectory()) await walk(file)
      else results.push([file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])
    }
  }
  // Persistent business storage only; Chromium lock/log bookkeeping can legitimately change.
  for (const name of ['IndexedDB', 'Local Storage']) if (await exists(path.join(directory, name))) await walk(path.join(directory, name))
  assert.ok(results.length)
  return results
}
async function preserved(files) {
  for (const [file, digest] of files) assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'), digest, 'Installer changed persistent data')
}
try {
  await assert.rejects(run(candidate, ['/S', '/currentuser', `/D=${family}`], { env, windowsHide: true, windowsVerbatimArguments: true, timeout: 30000 }), error => error.code === 3)
  assert.equal(await fs.readFile(sibling, 'utf8'), 'retain')
  await setup(previous, !production)
  assert.ok((await ps(registryScript)).includes('present'))
  assert.ok((await Promise.all(shortcuts.map(exists))).some(Boolean), 'Per-user start-menu shortcut must exist')
  const first = await open()
  assert.equal(first.runtime.version, production ? manifest.version : '0.0.9')
  await addCreature(first.page)
  await first.page.evaluate(() => localStorage.setItem('installer-test-setting', 'preserve-me'))
  const baseline = ownedRows(await exportJson(app, first.page, path.join(root, 'before.json')))
  assert.equal(baseline.length, 1)
  checks.push('installer registers per-user uninstall/start-menu entries and saves a fictional record in an isolated profile')
  await assert.rejects(setup(candidate), error => error.code === 2)
  await assert.rejects(remove(), error => error.code === 2)
  assert.equal(await first.page.evaluate(() => localStorage.getItem('installer-test-setting')), 'preserve-me')
  assert.deepEqual(ownedRows(await exportJson(app, first.page, path.join(root, 'still-running.json'))), baseline)
  checks.push('running application refuses silent upgrade and uninstall without process termination or data change')
  await close()
  const beforeUpgrade = await dataFiles()
  await setup(candidate)
  await preserved(beforeUpgrade)
  const upgraded = await open()
  assert.equal(upgraded.runtime.version, manifest.version)
  assert.deepEqual(ownedRows(await exportJson(app, upgraded.page, path.join(root, 'upgraded.json'))), baseline)
  assert.equal(await upgraded.page.evaluate(() => localStorage.getItem('installer-test-setting')), 'preserve-me')
  await close()
  checks.push(production ? 'same-version reinstall preserves IndexedDB, settings and record IDs' : 'lower-version fixture upgrade changes version and preserves IndexedDB, settings and record IDs')
  if (!production) {
    // Exercise damaged registration only under the dedicated fixture GUID.
    const key = 'HKCU:/Software/' + fixture.installerGuid
    const setLocation = location => ps(`Set-ItemProperty -LiteralPath '${key}' -Name InstallLocation -Value '${location.replaceAll("'", "''")}' -ErrorAction Stop`)
    assert.equal(path.normalize(await ps(`(Get-ItemProperty -LiteralPath '${key}').InstallLocation`)), installed)
    try {
      await setLocation(family)
      await assert.rejects(run(uninstaller(), ['/S', '/currentuser', `_?=${family}`], { env, windowsHide: true, windowsVerbatimArguments: true, timeout: 30000 }), error => error.code === 3)
      assert.equal(await fs.readFile(sibling, 'utf8'), 'retain')
      await fs.access(executable())
    } finally {
      await setLocation(installed)
    }
    checks.push('uninstaller refuses shared parent even with damaged fixture registration')
  }
  const beforeUninstall = await dataFiles()
  await remove()
  await preserved(beforeUninstall)
  for (const file of shortcuts) assert.equal(await exists(file), false)
  checks.push('uninstall removes executable, registration and shortcut but retains all business data files')
  installed = standard
  await setup(candidate)
  assert.equal(await fs.readFile(sibling, 'utf8'), 'retain')
  const shortcut = (await Promise.all(shortcuts.map(exists))).indexOf(true)
  assert.ok(shortcut >= 0)
  const linkPath = shortcuts[shortcut].replaceAll("'", "''")
  const link = JSON.parse(await ps(`$link = (New-Object -ComObject WScript.Shell).CreateShortcut('${linkPath}'); @($link.TargetPath, $link.IconLocation) | ConvertTo-Json -Compress`))
  assert.equal(path.normalize(link[0]).toLowerCase(), executable().toLowerCase())
  assert.equal(link[1].replace(/,\s*0$/, '').toLowerCase(), executable().toLowerCase())
  const reinstalled = await open()
  assert.deepEqual(ownedRows(await exportJson(app, reinstalled.page, path.join(root, 'reinstalled.json'))), baseline)
  assert.equal(await reinstalled.page.evaluate(() => localStorage.getItem('installer-test-setting')), 'preserve-me')
  await close()
  await remove()
  assert.equal(await fs.readFile(sibling, 'utf8'), 'retain')
  checks.push('fresh per-user default, registered path reuse, Start menu target/icon and sibling preservation verified')
  checks.push('reinstallation restores existing collection/settings; final cleanup removes only the test application')
  await fs.mkdir('artifacts/desktop/test-results', { recursive: true })
  const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex')
  await fs.writeFile(`artifacts/desktop/test-results/${production ? 'production-installer' : 'installer'}.json`, JSON.stringify({ passed: true, platform: process.platform, os: os.release(), version: manifest.version, candidateSha256: await digest(candidate), previousSha256: await digest(previous), identity, checks, limitation: production ? 'Production application identity under a temporary profile; silent installation and same-version reinstall only. Interactive wizard and clean Windows account remain unverified.' : 'Separate application identity and temporary profile on this host. Lower version uses current code: does not prove historical business migration, production installer UI, or clean Windows acceptance.' }, null, 2))
  console.log(`Installer acceptance passed ${checks.length} lifecycle groups.`)
} finally {
  await close()
  if (installedByTest) await remove()
  // Retain isolated data under the temporary directory for diagnosis; never clean OS caches.
}
