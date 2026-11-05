import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const persistent = ['IndexedDB', 'Local Storage', 'Preferences', 'Local State']
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const fail = message => { throw new Error(message) }
const exists = file => { try { fs.lstatSync(file); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error } }

// Refuse links at every existing level, including ancestors of absent targets.
export function checkPath(target) {
  const absolute = path.resolve(target)
  let current = path.parse(absolute).root
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    if (exists(current) && fs.lstatSync(current).isSymbolicLink()) fail('数据目录含链接或重定向，已保留现场；请核对实际目录后再启动。')
  }
  return absolute
}

export function storagePaths(config, local, roaming) {
  if (!local || !roaming || !path.isAbsolute(local) || !path.isAbsolute(roaming) || !/^[A-Za-z0-9_-]+$/.test(config.dataDirectory)) fail('无法确定本用户的数据目录。')
  const root = checkPath(path.join(local, 'Tangerine', 'Data', config.dataDirectory))
  return { root, config: path.join(root, 'Config'), storage: path.join(root, 'Storage'), cache: path.join(root, 'Cache'), logs: path.join(root, 'Logs'), temp: path.join(root, 'Temp'), legacy: checkPath(path.join(roaming, config.dataDirectory)) }
}

export function profileFiles(directory) {
  checkPath(directory)
  const files = []
  function visit(relative) {
    const file = checkPath(path.join(directory, relative))
    if (!exists(file)) return
    const stat = fs.lstatSync(file)
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(relative, name))
    else if (stat.isFile()) files.push({ file: relative.split(path.sep).join('/'), sha256: digest(file) })
    else fail('数据目录包含不支持的文件类型，未迁移。')
  }
  for (const name of persistent) visit(name)
  return files
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
function save(file, record) {
  const temporary = file + '.' + randomUUID() + '.tmp'
  const fd = fs.openSync(temporary, 'wx')
  try { fs.writeFileSync(fd, JSON.stringify(record, null, 2)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temporary, file)
}

// Must run while holding the legacy Electron single-instance lock. Its path
// remains stable across profile moves so an installed historical binary also
// refuses concurrent use. Neither old data nor failed staging is deleted.
export function prepareStorage(paths, config, hooks = {}) {
  for (const directory of Object.values(paths)) checkPath(directory)
  const marker = checkPath(path.join(paths.config, 'layout.json'))
  let record
  if (exists(marker)) {
    try { record = JSON.parse(fs.readFileSync(marker, 'utf8')) } catch { fail('数据目录记录损坏，未新建或覆盖收藏。请保留 Config、Storage 和原目录。') }
    if (record.version !== 1 || record.appId !== config.appId || !['copying', 'ready'].includes(record.state)
      || record.legacy !== paths.legacy || !Array.isArray(record.sourceFiles)) fail('数据目录归属或迁移记录不匹配，未加载收藏。')
  }
  const sourceFiles = profileFiles(paths.legacy)
  if (record && !same(record.sourceFiles, sourceFiles)) fail('原数据目录与迁移时不同，可能被历史版本改写。两份数据均已保留；请先分别备份并人工确认，不要删除目录后重试。')
  if (record?.state === 'ready') {
    if (!exists(paths.storage)) fail('已登记的数据目录不可用；未创建空库。请恢复 Storage 目录后重试。')
    return paths
  }
  if (!record) {
    if (exists(paths.root) && fs.readdirSync(paths.root).some(name => name !== 'Logs')) fail('目标数据目录已有未登记内容，未覆盖或自动选用。请先核对两份数据。')
    // A nonempty unknown historical profile is not treated as a fresh install.
    if (!sourceFiles.length && exists(paths.legacy) && fs.readdirSync(paths.legacy).some(name => !['lockfile'].includes(name))) fail('原数据目录存在未识别内容，未创建替代空库。请先从原程序导出 JSON。')
    fs.mkdirSync(paths.config, { recursive: true })
    record = { version: 1, appId: config.appId, state: 'copying', legacy: paths.legacy, sourceFiles, stage: 'migration-' + randomUUID() }
    save(marker, record)
  }
  if (!/^migration-[0-9a-f-]{36}$/.test(record.stage)) fail('迁移暂存记录无效。')
  const stage = checkPath(path.join(paths.temp, record.stage))
  if (!exists(paths.storage)) {
    fs.mkdirSync(stage, { recursive: true })
    for (const item of record.sourceFiles) {
      // The manifest must match a fresh traversal before any stored path is used.
      const from = checkPath(path.join(paths.legacy, item.file))
      const to = checkPath(path.join(stage, item.file))
      fs.mkdirSync(path.dirname(to), { recursive: true })
      if (exists(to)) { if (digest(to) !== item.sha256) fail('迁移暂存文件不完整，原件保持不变；请保留现场用于恢复。') }
      else fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL)
      if (digest(to) !== item.sha256) fail('迁移文件校验失败，未启用目标数据。')
      const fd = fs.openSync(to, 'r+')
      try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      hooks.afterCopy?.(item)
    }
    if (!same(profileFiles(paths.legacy), record.sourceFiles) || !same(profileFiles(stage), record.sourceFiles)) fail('复制期间原数据发生变化，未启用目标数据。')
    fs.renameSync(stage, paths.storage)
    hooks.afterPublish?.()
  } else if (!same(profileFiles(paths.storage), record.sourceFiles)) fail('中断迁移的目标内容不一致，未覆盖任一目录。')
  save(marker, { ...record, state: 'ready' })
  return paths
}

export function initializeStorage(app, config) {
  if (process.platform !== 'win32') fail('此候选只验证 Windows x64。')
  const paths = storagePaths(config, process.env.LOCALAPPDATA, app.getPath('appData'))
  // Only a compatibility lockfile is allowed outside the new data root. Set
  // both profile paths before ready; no default display-name profile is used.
  app.setPath('userData', paths.legacy)
  if (!app.requestSingleInstanceLock()) return false
  prepareStorage(paths, config)
  for (const directory of [paths.storage, paths.cache, paths.logs, paths.temp, path.join(paths.logs, 'CrashDumps')]) fs.mkdirSync(checkPath(directory), { recursive: true })
  app.setPath('userData', paths.storage)
  app.setPath('sessionData', paths.storage)
  app.setAppLogsPath(paths.logs)
  app.setPath('crashDumps', path.join(paths.logs, 'CrashDumps'))
  app.setPath('temp', paths.temp)
  process.env.TEMP = paths.temp
  process.env.TMP = paths.temp
  app.commandLine.appendSwitch('disk-cache-dir', paths.cache)
  return true
}
