// 洛克王国资料表专用纯函数：识别"编号"字段、聚合同编号的不同形态行，
// 构建形态对比表格数据与摘要文案。不依赖 Dexie / React，便于复用与测试。

import { NUMBER_FIELD_KEYS, NUMBER_FIELD_NAMES } from '../constants.js'
import { optionLabel } from '../utils.js'

// 对比表格关心的数值维度：字段 key -> 展示名称，按种族值 + 六维顺序排列。
export const COMPARISON_NUMBER_DIMENSIONS = [
  { key: 'bst', label: '种族值' },
  { key: 'hp', label: '生命' },
  { key: 'patk', label: '物攻' },
  { key: 'matk', label: '魔攻' },
  { key: 'pdef', label: '物防' },
  { key: 'mdef', label: '魔防' },
  { key: 'spd', label: '速度' },
]

// 识别当前资料表的"编号"字段：优先按字段 key（no / number）识别，
// 找不到再按字段展示名"编号"识别；都没有则返回 null。
export function findNumberField(fields) {
  if (!Array.isArray(fields)) return null
  const byKey = fields.find((f) => NUMBER_FIELD_KEYS.includes(f.key))
  if (byKey) return byKey
  return fields.find((f) => NUMBER_FIELD_NAMES.includes(f.name)) || null
}

// 找出与当前行"编号"字段值相同的所有行（含当前行自身），按创建时间排序保证顺序稳定。
// 没有编号字段、或当前行编号为空时返回空数组（表示无法/无需对比）。
export function getSameNumberRows(currentRow, rows, fields) {
  const numberField = findNumberField(fields)
  if (!numberField || !currentRow) return []
  const currentNo = currentRow.values?.[numberField.key]
  if (currentNo == null || currentNo === '') return []
  return (rows || [])
    .filter((r) => r.values?.[numberField.key] === currentNo)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

// 基于同编号的行集合，构建对比表格数据：名称/形态 + 各数值维度（含最高/最低/相同标注）。
// 只有 2 行及以上才具备对比意义，否则返回空数组，调用方应据此隐藏对比区块。
export function buildFormComparisonRows(rows, fields) {
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(fields)) return []
  const fieldByKey = new Map(fields.map((f) => [f.key, f]))
  const formField = fieldByKey.get('form')
  const dims = COMPARISON_NUMBER_DIMENSIONS.filter((d) => fieldByKey.has(d.key))

  const extremes = new Map()
  for (const dim of dims) {
    const values = rows.map((r) => Number(r.values?.[dim.key]) || 0)
    const max = Math.max(...values)
    const min = Math.min(...values)
    extremes.set(dim.key, { max, min, allEqual: max === min })
  }

  return rows.map((row) => {
    const formValue = row.values?.form
    const formLabel = formField && formValue != null ? optionLabel(formField, formValue) : ''
    const stats = dims.map((dim) => {
      const value = Number(row.values?.[dim.key]) || 0
      const { max, min, allEqual } = extremes.get(dim.key)
      let mark = 'middle'
      if (allEqual) mark = 'same'
      else if (value === max) mark = 'highest'
      else if (value === min) mark = 'lowest'
      return { key: dim.key, label: dim.label, value, mark }
    })
    return {
      rowId: row.id,
      name: row.values?.name || '未命名',
      form: formLabel,
      stats,
    }
  })
}

// 根据对比行数据生成一句由数据驱动生成的摘要文案，概括各形态之间的关键差异。
export function buildFormComparisonSummary(comparisonRows) {
  if (!Array.isArray(comparisonRows) || comparisonRows.length < 2) return ''
  const segments = [`当前编号共有 ${comparisonRows.length} 个形态`]

  for (const dim of COMPARISON_NUMBER_DIMENSIONS) {
    const highest = comparisonRows.filter((row) =>
      row.stats.some((s) => s.key === dim.key && s.mark === 'highest'),
    )
    if (highest.length === 0) continue
    const names = highest.map((row) => row.name).join('/')
    const value = highest[0].stats.find((s) => s.key === dim.key)?.value
    segments.push(`最高${dim.label}为「${names}」的 ${value}`)
  }

  if (segments.length === 1) {
    segments.push('各形态数值完全相同')
  }

  return `${segments.join('，')}。`
}
