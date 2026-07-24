import {
  READING_PACKAGE_SCHEMA_VERSION,
  assertReadingPackage,
} from './readingCompanion.js'

const MAX_PERSONAL_CHAPTERS = 1000

function normalizedText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : ''
}

export function buildPersonalChapters({ chapterCount, chapterText }) {
  const pastedLabels = normalizedText(chapterText)
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
  const parsedCount = Number(chapterCount)
  const count = pastedLabels.length > 0 ? pastedLabels.length : parsedCount
  if (!Number.isInteger(count) || count < 1 || count > MAX_PERSONAL_CHAPTERS) {
    throw new Error(`章节数量必须是 1–${MAX_PERSONAL_CHAPTERS} 的整数`)
  }
  const width = Math.max(2, String(count).length)
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const pastedLabel = pastedLabels[index]
    const numericLabel = pastedLabel?.match(/^\d+$/)?.[0]
    return {
      id: `chapter-${String(number).padStart(width, '0')}`,
      number,
      label: numericLabel ? `第 ${Number(numericLabel)} 章` : pastedLabel || `第 ${number} 章`,
    }
  })
}

export function createPersonalReadingPackage(input) {
  const ids = {
    packageId: normalizedText(input?.packageId),
    bookId: normalizedText(input?.bookId),
    editionId: normalizedText(input?.editionId),
  }
  if (!ids.packageId || !ids.bookId || !ids.editionId) {
    throw new Error('个人书籍需要稳定的书籍、版本和资料包 id')
  }
  const title = normalizedText(input?.title)
  const author = normalizedText(input?.author)
  if (!title) throw new Error('请输入书名')
  if (!author) throw new Error('请输入作者')
  const chapters = buildPersonalChapters(input)
  const translators = normalizedText(input?.translators)
    .split(/[、,，]/)
    .map((name) => name.trim())
    .filter(Boolean)
  const pkg = {
    schemaVersion: READING_PACKAGE_SCHEMA_VERSION,
    packageVersion: '1.0.0-personal',
    id: ids.packageId,
    personal: true,
    book: {
      id: ids.bookId,
      title,
      author,
      originalLanguage: normalizedText(input?.originalLanguage) || 'unknown',
    },
    edition: {
      id: ids.editionId,
      isbn: normalizedText(input?.isbn) || `personal-${ids.editionId}`,
      language: normalizedText(input?.language) || 'zh-CN',
      publisher: normalizedText(input?.publisher) || '个人书架',
      publishedAt: normalizedText(input?.publishedAt) || '未知',
      translators,
      chapterCount: chapters.length,
    },
    chapters,
    entities: [],
    onDemandEntities: [],
    facts: [],
    sources: [],
  }
  return assertReadingPackage(pkg)
}

export function personalCatalogEntry(pkg) {
  return {
    id: pkg.id,
    title: pkg.book.title,
    editionLabel: [
      pkg.edition.publisher,
      pkg.edition.publishedAt,
    ].filter((value) => value && value !== '未知').join(' · ') || '个人书籍',
    source: 'personal',
  }
}
