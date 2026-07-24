import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertReadingPackage } from '../../../src/domain/readingCompanion.js'

export const repoRoot = path.resolve(import.meta.dirname, '../../..')
export const editionSlug = 'gone-with-the-wind-zh-9787570202188'
export const publicPackagePath = path.join(
  repoRoot,
  'public/presets/reading-companion',
  `${editionSlug}.json`,
)
export const stagingPath = path.join(
  repoRoot,
  'scripts/reading/data/staging',
  `${editionSlug}.json`,
)
export const previewPath = path.join(
  repoRoot,
  'scripts/reading/data/preview',
  `${editionSlug}.json`,
)
export const reportPath = path.join(
  repoRoot,
  'artifacts/reading-companion',
  `${editionSlug}-preview.md`,
)

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function validateSourceCandidates(sourceCandidates) {
  if (!Array.isArray(sourceCandidates) || sourceCandidates.length === 0) {
    throw new Error('staging.sourceCandidates 必须是非空数组')
  }
  const ids = new Set()
  for (const source of sourceCandidates) {
    if (!source?.id || !source?.kind || !source?.label) {
      throw new Error('资料源候选必须包含 id、kind 和 label')
    }
    if (!['approved', 'candidate', 'rejected'].includes(source.status)) {
      throw new Error(`资料源状态无效：${source.id}`)
    }
    if (ids.has(source.id)) throw new Error(`资料源 id 重复：${source.id}`)
    ids.add(source.id)
    if (source.url) new URL(source.url)
  }
}

function runtimeSource(source) {
  return Object.fromEntries(
    ['id', 'kind', 'label', 'organization', 'url', 'accessedAt', 'useFor', 'rightsStatus', 'notes']
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  )
}

export async function buildReadingPreview() {
  const [currentPackage, staging] = await Promise.all([
    readJson(publicPackagePath),
    readJson(stagingPath),
  ])
  assertReadingPackage(currentPackage)
  if (staging?.schemaVersion !== 1) throw new Error('staging.schemaVersion 必须为 1')
  if (staging.packageId !== currentPackage.id) throw new Error('staging.packageId 与正式资料包不一致')
  if (!staging.packageVersion) throw new Error('staging.packageVersion 不能为空')
  validateSourceCandidates(staging.sourceCandidates)
  if (!Array.isArray(staging.entities) || !Array.isArray(staging.facts)) {
    throw new Error('staging.entities 和 staging.facts 必须是数组')
  }

  const approvedSources = staging.sourceCandidates
    .filter((source) => source.status === 'approved')
    .map(runtimeSource)
  const nextPackage = assertReadingPackage({
    ...currentPackage,
    packageVersion: staging.packageVersion,
    sources: approvedSources,
    entities: staging.entities,
    facts: staging.facts,
  })
  return {
    previewMeta: {
      packageId: nextPackage.id,
      targetPath: `public/presets/reading-companion/${editionSlug}.json`,
      approvedSourceIds: approvedSources.map((source) => source.id),
      pendingSourceIds: staging.sourceCandidates
        .filter((source) => source.status === 'candidate')
        .map((source) => source.id),
      rejectedSourceIds: staging.sourceCandidates
        .filter((source) => source.status === 'rejected')
        .map((source) => source.id),
    },
    package: nextPackage,
  }
}
