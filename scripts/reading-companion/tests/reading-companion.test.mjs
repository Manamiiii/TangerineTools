import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  SPOILER_GATE_ACTION,
  SPOILER_RISK,
  canRevealRisk,
  clearObservedPlaceLocation,
  confirmObservedPlaceLocation,
  isRevealedAtChapter,
  matchOnDemandEntity,
  normalizeObservedEntityName,
  projectReadingPlaces,
  readingPlaceRelations,
  readerConfirmedMapEntities,
  readingStateKey,
  riskForDisclosure,
  scanOnDemandEntities,
  spoilerGateAction,
  strongestSpoilerRisk,
  unlockedOnDemandEntities,
  upsertObservedEntity,
  validateReadingPackage,
  visibleReadingEntities,
  visibleReadingFacts,
  visibleObservedEntities,
} from '../../../src/features/reading-companion/domain/readingCompanion.js'
import {
  buildReadingPreviewFromStaging,
  buildReadingPreviews,
} from '../lib/package-pipeline.mjs'
import {
  READING_MAP_PROVIDER,
  normalizeReadingMapProvider,
  readingMapTileSources,
} from '../../../src/features/reading-companion/map/mapConfig.js'
import {
  normalizeNominatimResults,
  normalizeTiandituResults,
  searchReadingPlaces,
} from '../../../src/features/reading-companion/map/geocoding.js'

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
    'src/features/reading-companion/components/ReadingGeoMap.jsx',
    'src/features/reading-companion/data/readingPackages.js',
    'src/features/reading-companion/db/readingState.js',
    'src/features/reading-companion/db/seed.js',
    'src/features/reading-companion/domain/readingCompanion.js',
    'src/features/reading-companion/map/geocoding.js',
    'src/features/reading-companion/map/mapConfig.js',
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

test('reading map providers keep international fallback and require a domestic browser key', () => {
  assert.equal(
    normalizeReadingMapProvider('unknown-provider'),
    READING_MAP_PROVIDER.INTERNATIONAL,
  )
  const internationalSources = readingMapTileSources(READING_MAP_PROVIDER.INTERNATIONAL)
  assert.equal(internationalSources.length, 1)
  assert.match(internationalSources[0].url, /openstreetmap/)

  assert.deepEqual(readingMapTileSources(READING_MAP_PROVIDER.DOMESTIC), [])
  const domesticSources = readingMapTileSources(
    READING_MAP_PROVIDER.DOMESTIC,
    ' key with spaces ',
  )
  assert.equal(domesticSources.length, 2)
  assert.match(domesticSources[0].url, /vec_w\/wmts/)
  assert.match(domesticSources[1].url, /cva_w\/wmts/)
  assert.ok(domesticSources.every((source) => source.url.includes('tk=key%20with%20spaces')))
})

