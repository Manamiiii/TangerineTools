// 属性库存工具的领域逻辑：固定字段定义、状态选项、统计纯函数。
// 库存复用资料库的 catalogFields/catalogRows 存储，字段类型仍是标准的
// text/number/select/longtext，因此可以直接复用 FieldInput/CellView 渲染，
// 不需要为库存单独实现一套字段/单元格组件。

export const STOCK_TABLE_NAME = '库存'

export const STOCK_STATUS_OPTIONS = [
  { value: 'todo', label: '未开始', color: '#64748b' },
  { value: 'inProgress', label: '培养中', color: '#d97706' },
  { value: 'done', label: '已完成', color: '#059669' },
]

// 库存资料表的固定字段，顺序即表格列顺序。key 为手动指定的稳定标识符
// （与预置资料的做法一致），不经过 deriveFieldKey 生成。
export const STOCK_FIXED_FIELDS = [
  { key: 'name', name: '名称', type: 'text' },
  { key: 'level', name: '等级', type: 'number' },
  { key: 'category', name: '分类', type: 'text' },
  { key: 'status', name: '状态', type: 'select', options: STOCK_STATUS_OPTIONS },
  { key: 'note', name: '备注', type: 'longtext' },
]

// 按分类分组计数，分类为空时归入"未分类"，按数量从高到低排序。
export function groupByCategory(rows) {
  const counts = new Map()
  for (const row of rows) {
    const raw = row.values?.category
    const label = raw && String(raw).trim() ? String(raw).trim() : '未分类'
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

// 数值型条件统计：等级达到（大于等于）threshold 的实例数量。
export function countByLevelAtLeast(rows, threshold) {
  const min = Number(threshold) || 0
  return rows.filter((row) => Number(row.values?.level) >= min).length
}

// 状态型统计：按三个固定状态值分别计数。
export function countByStatus(rows) {
  const counts = Object.fromEntries(STOCK_STATUS_OPTIONS.map((o) => [o.value, 0]))
  for (const row of rows) {
    const value = row.values?.status
    if (Object.prototype.hasOwnProperty.call(counts, value)) counts[value] += 1
  }
  return STOCK_STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.value] }))
}
