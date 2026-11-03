import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rules = [
  ['absolute-drive-path', /\b[a-z]:[\\/]+[^\s"'<>]+/gi],
  ['personal-home-path', /\/(?:Users|home)\/[a-z0-9_.-]+(?:\/[^\s"'<>]*)?/gi],
  ['credential', /\b(?:gh[pousr]_[a-z0-9]{30,}|github_pat_[a-z0-9_]{40,}|sk-[a-z0-9_-]{24,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi],
  ['private-network-address', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g],
]

export function scanPrivateContent(file, text) {
  const findings = []
  const normalized = file.replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (parts.some(part => ['.local', '.codex', '.codex-remote-attachments', '.ssh', 'artifacts', 'node_modules'].includes(part))
    || parts.some(part => /^\.env(?:\.|$)/.test(part) && part !== '.env.example')
    || /(?:^|\/)auth\.json$|\.local(?:\.|$)|\.lnk$/i.test(normalized)) {
    findings.push({ file, line: 0, rule: 'private-local-file' })
  }
  for (const [rule, pattern] of rules) {
    for (const match of text.matchAll(pattern)) {
      // This is the standard devcontainer account, not a person's home directory.
      if (rule === 'personal-home-path' && /^\/home\/codespace(?:\/|$)/.test(match[0])) continue
      findings.push({ file, line: text.slice(0, match.index).split('\n').length, rule })
    }
  }
  return findings
}

export function isPrivateCommitEmail(email) {
  return !/^(?:[^@\s]+@users\.noreply\.github\.com|noreply@github\.com)$/i.test(email)
}

function main() {
  const staged = process.argv.includes('--staged')
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  const files = git(['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean)
  const findings = []
  let binaries = 0
  for (const file of files) {
    const bytes = staged ? git(['show', `:${file}`]) : readFileSync(path.join(root, file))
    const binary = bytes.subarray(0, 2048).includes(0)
    if (binary) binaries++
    findings.push(...scanPrivateContent(file, binary ? '' : bytes.toString('utf8')))
  }
  const emails = staged
    ? ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'].map(key => git(['var', key]).toString('utf8').match(/<([^>]+)>/)?.[1] || '')
    : git(['log', '-1', '--format=%ae%n%ce']).toString('utf8').trim().split('\n')
  for (const email of emails) {
    if (isPrivateCommitEmail(email.trim())) findings.push({ file: '(commit metadata)', line: 0, rule: 'non-noreply-email' })
  }
  // Report locations and rule names only; never repeat a possible secret value.
  for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.rule}`)
  if (findings.length) {
    console.error('Privacy check failed. Keep machine settings in ignored .local/ or environment variables; use a public GitHub noreply commit email.')
    process.exitCode = 1
  } else {
    console.log(`Privacy text checks passed for ${files.length} tracked files; ${binaries} binary files still require visual/metadata review.`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
