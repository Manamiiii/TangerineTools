import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { prepareStorage, profileFiles, storagePaths } from '../../desktop/storage.mjs'

const identity = { appId: 'org.tangerine.storage-test', dataDirectory: 'StorageTest' }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tangerine-storage-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const paths = storagePaths(identity, path.join(root, 'Local'), path.join(root, 'Roaming'))
  return { root, paths }
}
function put(folder, file, value = 'fictional') {
  const target = path.join(folder, file)
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value)
}
function oldProfile(paths) {
  put(paths.legacy, 'IndexedDB/app_rock-kingdom_0.indexeddb.leveldb/0001.ldb')
  put(paths.legacy, 'Local Storage/leveldb/0001.log', 'nonsecret-setting')
  put(paths.legacy, 'Preferences', '{}')
  put(paths.legacy, 'Session Storage/0001.log', 'session-only-test-key')
  put(paths.legacy, 'Cache/old-cache', 'transient')
}

test('fresh layout shares source logs, has stable identity and refuses a lost registered store', t => {
  const { paths } = fixture(t)
  put(paths.logs, 'Source/server.log')
  prepareStorage(paths, identity)
  assert.deepEqual(profileFiles(paths.storage), [])
  const marker = JSON.parse(fs.readFileSync(path.join(paths.config, 'layout.json')))
  assert.equal(marker.appId, identity.appId)
  prepareStorage(paths, identity)
  fs.rmdirSync(paths.storage)
  assert.throws(() => prepareStorage(paths, identity), /不可用/)
  assert.equal(fs.existsSync(paths.storage), false)
})

test('migration copies only persistent profile, verifies bytes and preserves every original', t => {
  const { paths } = fixture(t); oldProfile(paths)
  const before = profileFiles(paths.legacy)
  prepareStorage(paths, identity)
  assert.deepEqual(profileFiles(paths.storage), before)
  assert.deepEqual(profileFiles(paths.legacy), before)
  assert.equal(fs.existsSync(path.join(paths.storage, 'Session Storage')), false)
  assert.equal(fs.existsSync(path.join(paths.storage, 'Cache')), false)
  assert.equal(fs.readFileSync(path.join(paths.legacy, 'Session Storage/0001.log'), 'utf8'), 'session-only-test-key')
  put(paths.storage, 'Local Storage/leveldb/0001.log', 'new-version-setting')
  prepareStorage(paths, identity)
  assert.equal(fs.readFileSync(path.join(paths.storage, 'Local Storage/leveldb/0001.log'), 'utf8'), 'new-version-setting')
})

test('historical rollback changes cause a conflict instead of silently choosing either collection', t => {
  const { paths } = fixture(t); oldProfile(paths); prepareStorage(paths, identity)
  const before = profileFiles(paths.storage)
  put(paths.legacy, 'Preferences', '{"old-version":"changed"}')
  assert.throws(() => prepareStorage(paths, identity), /历史版本改写/)
  assert.deepEqual(profileFiles(paths.storage), before)
})

test('existing unregistered destination and unknown legacy content never become a fresh database', t => {
  const { paths } = fixture(t); oldProfile(paths); put(paths.storage, 'IndexedDB/keep', 'new')
  assert.throws(() => prepareStorage(paths, identity), /未登记/)
  assert.equal(fs.readFileSync(path.join(paths.storage, 'IndexedDB/keep'), 'utf8'), 'new')
  const other = storagePaths({ ...identity, dataDirectory: 'Other' }, path.dirname(path.dirname(path.dirname(paths.root))), path.dirname(paths.legacy))
  put(other.legacy, 'unknown.db')
  assert.throws(() => prepareStorage(other, identity), /未识别/)
})

for (const point of ['afterCopy', 'afterPublish']) test(`interruption at ${point} resumes only a verified migration`, t => {
  const { paths } = fixture(t); oldProfile(paths)
  const before = profileFiles(paths.legacy)
  assert.throws(() => prepareStorage(paths, identity, { [point]: () => { throw new Error('simulated interruption') } }), /simulated interruption/)
  assert.deepEqual(profileFiles(paths.legacy), before)
  prepareStorage(paths, identity)
  assert.deepEqual(profileFiles(paths.storage), before)
  assert.equal(JSON.parse(fs.readFileSync(path.join(paths.config, 'layout.json'))).state, 'ready')
})

test('copy failure, damaged staging and damaged manifest retain evidence without overwrite', t => {
  const { paths } = fixture(t); oldProfile(paths)
  assert.throws(() => prepareStorage(paths, identity, { afterCopy: () => { throw new Error('copy interrupted') } }))
  const marker = path.join(paths.config, 'layout.json')
  const record = JSON.parse(fs.readFileSync(marker))
  put(path.join(paths.temp, record.stage), record.sourceFiles[0].file, 'partial')
  assert.throws(() => prepareStorage(paths, identity), /不完整/)
  assert.equal(fs.existsSync(paths.storage), false)
  fs.writeFileSync(marker, '{')
  assert.throws(() => prepareStorage(paths, identity), /损坏/)
  assert.ok(profileFiles(paths.legacy).length)
})

test('links in a migration source or destination are refused without reading or writing their target', t => {
  const { root, paths } = fixture(t)
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside)
  put(outside, 'secret', 'untouched')
  fs.mkdirSync(paths.legacy, { recursive: true })
  fs.symlinkSync(outside, path.join(paths.legacy, 'IndexedDB'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => prepareStorage(paths, identity), /链接/)
  assert.equal(fs.readFileSync(path.join(outside, 'secret'), 'utf8'), 'untouched')
})

test('directory resolution rejects missing environment and invalid identity', () => {
  assert.throws(() => storagePaths(identity, '', os.tmpdir()))
  assert.throws(() => storagePaths({ ...identity, dataDirectory: '../Sibling' }, os.tmpdir(), os.tmpdir()))
})
