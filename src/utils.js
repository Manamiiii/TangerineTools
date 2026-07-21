// 通用工具函数：ID/时间、字段与选项归一化、六维解析、
// 搜索/筛选/排序、分页等。保持纯函数、不依赖 Dexie。

import { NUMBER_FIELD_KEYS, NUMBER_FIELD_NAMES, STATS_DIMENSIONS } from './constants.js'

export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// 根据字段展示名生成一个稳定、唯一的字段 key。
export function deriveFieldKey(name, existingKeys = []) {
  let base = String(name || 'field')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base) base = 'field'
  let key = base
  let i = 1
  while (existingKeys.includes(key)) {
    key = `${base}_${i}`
    i += 1
  }
  return key
}

export function normalizeOption(opt) {
  if (typeof opt === 'string') {
    return { value: opt, label: opt, color: '', image: '' }
  }
  return {
    value: opt.value ?? opt.label ?? '',
    label: opt.label ?? opt.value ?? '',
    color: opt.color || '',
    image: opt.image || '',
  }
}

// 合并字段的选项列表：预置里新增的选项会被补齐（本地没有才追加）；
// 本地已有的选项里，如果其 label/color 仍完全等于 legacyDefaults 记录的
// 旧默认值（即用户没有手动改过），会被更新为预置的最新展示名/颜色；
// 已被用户修改过的选项、以及预置里没有的本地自定义选项都保持原样不变。
export function mergeFieldOptions(existingOptions, presetOptions, legacyDefaults = {}) {
  const existing = Array.isArray(existingOptions) ? existingOptions : []
  const preset = Array.isArray(presetOptions) ? presetOptions : []
  const presetByValue = new Map(preset.map((opt) => [opt.value, opt]))

  const merged = existing.map((opt) => {
    const presetOpt = presetByValue.get(opt.value)
    const legacy = legacyDefaults[opt.value]
    const legacyLabels = legacy?.labels || [legacy?.label]
    const legacyImages = legacy?.images || [opt.image || '']
    if (
      presetOpt &&
      legacy &&
      legacyLabels.includes(opt.label) &&
      opt.color === legacy.color &&
      legacyImages.includes(opt.image || '')
    ) {
      return { ...opt, label: presetOpt.label, color: presetOpt.color, image: presetOpt.image || '' }
    }
    return opt
  })

  const existingValues = new Set(existing.map((opt) => opt.value))
  for (const presetOpt of preset) {
    if (!existingValues.has(presetOpt.value)) {
      merged.push({ ...presetOpt })
    }
  }

  return merged
}

export function normalizeField(field) {
  return {
    id: field.id,
    tableId: field.tableId,
    key: field.key,
    name: field.name || field.key,
    type: field.type || 'text',
    order: field.order ?? 0,
    hidden: !!field.hidden,
    options: Array.isArray(field.options) ? field.options.map(normalizeOption) : [],
    statsMap: field.statsMap && typeof field.statsMap === 'object' ? field.statsMap : {},
    statsDimensions: Array.isArray(field.statsDimensions) ? field.statsDimensions : [],
    statsStyle: field.statsStyle === 'radar' ? 'radar' : 'bars',
    referenceTableId: field.referenceTableId || null,
    createdAt: field.createdAt || nowIso(),
    updatedAt: field.updatedAt || nowIso(),
  }
}

export function optionLabel(field, value) {
  const opt = field.options?.find((o) => o.value === value)
  return opt ? opt.label : value == null ? '' : String(value)
}

export function stringifyCellValue(raw, field) {
  if (raw == null || raw === '') return ''
  if (field.type === 'multiselect' && Array.isArray(raw)) {
    return raw.map((v) => optionLabel(field, v)).join(' ')
  }
  if (field.type === 'select') {
    return optionLabel(field, raw)
  }
  if (field.type === 'boolean') {
    return raw ? '是' : '否'
  }
  return String(raw)
}


function isBlankSortValue(value) {
  return value == null || value === ''
}

function numericSortValue(value) {
  if (isBlankSortValue(value)) return null
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(numeric) ? numeric : null
}

function compareNumberValues(a, b, direction = 'asc') {
  const av = numericSortValue(a)
  const bv = numericSortValue(b)
  const aBlank = av == null
  const bBlank = bv == null
  if (aBlank && bBlank) return 0
  if (aBlank) return 1
  if (bBlank) return -1
  const dir = direction === 'desc' ? -1 : 1
  return (av - bv) * dir
}

