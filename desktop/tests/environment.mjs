import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import electronPath from 'electron'

// Probe the runtime's OS directory resolution before any application code is launched.
export async function isolatedEnvironment(root) {
  assert.equal(process.platform, 'win32', 'Packaged tests currently target Windows only.')
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(PATH|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|TEMP|TMP)$/i.test(key)) delete env[key]
  }
  const home = path.join(root, 'home')
  const roaming = path.join(home, 'AppData/Roaming')
  const local = path.join(home, 'AppData/Local')
  const temp = path.join(root, 'temp')
  for (const directory of [home, roaming, local, temp, path.join(home, 'Desktop'), path.join(home, 'Downloads')]) await fs.mkdir(directory, { recursive: true })
  Object.assign(env, { APPDATA: roaming, LOCALAPPDATA: local, USERPROFILE: home, HOMEDRIVE: path.parse(home).root.slice(0, -1), HOMEPATH: home.slice(path.parse(home).root.length - 1), TEMP: temp, TMP: temp, PATH: '', TANGERINE_PROBE_RESULT: path.join(root, 'environment-probe.json') })
  const probe = path.join(root, 'probe.cjs')
  await fs.writeFile(probe, `const {app}=require('electron');require('node:fs').writeFileSync(process.env.TANGERINE_PROBE_RESULT,JSON.stringify({appData:app.getPath('appData'),userData:app.getPath('userData'),home:require('node:os').homedir()}));app.exit(0);`)
  await promisify(execFile)(electronPath, [probe], { env, windowsHide: true, timeout: 15000 })
  const detected = JSON.parse(await fs.readFile(env.TANGERINE_PROBE_RESULT, 'utf8'))
  const normalized = value => path.resolve(value).toLowerCase()
  assert.equal(normalized(detected.appData), normalized(roaming), 'Refusing to launch: APPDATA is not isolated')
  assert.equal(normalized(detected.home), normalized(home), 'Refusing to launch: home is not isolated')
  assert.ok(normalized(detected.userData).startsWith(normalized(root) + path.sep))
  delete env.TANGERINE_PROBE_RESULT
  return env
}
