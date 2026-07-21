import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const docsRoot = path.join(repoRoot, 'docs')
const forbiddenNarration = [
  /本分支已完成/,
  /已清理内容/,
  /执行记录/,
  /退役的/,
  /已删除/,
  /已移除/,
  /第一版/,
  /下一轮/,
  /旧版/,
]

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await markdownFiles(fullPath))
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

test('maintained docs describe current state instead of implementation history', async () => {
  const files = [path.join(repoRoot, 'README.md'), ...await markdownFiles(docsRoot)]
  const violations = []

  for (const file of files) {
    const content = await readFile(file, 'utf8')
    for (const pattern of forbiddenNarration) {
      if (pattern.test(content)) violations.push(`${path.relative(repoRoot, file)}: ${pattern}`)
    }
  }

  assert.deepEqual(violations, [])
})
