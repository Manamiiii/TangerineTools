import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertReadingPackage } from '../../../src/features/reading-companion/domain/readingCompanion.js'

export const repoRoot = path.resolve(import.meta.dirname, '../../..')
export const publicRoot = path.join(repoRoot, 'public/presets/reading-companion')
export const stagingRoot = path.join(repoRoot, 'scripts/reading-companion/data/staging')
export const previewRoot = path.join(repoRoot, 'scripts/reading-companion/data/preview')
export const previewCatalogPath = path.join(previewRoot, 'catalog.json')
export const publicCatalogPath = path.join(publicRoot, 'catalog.json')
export const reportPath = path.join(
  repoRoot,
  'artifacts/reading-companion/package-preview.md',
)

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function packagePaths(slug) {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`资料包 slug 无效：${slug}`)
  return {
    publicPackagePath: path.join(publicRoot, `${slug}.json`),
    previewPackagePath: path.join(previewRoot, `${slug}.json`),
  }
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

function validateStaging(staging) {
  if (staging?.schemaVersion !== 1) throw new Error('staging.schemaVersion 必须为 1')
  if (!SLUG_PATTERN.test(staging.slug || '')) throw new Error('staging.slug 无效')
  if (!staging.packageId || !staging.packageVersion) {
    throw new Error('staging.packageId 和 staging.packageVersion 不能为空')
  }
  if (!staging.catalogEntry?.editionLabel) {
    throw new Error('staging.catalogEntry.editionLabel 不能为空')
  }
  if (!Number.isInteger(staging.order) || staging.order < 0) {
    throw new Error('staging.order 必须是非负整数')
  }
  validateSourceCandidates(staging.sourceCandidates)
  if (!Array.isArray(staging.entities) || !Array.isArray(staging.facts)) {
    throw new Error('staging.entities 和 staging.facts 必须是数组')
  }
  if (!staging.package && !staging.basePackagePath) {
    throw new Error('新书 staging 必须包含 package；已有书更新可以使用 basePackagePath')
  }
}

export function buildReadingPreviewFromStaging(staging, basePackage = null) {
  validateStaging(staging)
  const packageTemplate = staging.package || basePackage
  if (!packageTemplate) throw new Error(`资料包 ${staging.slug} 缺少基础 package`)
  if (packageTemplate.id !== staging.packageId) {
    throw new Error(`资料包 ${staging.slug} 的 packageId 与 package.id 不一致`)
  }

  const approvedSources = staging.sourceCandidates
    .filter((source) => source.status === 'approved')
    .map(runtimeSource)
  const nextPackage = assertReadingPackage({
    ...packageTemplate,
    packageVersion: staging.packageVersion,
    sources: approvedSources,
    entities: staging.entities,
    facts: staging.facts,
  })
  const { publicPackagePath } = packagePaths(staging.slug)
  return {
    previewMeta: {
      slug: staging.slug,
      order: staging.order,
      packageId: nextPackage.id,
      targetPath: path.relative(repoRoot, publicPackagePath).replaceAll('\\', '/'),
      approvedSourceIds: approvedSources.map((source) => source.id),
      pendingSourceIds: staging.sourceCandidates
        .filter((source) => source.status === 'candidate')
        .map((source) => source.id),
      rejectedSourceIds: staging.sourceCandidates
        .filter((source) => source.status === 'rejected')
        .map((source) => source.id),
    },
    catalogEntry: {
      id: nextPackage.id,
      title: staging.catalogEntry.title || nextPackage.book.title,
      editionLabel: staging.catalogEntry.editionLabel,
      path: `presets/reading-companion/${staging.slug}.json`,
    },
    package: nextPackage,
  }
}

async function loadBasePackage(staging) {
  if (staging.package) return null
  const basePath = path.resolve(repoRoot, staging.basePackagePath)
  const expectedRoot = `${path.resolve(publicRoot)}${path.sep}`
  if (!basePath.startsWith(expectedRoot)) {
    throw new Error(`basePackagePath 必须位于 public/presets/reading-companion：${staging.slug}`)
  }
  return readJson(basePath)
}

export async function discoverReadingStaging() {
  const files = (await readdir(stagingRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
  if (files.length === 0) throw new Error('没有可用的阅读资料 staging')

  const stagingItems = await Promise.all(
    files.map((file) => readJson(path.join(stagingRoot, file))),
  )
  const slugs = new Set()
  const orders = new Set()
  for (const staging of stagingItems) {
    validateStaging(staging)
    if (slugs.has(staging.slug)) throw new Error(`staging.slug 重复：${staging.slug}`)
    if (orders.has(staging.order)) throw new Error(`staging.order 重复：${staging.order}`)
    slugs.add(staging.slug)
    orders.add(staging.order)
  }
  return stagingItems.sort((a, b) => a.order - b.order)
}

export async function buildReadingPreviews() {
  const stagingItems = await discoverReadingStaging()
  const previews = []
  for (const staging of stagingItems) {
    const basePackage = await loadBasePackage(staging)
    previews.push(buildReadingPreviewFromStaging(staging, basePackage))
  }
  const packageIds = new Set()
  for (const preview of previews) {
    if (packageIds.has(preview.package.id)) {
      throw new Error(`资料包 id 重复：${preview.package.id}`)
    }
    packageIds.add(preview.package.id)
  }
  return {
    previews,
    catalog: {
      schemaVersion: 1,
      packages: previews.map((preview) => preview.catalogEntry),
    },
  }
}