// 自然排序比较：数字段落按数值比较，其余按本地化字符串比较。
export function naturalCompare(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const as = String(a)
  const bs = String(b)
  const chunkRe = /(\d+|\D+)/g
  const aParts = as.match(chunkRe) || []
  const bParts = bs.match(chunkRe) || []
  const len = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < len; i += 1) {
    const ap = aParts[i]
    const bp = bParts[i]
    if (ap === undefined) return -1
    if (bp === undefined) return 1
    const aIsNum = /^\d+$/.test(ap)
    const bIsNum = /^\d+$/.test(bp)
    if (aIsNum && bIsNum) {
      const diff = Number(ap) - Number(bp)
      if (diff !== 0) return diff
    } else {
      const cmp = ap.localeCompare(bp, 'zh-Hans-CN')
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

// 按 key 优先、name 兜底的方式在字段列表中查找目标字段。
// 用于跨预置/自定义资料表通用地定位「特性标签」「名称」「形态」等字段，
// 不依赖某一套具体的资料表结构。
export function findFieldByKeyOrName(fields, keys = [], names = []) {
  const byKey = fields.find((f) => keys.includes(f.key))
  if (byKey) return byKey
  return fields.find((f) => names.includes(f.name)) || null
}

export function findDefaultSortField(fields) {
  return fields.find(
    (f) => NUMBER_FIELD_NAMES.includes(f.name) || NUMBER_FIELD_KEYS.includes(f.key),
  )
}

export function compareRowsBySort(a, b, sort, fields) {
  if (sort && sort.fieldKey) {
    const field = fields.find((f) => f.key === sort.fieldKey)
    if (field?.type === 'number') {
      return compareNumberValues(a.values?.[sort.fieldKey], b.values?.[sort.fieldKey], sort.direction)
    }
    const dir = sort.direction === 'desc' ? -1 : 1
    return naturalCompare(a.values?.[sort.fieldKey], b.values?.[sort.fieldKey]) * dir
  }
  const defaultField = findDefaultSortField(fields)
  if (defaultField) {
    return defaultField.type === 'number'
      ? compareNumberValues(a.values?.[defaultField.key], b.values?.[defaultField.key], 'asc')
      : naturalCompare(a.values?.[defaultField.key], b.values?.[defaultField.key])
  }
  return naturalCompare(a.createdAt, b.createdAt)
}

// 解析指标视图字段实际读取的列：优先使用手动配置的 statsMap，
// 否则按字段 key / 名称自动识别。
export function resolveStatsMapping(fields, statsMap = {}, statsDimensions = []) {
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const result = {}
  const dimensions = Array.isArray(statsDimensions) && statsDimensions.length > 0 ? statsDimensions : STATS_DIMENSIONS
  for (const dim of dimensions) {
    const mapped = dim.fieldKey || statsMap?.[dim.key]
    if (mapped && byKey.has(mapped)) {
      result[dim.key] = mapped
      continue
    }
    const match = fields.find((f) => {
      const key = (f.key || '').toLowerCase()
      const name = (f.name || '').toLowerCase()
      const aliases = dim.aliases || [dim.key, dim.label]
      return aliases.some((alias) => key === String(alias).toLowerCase() || name === String(alias).toLowerCase())
    })
    result[dim.key] = match ? match.key : null
  }
  return result
}

export function getStatsValues(fields, statsMap, values, statsDimensions = []) {
  const dimensions = Array.isArray(statsDimensions) && statsDimensions.length > 0 ? statsDimensions : STATS_DIMENSIONS
  const mapping = resolveStatsMapping(fields, statsMap, dimensions)
  return dimensions.map((dim) => ({
    key: dim.key,
    label: dim.label,
    value: Number(values?.[mapping[dim.key]]) || 0,
  }))
}

export function rowMatchesSearch(row, fields, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => {
    if (field.type === 'stats') return false
    const text = stringifyCellValue(row.values?.[field.key], field)
    return text.toLowerCase().includes(q)
  })
}

export function rowMatchesFilters(row, fields, filters) {
  if (!filters) return true
  return Object.entries(filters).every(([fieldKey, cond]) => {
    if (!cond) return true
    const field = fields.find((f) => f.key === fieldKey)
    if (!field) return true
    const raw = row.values?.[fieldKey]
    switch (field.type) {
      case 'number': {
        const num = Number(raw)
        if (cond.min !== '' && cond.min != null && !(num >= Number(cond.min))) return false
        if (cond.max !== '' && cond.max != null && !(num <= Number(cond.max))) return false
        return true
      }
      case 'select': {
        if (!cond.values || cond.values.length === 0) return true
        return cond.values.includes(raw)
      }
      case 'multiselect': {
        if (!cond.values || cond.values.length === 0) return true
        const arr = Array.isArray(raw) ? raw : []
        return arr.some((v) => cond.values.includes(v))
      }
      case 'boolean': {
        if (cond.value == null) return true
        return !!raw === cond.value
      }
      case 'date': {
        if (!raw) return !cond.from && !cond.to
        if (cond.from && raw < cond.from) return false
        if (cond.to && raw > cond.to) return false
        return true
      }
      default: {
        if (!cond.contains) return true
        return String(raw ?? '')
          .toLowerCase()
          .includes(String(cond.contains).toLowerCase())
      }
    }
  })
}

export function hasActiveFilters(filters) {
  if (!filters) return false
  return Object.values(filters).some((cond) => {
    if (!cond) return false
    if (cond.contains) return true
    if (cond.min !== '' && cond.min != null) return true
    if (cond.max !== '' && cond.max != null) return true
    if (cond.values && cond.values.length > 0) return true
    if (cond.value != null) return true
    if (cond.from || cond.to) return true
    return false
  })
}

export function paginate(list, page, pageSize) {
  const start = (page - 1) * pageSize
  return list.slice(start, start + pageSize)
}

export function totalPages(count, pageSize) {
  return Math.max(1, Math.ceil(count / pageSize))
}
