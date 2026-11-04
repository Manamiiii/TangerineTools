import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, Platform, Arch } from 'electron-builder'
import { fixture } from './fixture.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, 'artifacts/desktop')
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const config = JSON.parse(await readFile(path.join(root, 'desktop/config.json'), 'utf8'))
const useFixtures = process.argv.includes('--fixtures')
const directoryOnly = process.argv.includes('--dir')
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 packaging is the validated build target; other platforms are not enabled.')

async function stage(label, identity, version) {
  const directory = path.join(outputRoot, 'staging', label)
  if (!directory.startsWith(path.join(outputRoot, 'staging') + path.sep)) throw new Error('Unsafe staging directory')
  await rm(directory, { recursive: true, force: true })
  await mkdir(path.join(directory, 'desktop'), { recursive: true })
  await cp(path.join(root, 'dist'), path.join(directory, 'dist'), { recursive: true, filter: source => path.basename(source) !== 'sw.js' })
  for (const file of ['main.mjs', 'security.mjs']) await cp(path.join(root, 'desktop', file), path.join(directory, 'desktop', file))
  await writeFile(path.join(directory, 'desktop/config.json'), JSON.stringify(identity, null, 2))
  for (const file of ['LICENSE', 'COPYRIGHT']) await cp(path.join(root, file), path.join(directory, file))
  await cp(path.join(root, 'dist/THIRD_PARTY_NOTICES.txt'), path.join(directory, 'THIRD_PARTY_NOTICES.txt'))
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: manifest.name, version, type: 'module', main: 'desktop/main.mjs', description: manifest.description, author: manifest.author, license: manifest.license, homepage: manifest.homepage, dependencies: {} }, null, 2))
  const hash = createHash('sha256')
  const files = []
  async function visit(folder) {
    for (const item of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(folder, item.name)
      if (item.isDirectory()) await visit(full)
      else {
        const relative = path.relative(directory, full).replaceAll('\\', '/')
        const digest = createHash('sha256').update(await readFile(full)).digest('hex')
        files.push({ file: relative, sha256: digest })
        hash.update(relative + '\0' + digest + '\n')
      }
    }
  }
  await visit(directory)
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim())
  await writeFile(path.join(directory, 'build-info.json'), JSON.stringify({ version, revision, dirty, platform: 'win32', arch: 'x64', electron: manifest.devDependencies.electron, source: manifest.repository.url, contentSha256: hash.digest('hex'), files }, null, 2))
  return directory
}

export function builderConfig(identity, appDirectory, outputDirectory, legacyFixture = false) {
  return {
    appId: identity.appId, productName: identity.executableName,
    electronVersion: manifest.devDependencies.electron,
    directories: { app: appDirectory, output: outputDirectory, buildResources: path.join(root, 'desktop') },
    files: ['desktop/**/*', 'dist/**/*', 'package.json', 'LICENSE', 'COPYRIGHT', 'THIRD_PARTY_NOTICES.txt', 'build-info.json', '!node_modules/**/*'], asar: true, npmRebuild: false, publish: null,
    win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: path.join(root, 'public/icons/tangerine-tools.ico'), executableName: identity.executableName, signExecutable: false },
    nsis: {
      guid: identity.installerGuid, artifactName: 'TangerineTools-${version}-win-${arch}-Setup.${ext}',
      oneClick: false, perMachine: false, allowElevation: false, packElevateHelper: false,
      allowToChangeInstallationDirectory: false, deleteAppDataOnUninstall: false, runAfterFinish: false,
      createDesktopShortcut: false, createStartMenuShortcut: true, shortcutName: identity.productName,
      uninstallDisplayName: identity.productName, installerLanguages: ['zh_CN', 'en_US'],
      license: path.join(root, 'LICENSE'), include: path.join(root, 'desktop', legacyFixture ? 'running-guard.nsh' : 'installer.nsh'),
    },
  }
}

const plans = useFixtures ? [['previous', '0.0.9'], ['current', manifest.version]] : [['production', manifest.version]]
for (const [label, version] of plans) {
  const identity = useFixtures ? { ...config, ...fixture } : config
  const directory = await stage(label, identity, version)
  const destination = useFixtures ? path.join(outputRoot, 'installer-acceptance', label) : path.join(outputRoot, 'release')
  await build({ targets: Platform.WINDOWS.createTarget(directoryOnly ? ['dir'] : ['nsis'], Arch.x64), publish: 'never', config: builderConfig(identity, directory, destination, label === 'previous') })
}