test('map search adapters normalize international and domestic results without guessing coordinates', async () => {
  assert.deepEqual(normalizeNominatimResults([
    {
      place_id: 42,
      display_name: 'Atlanta, Fulton County, Georgia, United States',
      lat: '33.7489924',
      lon: '-84.3902644',
    },
    { place_id: 43, display_name: 'Invalid', lat: '999', lon: '0' },
  ]), [{
    id: '42',
    label: 'Atlanta, Fulton County, Georgia, United States',
    latitude: 33.7489924,
    longitude: -84.3902644,
    providerId: READING_MAP_PROVIDER.INTERNATIONAL,
  }])

  assert.deepEqual(normalizeTiandituResults({
    pois: [{
      hotPointID: 'tdt-1',
      name: '亚特兰大',
      eaddress: 'Atlanta',
      province: 'Georgia',
      lonlat: '-84.3902644,33.7489924',
    }],
  }), [{
    id: 'tdt-1',
    label: '亚特兰大 · Atlanta · Georgia',
    latitude: 33.7489924,
    longitude: -84.3902644,
    providerId: READING_MAP_PROVIDER.DOMESTIC,
  }])

  let requestedUrl = ''
  const results = await searchReadingPlaces({
    providerId: READING_MAP_PROVIDER.INTERNATIONAL,
    query: 'Atlanta',
    fetchImpl: async (url) => {
      requestedUrl = url
      return {
        ok: true,
        json: async () => [{
          place_id: 42,
          display_name: 'Atlanta, Georgia',
          lat: '33.7489924',
          lon: '-84.3902644',
        }],
      }
    },
  })
  assert.match(requestedUrl, /^https:\/\/nominatim\.openstreetmap\.org\/search\?/)
  assert.match(requestedUrl, /q=Atlanta/)
  assert.equal(results[0].label, 'Atlanta, Georgia')
  await assert.rejects(
    searchReadingPlaces({
      providerId: READING_MAP_PROVIDER.DOMESTIC,
      query: '亚特兰大',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /浏览器端 Key/,
  )
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

test('reading place relations calculate safe straight-line distance and direction', () => {
  const places = [
    {
      id: 'place-atlanta',
      name: '亚特兰大',
      geometry: { type: 'point', latitude: 33.7628947, longitude: -84.4220844 },
    },
    {
      id: 'place-jonesboro',
      name: '琼斯伯勒',
      geometry: { type: 'point', latitude: 33.5211498, longitude: -84.3546835 },
    },
    {
      id: 'place-fictional',
      name: '虚构地点',
      geometry: null,
    },
  ]
  const relations = readingPlaceRelations(places, 'place-atlanta')
  assert.equal(relations.length, 1)
  assert.equal(relations[0].id, 'place-jonesboro')
  assert.equal(relations[0].direction, '南')
  assert.ok(relations[0].distanceKm > 27 && relations[0].distanceKm < 28)
  assert.deepEqual(readingPlaceRelations(places, 'place-fictional'), [])
  assert.deepEqual(readingPlaceRelations(places, 'missing-place'), [])
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

test('reader-confirmed names use chapters without requiring book text or guessed facts', () => {
  const chapters = readingPackage.chapters
  const first = upsertObservedEntity([], {
    id: 'observed-tara',
    name: '  塔拉庄园  ',
    kind: 'place',
    firstSeenChapterId: 'chapter-03',
  }, chapters)
  assert.deepEqual(first, [{
    id: 'observed-tara',
    name: '塔拉庄园',
    kind: 'place',
    firstSeenChapterId: 'chapter-03',
  }])
  assert.equal(normalizeObservedEntityName('ＴＡＲＡ  '), 'tara')
  assert.deepEqual(visibleObservedEntities(first, 'chapter-02', chapters), [])
  assert.deepEqual(
    visibleObservedEntities(first, 'chapter-03', chapters).map(({ name }) => name),
    ['塔拉庄园'],
  )

  const unchanged = upsertObservedEntity(first, {
    id: 'observed-duplicate',
    name: '塔拉庄园',
    kind: 'place',
    firstSeenChapterId: 'chapter-05',
  }, chapters)
  assert.equal(unchanged, first)

  const correctedEarlier = upsertObservedEntity(first, {
    id: 'observed-duplicate',
    name: '塔拉庄园',
    kind: 'place',
    firstSeenChapterId: 'chapter-01',
  }, chapters)
  assert.equal(correctedEarlier.length, 1)
  assert.equal(correctedEarlier[0].id, 'observed-tara')
  assert.equal(correctedEarlier[0].firstSeenChapterId, 'chapter-01')
  assert.throws(
    () => upsertObservedEntity([], {
      id: 'invalid',
      name: '未知名称',
      kind: 'place',
      firstSeenChapterId: 'chapter-99',
    }, chapters),
    /已知章节/,
  )
})

test('a reader-confirmed geocoder result stays personal and follows the chapter boundary', () => {
  const observed = [{
    id: 'observed-savannah',
    name: '萨凡纳',
    kind: 'place',
    firstSeenChapterId: 'chapter-03',
  }]
  const located = confirmObservedPlaceLocation(observed, 'observed-savannah', {
    id: 'nominatim-1',
    label: 'Savannah, Georgia, United States',
    providerId: READING_MAP_PROVIDER.INTERNATIONAL,
    latitude: 32.0809,
    longitude: -81.0912,
  })
  assert.equal(observed[0].mapLocation, undefined)
  assert.equal(located[0].mapLocation.providerId, READING_MAP_PROVIDER.INTERNATIONAL)
  assert.deepEqual(readerConfirmedMapEntities(
    located,
    'chapter-02',
    readingPackage.chapters,
  ), [])
  const [mapEntity] = readerConfirmedMapEntities(
    located,
    'chapter-03',
    readingPackage.chapters,
  )
  assert.equal(mapEntity.id, 'reader-map:observed-savannah')
  assert.equal(mapEntity.accessMode, 'reader-confirmed-geocoder')
  assert.equal(mapEntity.placeKind, 'real')
  assert.deepEqual(mapEntity.geometry, {
    type: 'point',
    latitude: 32.0809,
    longitude: -81.0912,
  })
  const cleared = clearObservedPlaceLocation(located, 'observed-savannah')
  assert.equal(cleared[0].mapLocation, undefined)
  assert.equal(cleared[0].name, '萨凡纳')
  assert.equal(cleared[0].firstSeenChapterId, 'chapter-03')
  assert.throws(
    () => confirmObservedPlaceLocation(observed, 'observed-savannah', {
      label: 'Invalid',
      providerId: READING_MAP_PROVIDER.INTERNATIONAL,
      latitude: 200,
      longitude: 0,
    }),
    /纬度无效/,
  )
})

test('on-demand entities unlock only after an exact reader-confirmed name match', () => {
  const onDemandEntities = [{
    id: 'place-atlanta',
    name: '亚特兰大',
    originalName: 'Atlanta',
    aliases: ['亚特兰大市'],
    kind: 'place',
    placeKind: 'real',
    activation: 'exact-reader-input',
    sourceIds: ['source-weread-edition-metadata'],
    geometry: { type: 'point', latitude: 33.7628, longitude: -84.422 },
  }]
  assert.equal(
    matchOnDemandEntity(onDemandEntities, '亚特兰大', 'place')?.id,
    'place-atlanta',
  )
  assert.equal(
    matchOnDemandEntity(onDemandEntities, ' Atlanta ', 'place')?.id,
    'place-atlanta',
  )
  assert.equal(matchOnDemandEntity(onDemandEntities, '亚特兰', 'place'), null)
  assert.equal(matchOnDemandEntity(onDemandEntities, '亚特兰大', 'person'), null)

  const observed = [{
    id: 'observed-atlanta',
    name: '亚特兰大市',
    kind: 'place',
    firstSeenChapterId: 'chapter-03',
  }]
  assert.deepEqual(
    unlockedOnDemandEntities(
      onDemandEntities,
      observed,
      'chapter-02',
      readingPackage.chapters,
    ),
    [],
  )
  const [unlocked] = unlockedOnDemandEntities(
    onDemandEntities,
    observed,
    'chapter-03',
    readingPackage.chapters,
  )
  assert.equal(unlocked.id, 'place-atlanta')
  assert.equal(unlocked.readerConfirmedName, '亚特兰大市')
  assert.equal(unlocked.accessMode, 'reader-confirmed-exact-match')
  assert.deepEqual(unlocked.revealAt, { chapterId: 'chapter-03' })
})

test('local excerpt scanning only returns audited names that actually occur in the text', () => {
  const onDemandEntities = [
    {
      id: 'place-atlanta',
      name: '亚特兰大',
      originalName: 'Atlanta',
      aliases: ['亚特兰大市'],
      kind: 'place',
      placeKind: 'real',
    },
    {
      id: 'place-tara',
      name: '塔拉庄园',
      originalName: 'Tara',
      aliases: [],
      kind: 'place',
      placeKind: 'fictional',
    },
  ]

  assert.deepEqual(
    scanOnDemandEntities('她离开亚特兰大，想起塔拉庄园。', onDemandEntities)
      .map(({ entity, matchedTerm }) => [entity.id, matchedTerm]),
    [
      ['place-atlanta', '亚特兰大'],
      ['place-tara', '塔拉庄园'],
    ],
  )
  assert.deepEqual(scanOnDemandEntities('只写到亚特兰，还不是完整名称。', onDemandEntities), [])
  assert.deepEqual(scanOnDemandEntities('Atlantas is not Atlanta.', onDemandEntities)
    .map(({ entity, matchedTerm }) => [entity.id, matchedTerm]), [['place-atlanta', 'Atlanta']])
  assert.deepEqual(scanOnDemandEntities('Atlantas', onDemandEntities), [])
  assert.deepEqual(scanOnDemandEntities('这里没有任何已知名称。', onDemandEntities), [])
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
  assert.equal(preview.previewMeta.approvedSourceIds.length, 6)
  assert.equal(preview.previewMeta.pendingSourceIds.length, 4)
  assert.equal(preview.previewMeta.candidateEntityIds.length, 4)
  assert.equal(preview.previewMeta.candidateFactIds.length, 2)
  assert.equal(preview.previewMeta.onDemandEntityIds.length, 4)
  assert.equal(preview.researchCandidates.entities.length, 4)
  assert.equal(preview.researchCandidates.facts.length, 2)
  assert.equal(preview.package.onDemandEntities.length, 4)
  assert.deepEqual(preview.package.entities, [])
  assert.deepEqual(preview.package.facts, [])
  assert.deepEqual(
    preview.package.sources.map((source) => source.id),
    preview.previewMeta.approvedSourceIds,
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
    entityCandidates: [],
    factCandidates: [],
    onDemandEntities: [],
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

test('research candidates require provenance and blockers and never publish implicitly', () => {
  const staging = {
    schemaVersion: 1,
    slug: 'candidate-safety-test',
    order: 2,
    packageId: readingPackage.id,
    packageVersion: readingPackage.packageVersion,
    catalogEntry: { title: '候选安全测试', editionLabel: '测试版本' },
    sourceCandidates: [{
      id: 'candidate-source',
      status: 'candidate',
      kind: 'research',
      label: '候选来源',
    }],
    entityCandidates: [{
      status: 'candidate',
      entity: {
        id: 'place-unreviewed',
        name: '待审地点',
        kind: 'place',
        placeKind: 'real',
      },
      sourceIds: ['candidate-source'],
      blockers: ['missing_edition_chapter_evidence'],
    }],
    factCandidates: [],
    onDemandEntities: [],
    entities: [],
    facts: [],
    package: readingPackage,
  }
  const preview = buildReadingPreviewFromStaging(staging)
  assert.deepEqual(preview.previewMeta.candidateEntityIds, ['place-unreviewed'])
  assert.deepEqual(preview.package.entities, [])
  assert.deepEqual(preview.package.sources, [])

  staging.entityCandidates[0].blockers = []
  assert.throws(
    () => buildReadingPreviewFromStaging(staging),
    /待审候选必须说明阻塞项/,
  )

  staging.entityCandidates[0].blockers = ['missing_edition_chapter_evidence']
  staging.factCandidates = [{
    status: 'candidate',
    fact: {
      id: 'fact-unreviewed',
      kind: 'history',
      content: '待审事实',
      riskLevel: 'potential',
      riskCategories: ['free_text_category'],
    },
    sourceIds: ['candidate-source'],
    blockers: ['spoiler_boundary_requires_review'],
  }]
  assert.throws(
    () => buildReadingPreviewFromStaging(staging),
    /风险类别无效/,
  )
})
