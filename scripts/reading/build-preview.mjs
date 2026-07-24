import { buildReadingPreview, previewPath, writeJson } from './lib/package-pipeline.mjs'

const preview = await buildReadingPreview()
await writeJson(previewPath, preview)

console.log(`✓ preview: ${preview.package.book.title} · ${preview.package.edition.isbn}`)
console.log(`  章节 ${preview.package.chapters.length} · 实体 ${preview.package.entities.length} · 事实 ${preview.package.facts.length}`)
console.log(`  待审资料源 ${preview.previewMeta.pendingSourceIds.length}`)
