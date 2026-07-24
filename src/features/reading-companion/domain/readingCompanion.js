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

export const SPOILER_CATEGORY_LABELS = {
  location_significance: '地点的剧情意义',
  character_relationship: '人物关系',
  character_fate: '人物命运',
  future_event: '后续事件',
  historical_plot_link: '历史与剧情联系',
  route_significance: '路线的剧情意义',
  ending: '结局',
  identity_secret: '身份或核心秘密',
}

const VALID_RISK_LEVELS = new Set(Object.values(SPOILER_RISK))
const VALID_ENTITY_KINDS = new Set(['place', 'person', 'concept', 'event'])
const VALID_PLACE_KINDS = new Set(['real', 'fictional', 'prototype', 'approximate'])
const VALID_GEOMETRY_TYPES = new Set(['point', 'area'])
const VALID_FACT_KINDS = new Set(['spatial', 'character', 'plot', 'history', 'concept'])
const VALID_RISK_CATEGORIES = new Set(Object.keys(SPOILER_CATEGORY_LABELS))

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

export function isRevealedAtChapter(revealAt, currentChapterId, chapters) {
  if (!revealAt?.chapterId || !isNonEmptyString(currentChapterId) || !Array.isArray(chapters)) {
    return false
  }
  const revealIndex = chapterIndex(chapters, revealAt.chapterId)
  const currentIndex = chapterIndex(chapters, currentChapterId)
  return revealIndex >= 0 && currentIndex >= revealIndex
}

export function visibleReadingEntities(entities, currentChapterId, chapters) {
  if (!Array.isArray(entities)) return []
  return entities.filter((entity) => isRevealedAtChapter(
    entity?.revealAt,
    currentChapterId,
    chapters,
  ))
}

export function visibleReadingFacts(facts, currentChapterId, chapters) {
  if (!Array.isArray(facts)) return []
  return facts.filter((fact) => isRevealedAtChapter(
    fact?.revealAt,
    currentChapterId,
    chapters,
  ))
}

export function projectReadingPlaces(entities) {
  const places = (Array.isArray(entities) ? entities : [])
    .filter((entity) => entity?.kind === 'place' && entity.geometry)
    .map((entity) => ({
      id: entity.id,
      latitude: entity.geometry.latitude,
      longitude: entity.geometry.longitude,
    }))
    .filter(({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude))
  if (places.length === 0) return []

  const latitudes = places.map((place) => place.latitude)
  const longitudes = places.map((place) => place.longitude)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const latitudeSpan = maxLatitude - minLatitude
  const longitudeSpan = maxLongitude - minLongitude

  return places.map((place) => ({
    ...place,
    x: longitudeSpan === 0 ? 50 : 8 + ((place.longitude - minLongitude) / longitudeSpan) * 84,
    y: latitudeSpan === 0 ? 50 : 8 + ((maxLatitude - place.latitude) / latitudeSpan) * 84,
  }))
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
  const sourceIds = new Set()
  for (const [index, source] of (Array.isArray(pkg.sources) ? pkg.sources : []).entries()) {
    if (!isObject(source) || !isNonEmptyString(source.id)) {
      errors.push(`sources[${index}].id 不能为空`)
      continue
    }
    if (sourceIds.has(source.id)) errors.push(`来源 id 重复：${source.id}`)
    sourceIds.add(source.id)
  }
  const entityIds = new Set()
  for (const [index, entity] of (Array.isArray(pkg.entities) ? pkg.entities : []).entries()) {
    if (!isObject(entity) || !isNonEmptyString(entity.id)) {
      errors.push(`entities[${index}].id 不能为空`)
      continue
    }
    if (entityIds.has(entity.id)) errors.push(`实体 id 重复：${entity.id}`)
    entityIds.add(entity.id)
    if (!isNonEmptyString(entity.name)) errors.push(`entities[${index}].name 不能为空`)
    if (!VALID_ENTITY_KINDS.has(entity.kind)) errors.push(`entities[${index}].kind 无效`)
    if (!entity.revealAt?.chapterId || !chapterIds.has(entity.revealAt.chapterId)) {
      errors.push(`entities[${index}].revealAt 必须引用已知章节`)
    }
    if (!Array.isArray(entity.sourceIds) || entity.sourceIds.length === 0) {
      errors.push(`entities[${index}].sourceIds 必须是非空数组`)
    } else {
      for (const sourceId of entity.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          errors.push(`entities[${index}] 引用了未知来源：${sourceId}`)
        }
      }
    }
    if (entity.kind === 'place') {
      if (!VALID_PLACE_KINDS.has(entity.placeKind)) {
        errors.push(`entities[${index}].placeKind 无效`)
      }
      if (entity.geometry) {
        const { type, latitude, longitude, radiusKm } = entity.geometry
        if (!VALID_GEOMETRY_TYPES.has(type)) errors.push(`entities[${index}].geometry.type 无效`)
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
          errors.push(`entities[${index}].geometry.latitude 无效`)
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          errors.push(`entities[${index}].geometry.longitude 无效`)
        }
        if (type === 'area' && (!Number.isFinite(radiusKm) || radiusKm <= 0)) {
          errors.push(`entities[${index}].geometry.radiusKm 无效`)
        }
        if (entity.placeKind === 'fictional' && type === 'point') {
          errors.push(`entities[${index}] 的虚构地点不能伪造精确坐标`)
        }
      }
    }
  }
  const factIds = new Set()
  for (const [index, fact] of (Array.isArray(pkg.facts) ? pkg.facts : []).entries()) {
    if (!isObject(fact) || !isNonEmptyString(fact.id)) {
      errors.push(`facts[${index}].id 不能为空`)
      continue
    }
    if (factIds.has(fact.id)) errors.push(`事实 id 重复：${fact.id}`)
    factIds.add(fact.id)
    if (!VALID_FACT_KINDS.has(fact.kind)) errors.push(`facts[${index}].kind 无效`)
    if (!isNonEmptyString(fact.content)) errors.push(`facts[${index}].content 不能为空`)
    if (!VALID_RISK_LEVELS.has(fact.riskLevel)) {
      errors.push(`facts[${index}].riskLevel 无效`)
    }
    if (!fact.revealAt?.chapterId || !chapterIds.has(fact.revealAt.chapterId)) {
      errors.push(`facts[${index}].revealAt 必须引用已知章节`)
    }
    if (!Array.isArray(fact.entityIds)) {
      errors.push(`facts[${index}].entityIds 必须是数组`)
    }
    if (!Array.isArray(fact.sourceIds) || fact.sourceIds.length === 0) {
      errors.push(`facts[${index}].sourceIds 必须是非空数组`)
    } else {
      for (const sourceId of fact.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          errors.push(`facts[${index}] 引用了未知来源：${sourceId}`)
        }
      }
    }
    if (!Array.isArray(fact.riskCategories)) {
      errors.push(`facts[${index}].riskCategories 必须是数组`)
    } else {
      if (fact.riskLevel !== SPOILER_RISK.SAFE && fact.riskCategories.length === 0) {
        errors.push(`facts[${index}] 的潜在或高风险内容必须声明风险类别`)
      }
      for (const category of fact.riskCategories) {
        if (!VALID_RISK_CATEGORIES.has(category)) {
          errors.push(`facts[${index}] 使用了未知风险类别：${category}`)
        }
      }
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
