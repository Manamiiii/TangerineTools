import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  SPOILER_GATE_ACTION,
  SPOILER_RISK,
  canRevealRisk,
  isRevealedAtChapter,
  projectReadingPlaces,
  readingStateKey,
  riskForDisclosure,
  spoilerGateAction,
  strongestSpoilerRisk,
  validateReadingPackage,
  visibleReadingEntities,
  visibleReadingFacts,
} from '../../../src/features/reading-companion/domain/readingCompanion.js'
import {
  buildReadingPreviewFromStaging,
  buildReadingPreviews,
} from '../lib/package-pipeline.mjs'

const repoUrl = new URL('../../../', import.meta.url)
const readingPackage = JSON.parse(
  await readFile(
    new URL('public/presets/reading-companion/gone-with-the-wind-zh-9787570202188.json', repoUrl),
    'utf8',
  ),
)

test('reading companion keeps feature code and maintenance files in dedicated directories', async () => {
  const dedicatedPaths = [
    'src/features/reading-companion/index.js',
    'src/features/reading-companion/components/ReaderTool.jsx',
    'src/features/reading-companion/data/readingPackages.js',
    'src/features/reading-companion/db/readingState.js',
    'src/features/reading-companion/db/seed.js',
    'src/features/reading-companion/domain/readingCompanion.js',
    'src/features/reading-companion/preset.js',
    'scripts/reading-companion/build-preview.mjs',
    'docs/reading-companion/product-and-architecture.md',
  ]
  await Promise.all(dedicatedPaths.map((file) => access(new URL(file, repoUrl))))

  const retiredMixedPaths = [
    'src/components/reader.jsx',
    'src/data/readingPackages.js',
    'src/db/readingState.js',
    'src/db/readingCompanionSeed.js',
    'src/domain/readingCompanion.js',
    'src/presets/readingCompanion.js',
    'scripts/reading/build-preview.mjs',
  ]
  for (const file of retiredMixedPaths) {
    await assert.rejects(access(new URL(file, repoUrl)), { code: 'ENOENT' })
  }
})

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
  assert.ok(errors.some((error) => error.includes('已知章节')))
  assert.ok(errors.some((error) => error.includes('未知实体')))
})

test('package validation requires auditable place boundaries and avoids fabricated fictional points', () => {
  const validPackage = structuredClone(readingPackage)
  validPackage.entities = [{
    id: 'place-real',
    name: '测试真实地点',
    kind: 'place',
    placeKind: 'real',
    aliases: [],
    revealAt: { chapterId: 'chapter-01' },
    sourceIds: ['source-weread-edition-metadata'],
    geometry: {
      type: 'point',
      latitude: 33.7,
      longitude: -84.4,
    },
  }]
  assert.deepEqual(validateReadingPackage(validPackage), [])

  const invalidPackage = structuredClone(readingPackage)
  invalidPackage.entities = [{
    id: 'place-fictional',
    name: '测试庄园',
    kind: 'place',
    placeKind: 'fictional',
    revealAt: { chapterId: 'chapter-01' },
    sourceIds: ['missing-source'],
    geometry: {
      type: 'point',
      latitude: 33.7,
      longitude: -84.4,
    },
  }]
  const errors = validateReadingPackage(invalidPackage)
  assert.ok(errors.some((error) => error.includes('未知来源')))
  assert.ok(errors.some((error) => error.includes('虚构地点不能伪造精确坐标')))
})

test('entity visibility and spatial projection are deterministic system capabilities', () => {
  const entities = [
    {
      id: 'place-real',
      name: '真实地点',
      kind: 'place',
      revealAt: { chapterId: 'chapter-01' },
      geometry: { type: 'point', latitude: 34, longitude: -85 },
    },
    {
      id: 'place-area',
      name: '模糊区域',
      kind: 'place',
      revealAt: { chapterId: 'chapter-03' },
      geometry: { type: 'area', latitude: 32, longitude: -82, radiusKm: 20 },
    },
    {
      id: 'place-unknown-boundary',
      name: '未知边界地点',
      kind: 'place',
      revealAt: null,
      geometry: { type: 'point', latitude: 33, longitude: -83 },
    },
  ]
  assert.equal(
    isRevealedAtChapter({ chapterId: 'chapter-01' }, 'chapter-02', readingPackage.chapters),
    true,
  )
  assert.deepEqual(
    visibleReadingEntities(entities, 'chapter-02', readingPackage.chapters).map(({ id }) => id),
    ['place-real'],
  )
  const projected = projectReadingPlaces(
    visibleReadingEntities(entities, 'chapter-03', readingPackage.chapters),
  )
  assert.deepEqual(projected.map(({ id }) => id), ['place-real', 'place-area'])
  assert.deepEqual(
    projected.map(({ x, y }) => [x, y]),
    [[8, 8], [92, 92]],
  )
})

test('formal facts require sources, known categories, and stay unavailable before reveal chapter', () => {
  const packageWithFacts = structuredClone(readingPackage)
  packageWithFacts.entities = [{
    id: 'place-real',
    name: '测试真实地点',
    kind: 'place',
    placeKind: 'real',
    revealAt: { chapterId: 'chapter-01' },
    sourceIds: ['source-weread-edition-metadata'],
    geometry: { type: 'point', latitude: 34, longitude: -85 },
  }]
  packageWithFacts.facts = [
    {
      id: 'fact-safe',
      kind: 'spatial',
      content: '这是一条纯空间事实。',
      entityIds: ['place-real'],
      revealAt: { chapterId: 'chapter-01' },
      riskLevel: SPOILER_RISK.SAFE,
      riskCategories: [],
      sourceIds: ['source-weread-edition-metadata'],
    },
    {
      id: 'fact-potential',
      kind: 'character',
      content: '这是一条需要确认的关系事实。',
      entityIds: ['place-real'],
      revealAt: { chapterId: 'chapter-03' },
      riskLevel: SPOILER_RISK.POTENTIAL,
      riskCategories: ['character_relationship'],
      sourceIds: ['source-weread-edition-metadata'],
    },
  ]
  assert.deepEqual(validateReadingPackage(packageWithFacts), [])
  assert.deepEqual(
    visibleReadingFacts(
      packageWithFacts.facts,
      'chapter-02',
      packageWithFacts.chapters,
    ).map(({ id }) => id),
    ['fact-safe'],
  )

  packageWithFacts.facts[1].riskCategories = ['model-written-free-text']
  const errors = validateReadingPackage(packageWithFacts)
  assert.ok(errors.some((error) => error.includes('未知风险类别')))
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
