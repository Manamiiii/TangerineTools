import { assertReadingPackage } from '../domain/readingCompanion.js'

const catalogUrl = `${import.meta.env.BASE_URL}presets/reading-companion/catalog.json`

async function fetchJson(url, label) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${label}加载失败（${response.status}）`)
  return response.json()
}

export async function loadReadingPackageCatalog() {
  const catalog = await fetchJson(catalogUrl, '阅读资料目录')
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.packages)) {
    throw new Error('阅读资料目录格式无效')
  }
  return catalog.packages
}

export async function loadReadingPackage(entry) {
  if (!entry?.path) throw new Error('阅读资料目录缺少资料包路径')
  const url = `${import.meta.env.BASE_URL}${entry.path}`
  return assertReadingPackage(await fetchJson(url, '阅读资料包'))
}
