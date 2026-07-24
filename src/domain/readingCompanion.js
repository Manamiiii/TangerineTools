export const READING_PACKAGE_SCHEMA_VERSION = 1

export const SPOILER_RISK = {
  SAFE: 'safe',
  POTENTIAL: 'potential',
  HIGH: 'high',
}

export const SPOILER_GATE_ACTION = {
  DISPLAY: 'display',
  WARN: 'warn',
  CONFIRM_TWICE: 'confirm-twice',
}

const VALID_RISK_LEVELS = new Set(Object.values(SPOILER_RISK))

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function readingStateKey(sceneId, editionId) {
  if (!isNonEmptyString(sceneId) || !isNonEmptyString(editionId)) {
    throw new Error('阅读状态需要有效的场景和版本 id')
  }
  return `readerState:${sceneId}:${editionId}`
}

export function chapterIndex(chapters, chapterId) {
  return chapters.findIndex((chapter) => chapter.id === chapterId)
}

export function riskForDisclosure({ riskLevel, revealAt, currentChapterId, chapters }) {
  const normalizedRisk = VALID_RISK_LEVELS.has(riskLevel) ? riskLevel : SPOILER_RISK.POTENTIAL
  if (!isNonEmptyString(currentChapterId) || !Array.isArray(chapters) || chapters.length === 0) {
    return normalizedRisk === SPOILER_RISK.HIGH ? SPOILER_RISK.HIGH : SPOILER_RISK.POTENTIAL
  }

  const currentIndex = chapterIndex(chapters, currentChapterId)
  const revealIndex = revealAt?.chapterId ? chapterIndex(chapters, revealAt.chapterId) : -1
  if (currentIndex < 0 || (revealAt?.chapterId && revealIndex < 0)) {
    return normalizedRisk === SPOILER_RISK.HIGH ? SPOILER_RISK.HIGH : SPOILER_RISK.POTENTIAL
  }
  if (revealIndex > currentIndex) {
    return normalizedRisk === SPOILER_RISK.HIGH ? SPOILER_RISK.HIGH : SPOILER_RISK.POTENTIAL
  }
  return normalizedRisk
}

export function spoilerGateAction(riskLevel) {
  if (riskLevel === SPOILER_RISK.SAFE) return SPOILER_GATE_ACTION.DISPLAY
  if (riskLevel === SPOILER_RISK.HIGH) return SPOILER_GATE_ACTION.CONFIRM_TWICE
  return SPOILER_GATE_ACTION.WARN
}

export function canRevealRisk(riskLevel, authorization = 'none') {
  if (riskLevel === SPOILER_RISK.SAFE) return true
  if (riskLevel === SPOILER_RISK.POTENTIAL) {
    return authorization === SPOILER_RISK.POTENTIAL || authorization === SPOILER_RISK.HIGH
  }
  return riskLevel === SPOILER_RISK.HIGH && authorization === SPOILER_RISK.HIGH
}

export function strongestSpoilerRisk(risks) {
  if (risks.includes(SPOILER_RISK.HIGH)) return SPOILER_RISK.HIGH
  if (risks.includes(SPOILER_RISK.POTENTIAL)) return SPOILER_RISK.POTENTIAL
  return SPOILER_RISK.SAFE
}

export function validateReadingPackage(pkg) {
  const errors = []
  if (!isObject(pkg)) return ['资料包必须是对象']
  if (pkg.schemaVersion !== READING_PACKAGE_SCHEMA_VERSION) {
    errors.push(`schemaVersion 必须为 ${READING_PACKAGE_SCHEMA_VERSION}`)
  }
  for (const key of ['id', 'packageVersion']) {
    if (!isNonEmptyString(pkg[key])) errors.push(`${key} 不能为空`)
  }
  for (const [parent, fields] of [
    ['book', ['id', 'title', 'author', 'originalLanguage']],
    ['edition', ['id', 'isbn', 'language', 'publisher', 'publishedAt']],
  ]) {
    if (!isObject(pkg[parent])) {
      errors.push(`${parent} 必须是对象`)
      continue
    }
    for (const field of fields) {
      if (!isNonEmptyString(pkg[parent][field])) errors.push(`${parent}.${field} 不能为空`)
    }
  }

  if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) {
    errors.push('chapters 必须是非空数组')
  } else {
    const chapterIds = new Set()
    for (const [index, chapter] of pkg.chapters.entries()) {
      if (!isObject(chapter)) {
        errors.push(`chapters[${index}] 必须是对象`)
        continue
      }
      if (!isNonEmptyString(chapter.id)) errors.push(`chapters[${index}].id 不能为空`)
      if (!Number.isInteger(chapter.number) || chapter.number < 1) {
        errors.push(`chapters[${index}].number 必须是正整数`)
      }
      if (!isNonEmptyString(chapter.label)) errors.push(`chapters[${index}].label 不能为空`)
      if (chapterIds.has(chapter.id)) errors.push(`章节 id 重复：${chapter.id}`)
      chapterIds.add(chapter.id)
    }
    if (Number.isInteger(pkg.edition?.chapterCount) && pkg.edition.chapterCount !== pkg.chapters.length) {
      errors.push('edition.chapterCount 与 chapters 数量不一致')
    }
  }

  for (const key of ['entities', 'facts', 'sources']) {
    if (!Array.isArray(pkg[key])) errors.push(`${key} 必须是数组`)
  }

  const chapterIds = new Set(Array.isArray(pkg.chapters) ? pkg.chapters.map((chapter) => chapter?.id) : [])
  const entityIds = new Set(Array.isArray(pkg.entities) ? pkg.entities.map((entity) => entity?.id) : [])
  for (const [index, fact] of (Array.isArray(pkg.facts) ? pkg.facts : []).entries()) {
    if (!isObject(fact) || !isNonEmptyString(fact.id)) {
      errors.push(`facts[${index}].id 不能为空`)
      continue
    }
    if (!VALID_RISK_LEVELS.has(fact.riskLevel)) {
      errors.push(`facts[${index}].riskLevel 无效`)
    }
    if (fact.revealAt?.chapterId && !chapterIds.has(fact.revealAt.chapterId)) {
      errors.push(`facts[${index}].revealAt 引用了未知章节`)
    }
    for (const entityId of fact.entityIds || []) {
      if (!entityIds.has(entityId)) errors.push(`facts[${index}] 引用了未知实体：${entityId}`)
    }
  }
  return errors
}

export function assertReadingPackage(pkg) {
  const errors = validateReadingPackage(pkg)
  if (errors.length > 0) throw new Error(`阅读资料包无效：${errors.join('；')}`)
  return pkg
}
