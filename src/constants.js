// 全局常量：场景类型、字段类型、六维、配色板等。
// 保持数据结构简单、可扩展，避免过早引入复杂配置。

export const SCENE_TYPES = [
  { value: 'general', label: '通用', color: '#64748b' },
  { value: 'game', label: '游戏', color: '#2563eb' },
  { value: 'data', label: '资料', color: '#059669' },
]

export function sceneTypeLabel(value) {
  return SCENE_TYPES.find((t) => t.value === value)?.label || value
}

// 场景可启用的工具。三个工具目前均已落地，ready 字段仍然保留，
// 便于未来新增工具时先占位、再逐步实现。
export const SCENE_TOOLS = [
  { value: 'catalog', label: '资料库', ready: true },
  { value: 'stock', label: '属性库存', ready: true },
  { value: 'nature', label: '性格推荐', ready: true },
]

// 字段类型：资料表列的数据类型。
export const FIELD_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'longtext', label: '长文本' },
  { value: 'number', label: '数字' },
  { value: 'image', label: '图片' },
  { value: 'select', label: '单选' },
  { value: 'multiselect', label: '多选' },
  { value: 'boolean', label: '布尔' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: '日期' },
  { value: 'reference', label: '引用' },
  { value: 'stats', label: '六维图' },
]

export function fieldTypeLabel(value) {
  return FIELD_TYPES.find((t) => t.value === value)?.label || value
}

// 类型是否会在“新增/编辑行”表单里出现输入框。
// stats 是由其它数值字段派生出的可视化视图，本身没有可编辑的值。
export function isEditableFieldType(type) {
  return type !== 'stats'
}

// 类型是否支持“选项”（颜色 + 图片）配置。
export function isOptionFieldType(type) {
  return type === 'select' || type === 'multiselect'
}

// 六维图使用的六个维度。key 用于自动识别资料表中对应的原始数值字段。
export const STATS_DIMENSIONS = [
  { key: 'hp', label: '生命', aliases: ['hp', '生命', '体力'] },
  { key: 'patk', label: '物攻', aliases: ['patk', 'atk', '物攻', '物理攻击'] },
  { key: 'matk', label: '魔攻', aliases: ['matk', 'matk', '魔攻', '魔法攻击'] },
  { key: 'pdef', label: '物防', aliases: ['pdef', 'def', '物防', '物理防御'] },
  { key: 'mdef', label: '魔防', aliases: ['mdef', 'mdef', '魔防', '魔法防御'] },
  { key: 'spd', label: '速度', aliases: ['spd', 'speed', '速度'] },
]

// 六维图缩放使用的固定满值刻度，保证不同精灵之间的图形可比较。
export const STATS_SCALE_MAX = 150

// 场景 / 选项配色板，颜色数量克制，保证 UI 统一、不花哨。
export const COLOR_PALETTE = [
  '#64748b', // slate
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
]

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 20

// 用于识别“编号”字段以套用默认自然排序。
export const NUMBER_FIELD_NAMES = ['编号']
export const NUMBER_FIELD_KEYS = ['no', 'number']
