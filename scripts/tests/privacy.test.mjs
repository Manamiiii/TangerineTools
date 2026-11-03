import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPrivateCommitEmail, scanPrivateContent } from '../check-privacy.mjs'

test('privacy checks catch machine paths and credentials without returning their values', () => {
  const samples = [
    ['D:', 'Users', 'private-user', 'data.json'].join('\\'),
    ['D:', 'Users', 'private-user', 'data.json'].join('\\\\'),
    ['E:', 'private-project', 'config.json'].join('/'),
    ['', 'Users', 'private-user', 'data.json'].join('/'),
    ['', 'home', 'private-user', '.config'].join('/'),
    'ghp_' + 'x'.repeat(40),
    'sk-' + 'x'.repeat(32),
    '-----BEGIN ' + 'PRIVATE KEY-----',
    ['192', '168', '5', '2'].join('.'),
  ]
  for (const sample of samples) {
    const results = scanPrivateContent('config.json', '\n' + sample)
    assert.ok(results.length, sample)
    assert.ok(results.every(result => result.line === 2))
    assert.ok(!JSON.stringify(results).includes(sample))
  }
})

test('privacy checks block private files even when empty and preserve portable setup', () => {
  for (const file of ['.local/settings.json', '.env', '.env.production', 'config.local.json', 'desktop.lnk', '.codex/auth.json', 'artifacts/backup.json']) {
    assert.ok(scanPrivateContent(file, '').some(result => result.rule === 'private-local-file'))
  }
  for (const [file, text] of [
    ['.env.example', 'PROVIDER_KEY='],
    ['src/config.js', "const root = process.env.PROJECT_ROOT"],
    ['.devcontainer/devcontainer.json', ['/home', 'codespace', '.codex'].join('/')],
    ['README.md', 'http://localhost:5188 https://manamiiii.github.io/TangerineTools/'],
  ]) assert.deepEqual(scanPrivateContent(file, text), [])
})

test('commit metadata permits GitHub public noreply addresses instead of personal mail', () => {
  assert.equal(isPrivateCommitEmail('123+alias@users.noreply.github.com'), false)
  assert.equal(isPrivateCommitEmail('noreply@github.com'), false)
  assert.equal(isPrivateCommitEmail('person' + '@mail.invalid'), true)
  assert.equal(isPrivateCommitEmail(''), true)
})

test('pre-commit mode checks staged content and identity without printing private values', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tangerine-privacy-'))
  const script = fileURLToPath(new URL('../check-privacy.mjs', import.meta.url))
  const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' })
  const check = () => spawnSync(process.execPath, [script, '--staged'], { cwd: directory, encoding: 'utf8' })
  const privateValue = ['D:', 'Users', 'PrivatePerson', 'settings'].join('/')
  try {
    git(['init', '-q'])
    git(['config', 'user.name', 'PublicAlias'])
    git(['config', 'user.email', '123+alias@users.noreply.github.com'])
    writeFileSync(path.join(directory, 'settings.txt'), 'portable settings')
    git(['add', 'settings.txt'])
    writeFileSync(path.join(directory, 'settings.txt'), privateValue)
    assert.equal(check().status, 0, 'unstaged text must not replace the index snapshot')
    git(['add', 'settings.txt'])
    const failure = check()
    assert.equal(failure.status, 1)
    assert.match(failure.stderr, /absolute-drive-path/)
    assert.ok(!failure.stderr.includes(privateValue))
    writeFileSync(path.join(directory, 'settings.txt'), 'portable settings')
    git(['add', 'settings.txt'])
    git(['config', 'user.email', 'person' + '@mail.invalid'])
    assert.match(check().stderr, /non-noreply-email/)
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()))
    rmSync(directory, { recursive: true, force: true })
  }
})
