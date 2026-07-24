import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertReadingPackage } from '../../src/domain/readingCompanion.js'
import {
  previewPath,
  publicPackagePath,
  readJson,
  reportPath,
  writeJson,
} from './lib/package-pipeline.mjs'

const write = process.argv.includes('--write')
const preview = await readJson(previewPath)
const current = await readJson(publicPackagePath)
assertReadingPackage(preview.package)

const currentJson = JSON.stringify(current)
const nextJson = JSON.stringify(preview.package)
const changed = currentJson !== nextJson
const report = [
  '# 阅读资料包发布预览',
  '',
  `- 资料包：${preview.package.book.title} · ${preview.package.edition.isbn}`,
  `- 版本：${current.packageVersion} → ${preview.package.packageVersion}`,
  `- 正式资料变化：${changed ? '有' : '无'}`,
  `- 章节：${preview.package.chapters.length}`,
  `- 实体：${preview.package.entities.length}`,
  `- 事实：${preview.package.facts.length}`,
  `- 已批准资料源：${preview.previewMeta.approvedSourceIds.length}`,
  `- 待审资料源：${preview.previewMeta.pendingSourceIds.length}`,
  '',
  '## 待审资料源',
  '',
  ...(preview.previewMeta.pendingSourceIds.length
    ? preview.previewMeta.pendingSourceIds.map((id) => `- \`${id}\``)
    : ['- 无']),
  '',
].join('\n')

await mkdir(path.dirname(reportPath), { recursive: true })
await writeFile(reportPath, report, 'utf8')
console.log(report)

if (write) {
  if (process.env.READING_PACKAGE_OVERWRITE !== 'CONFIRM_READING_PACKAGE') {
    throw new Error('正式发布需要 READING_PACKAGE_OVERWRITE=CONFIRM_READING_PACKAGE')
  }
  await writeJson(publicPackagePath, preview.package)
  console.log(changed ? '✓ 已发布阅读资料包' : '✓ 正式资料包无需变更')
} else {
  console.log('dry-run：未修改正式资料包')
}
