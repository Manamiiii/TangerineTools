// 统计视图的纯聚合逻辑。组件只负责选择数据源和渲染，便于独立回归分组语义。

import { stringifyCellValue } from '../utils.js'

const CATEGORICAL_FIELD_TYPES = new Set(['select', 'multiselect', 'boolean', 'reference', 'references', 'date'])
const LOW_VALUE_DEFAULT_TYPES = new Set(['stats', 'image', 'url', 'longtext'])

export function defaultStockGroupField(fields = []) {
  return fields.find((field) => CATEGORICAL_FIELD_TYPES.has(field.type))
    || fields.find((field) => !LOW_VALUE_DEFAULT_TYPES.has(field.type))
    || fields.find((field) => field.type !== 'stats')
    || null
}

export function stockOptionLabel(field, value) {
  if (field?.type === 'select') return field.options?.find((option) => option.value === value)?.label || value
  if (field?.type === 'multiselect') {
    const values = Array.isArray(value) ? value : []
    return values
      .map((item) => field.options?.find((option) => option.value === item)?.label || item)
      .filter(Boolean)
      .join(' / ')
  }
  return stringifyCellValue(value, field)
}

export function stockRowGroupKeys(row, field) {
  if (!field) return ['全部记录']
  const raw = row.values?.[field.key]
  if (field.type === 'multiselect') {
    const values = Array.isArray(raw) ? raw : []
    return values.length
      ? values.map((item) => field.options?.find((option) => option.value === item)?.label || item)
      : ['未填写']
  }
  const label = stockOptionLabel(field, raw)
  return label ? [label] : ['未填写']
}

export function buildStockSummary(rows = [], groupField = null, numberField = null, threshold = '') {
  const groups = new Map()
  const matchedRows = rows.filter((row) => {
    if (!numberField || threshold === '') return true
    const raw = row.values?.[numberField.key]
    if (raw == null || raw === '') return false
    const value = Number(raw)
    const minimum = Number(threshold)
    return Number.isFinite(value) && Number.isFinite(minimum) && value >= minimum
  })

  for (const row of matchedRows) {
    for (const key of stockRowGroupKeys(row, groupField)) groups.set(key, (groups.get(key) || 0) + 1)
  }

  return {
    total: rows.length,
    matched: matchedRows.length,
    groups: Array.from(groups.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  }
}
