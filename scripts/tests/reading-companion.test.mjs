import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  SPOILER_GATE_ACTION,
  SPOILER_RISK,
  canRevealRisk,
  readingStateKey,
  riskForDisclosure,
  spoilerGateAction,
  strongestSpoilerRisk,
  validateReadingPackage,
} from '../../src/domain/readingCompanion.js'
import {
  buildReadingPreviewFromStaging,
  buildReadingPreviews,
} from '../reading/lib/package-pipeline.mjs'

const repoUrl = new URL('../../', import.meta.url)
const readingPackage = JSON.parse(
  await readFile(
    new URL('public/presets/reading-companion/gone-with-the-wind-zh-9787570202188.json', repoUrl),
    'utf8',
  ),
)

test('Gone with the Wind package preserves the confirmed edition and 63 stable chapters', () => {
  assert.deepEqual(validateReadingPackage(readingPackage), [])
  assert.equal(readingPackage.edition.isbn, '9787570202188')
  assert.deepEqual(readingPackage.edition.translators, ['范纯海', '夏旻'])
  assert.equal(readingPackage.chapters.length, 63)
  assert.equal(readingPackage.chapters[0].id, 'chapter-01')
  assert.equal(readingPackage.chapters.at(-1).id, 'chapter-63')
  assert.equal(new Set(readingPackage.chapters.map((chapter) => chapter.id)).size, 63)
})

test('package validation rejects duplicate chapters and unknown fact references', () => {
  const invalidPackage = structuredClone(readingPackage)
  invalidPackage.chapters[1].id = 'chapter-01'
  invalidPackage.facts = [{
    id: 'fact-invalid',
    entityIds: ['missing-entity'],
    riskLevel: 'mystery',
    revealAt: { chapterId: 'chapter-99' },
  }]
  const errors = validateReadingPackage(invalidPackage)
  assert.ok(errors.some((error) => error.includes('章节 id 重复')))
  assert.ok(errors.some((error) => error.includes('riskLevel')))
  assert.ok(errors.some((error) => error.includes('未知章节')))
  assert.ok(errors.some((error) => error.includes('未知实体')))
})

test('reading state keys isolate scenes and editions without changing the Dexie schema', () => {
  assert.equal(
    readingStateKey('scene-reading', 'gone-with-the-wind-zh-9787570202188'),
    'readerState:scene-reading:gone-with-the-wind-zh-9787570202188',
  )
  assert.throws(() => readingStateKey('', 'edition'), /场景和版本/)
})

test('spoiler risk defaults unknown boundaries to potential and preserves high risk', () => {
  const chapters = readingPackage.chapters
  assert.equal(
    riskForDisclosure({
      riskLevel: SPOILER_RISK.SAFE,
      revealAt: { chapterId: 'chapter-03' },
      currentChapterId: 'chapter-06',
      chapters,
    }),
    SPOILER_RISK.SAFE,
  )
  assert.equal(
    riskForDisclosure({
      riskLevel: SPOILER_RISK.SAFE,
      revealAt: { chapterId: 'chapter-07' },
      currentChapterId: 'chapter-06',
      chapters,
    }),
    SPOILER_RISK.POTENTIAL,
  )
  assert.equal(
    riskForDisclosure({
      riskLevel: SPOILER_RISK.HIGH,
      revealAt: { chapterId: 'chapter-63' },
      currentChapterId: 'chapter-06',
      chapters,
    }),
    SPOILER_RISK.HIGH,
  )
  assert.equal(
    riskForDisclosure({ riskLevel: 'unknown', revealAt: null, currentChapterId: '', chapters }),
    SPOILER_RISK.POTENTIAL,
  )
})

test('spoiler gate requires the matching one-time authorization level', () => {
  assert.equal(spoilerGateAction(SPOILER_RISK.SAFE), SPOILER_GATE_ACTION.DISPLAY)
  assert.equal(spoilerGateAction(SPOILER_RISK.POTENTIAL), SPOILER_GATE_ACTION.WARN)
  assert.equal(spoilerGateAction(SPOILER_RISK.HIGH), SPOILER_GATE_ACTION.CONFIRM_TWICE)
  assert.equal(canRevealRisk(SPOILER_RISK.SAFE), true)
  assert.equal(canRevealRisk(SPOILER_RISK.POTENTIAL, 'none'), false)
  assert.equal(canRevealRisk(SPOILER_RISK.POTENTIAL, SPOILER_RISK.POTENTIAL), true)
  assert.equal(canRevealRisk(SPOILER_RISK.HIGH, SPOILER_RISK.POTENTIAL), false)
  assert.equal(canRevealRisk(SPOILER_RISK.HIGH, SPOILER_RISK.HIGH), true)
  assert.equal(
    strongestSpoilerRisk([SPOILER_RISK.SAFE, SPOILER_RISK.POTENTIAL, SPOILER_RISK.HIGH]),
    SPOILER_RISK.HIGH,
  )
})

test('reading preview publishes only approved sources and keeps candidates pending', async () => {
  const { previews, catalog } = await buildReadingPreviews()
  assert.equal(previews.length, 1)
  assert.equal(catalog.packages.length, 1)
  const [preview] = previews
  assert.deepEqual(validateReadingPackage(preview.package), [])
  assert.deepEqual(preview.previewMeta.approvedSourceIds, ['source-weread-edition-metadata'])
  assert.equal(preview.previewMeta.pendingSourceIds.length, 4)
  assert.deepEqual(
    preview.package.sources.map((source) => source.id),
    ['source-weread-edition-metadata'],
  )
  assert.equal(
    preview.package.sources.some((source) => source.id.startsWith('candidate-')),
    false,
  )
})

test('a new book can build its first preview from staging without pipeline code changes', () => {
  const staging = {
    schemaVersion: 1,
    slug: 'test-book-zh-test-edition',
    order: 1,
    packageId: 'reader-package-test-book-zh-test-edition',
    packageVersion: '1.0.0',
    catalogEntry: { title: '测试书籍', editionLabel: '测试出版社 · 2026年' },
    sourceCandidates: [{
      id: 'source-test-edition',
      status: 'approved',
      kind: 'edition-metadata',
      label: '测试版本信息',
    }],
    entities: [],
    facts: [],
    package: {
      schemaVersion: 1,
      packageVersion: '1.0.0',
      id: 'reader-package-test-book-zh-test-edition',
      book: {
        id: 'test-book',
        title: '测试书籍',
        author: '测试作者',
        originalLanguage: 'zh',
      },
      edition: {
        id: 'test-book-zh-test-edition',
        isbn: '0000000000000',
        language: 'zh-CN',
        publisher: '测试出版社',
        publishedAt: '2026',
        chapterCount: 1,
      },
      chapters: [{ id: 'chapter-01', number: 1, label: '第 1 章' }],
      entities: [],
      facts: [],
      sources: [],
    },
  }
  const preview = buildReadingPreviewFromStaging(staging)
  assert.equal(preview.package.book.title, '测试书籍')
  assert.equal(preview.previewMeta.targetPath, 'public/presets/reading-companion/test-book-zh-test-edition.json')
  assert.equal(preview.catalogEntry.path, 'presets/reading-companion/test-book-zh-test-edition.json')
  assert.deepEqual(preview.package.sources.map((source) => source.id), ['source-test-edition'])
})
