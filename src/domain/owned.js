// 收集记录工具的领域逻辑：固定字段定义、选项常量、统计纯函数。
// 与「统计视图」的思路互补：统计视图回答"我拥有多少能达到条件的个体"，
// 收集记录回答"我具体拥有哪一只、它现在是什么状态"。
//
// 存储上和资料库、统计视图共用 catalogTables/catalogFields/catalogRows，
// 通过 kind: 'owned' 区分，字段类型仍是标准的 reference/text/number/select/date/longtext，
// 因此可以直接复用 catalog 里的 FieldInput/CellView 渲染。

export const OWNED_TABLE_NAME = '收集记录'

// 血脉：洛克王国里常见的四种血脉分类。颜色与选项配色板保持一致，
// 避免和状态/异色的配色冲突。
export const OWNED_BLOODLINE_OPTIONS = [
  { value: 'leader', label: '首领', color: '#dc2626' },
  { value: 'polluted', label: '污染', color: '#7c3aed' },
  { value: 'strange', label: '奇异', color: '#0891b2' },
  { value: 'normal', label: '普通', color: '#64748b' },
]

// 状态：反映用户培养一只具体精灵的进度阶段。
// - owned：已拥有但尚未开始培养
// - training：正在培养（练级、洗性格等）
// - backup：作为备用/替补留存
// - target：暂未拥有但列入下一步捕获目标
export const OWNED_STATUS_OPTIONS = [
  { value: 'owned', label: '已拥有', color: '#059669' },
  { value: 'training', label: '培养中', color: '#d97706' },
  { value: 'backup', label: '备用', color: '#64748b' },
  { value: 'target', label: '目标', color: '#2563eb' },
]

// 异色：以 select 而非 boolean 存储，为了在表格里直接以彩色标签展示,
// 与预置资料表 shiny 字段的新格式（yes/no）保持一致。
export const OWNED_SHINY_OPTIONS = [
  { value: 'no', label: '非异色', color: '#64748b' },
  { value: 'yes', label: '异色', color: '#db2777' },
]

// 性格方向：仅记录用户为这只精灵最终选定的强化方向（五维之一）。
// 与「性格推荐」工具的推荐结果对齐——那里给出一组 raise/lower 组合，
// 这里只落一个"主强化维度"，避免手工录入过于繁琐。
export const OWNED_NATURE_DIRECTION_OPTIONS = [
  { value: 'patk', label: '物攻强化', color: '#dc2626' },
  { value: 'matk', label: '魔攻强化', color: '#7c3aed' },
  { value: 'pdef', label: '物防强化', color: '#059669' },
  { value: 'mdef', label: '魔防强化', color: '#0891b2' },
  { value: 'spd', label: '速度强化', color: '#d97706' },
  { value: 'balanced', label: '均衡', color: '#64748b' },
]

// 洛克王国收集记录的预置字段，顺序即表格列顺序。
// key 手工指定稳定标识符（不经过 deriveFieldKey），便于统计函数直接取值。
// ref 字段的 refTableKind/refTableName 由 ensureOwnedTable 在运行时补齐，
// 因为它需要绑定到当前场景里的普通资料表（例如洛克王国的"精灵图鉴"）。
export const ROCK_KINGDOM_COLLECTION_FIELDS = [
  { key: 'ref', name: '精灵', type: 'reference' },
  { key: 'nickname', name: '昵称/标记', type: 'text' },
  { key: 'level', name: '等级', type: 'number' },
  { key: 'natureDirection', name: '性格方向', type: 'select', options: OWNED_NATURE_DIRECTION_OPTIONS },
  { key: 'bloodline', name: '血脉', type: 'select', options: OWNED_BLOODLINE_OPTIONS },
  { key: 'status', name: '状态', type: 'select', options: OWNED_STATUS_OPTIONS },
  { key: 'shiny', name: '异色', type: 'select', options: OWNED_SHINY_OPTIONS },
  { key: 'acquiredAt', name: '获取日期', type: 'date' },
  { key: 'note', name: '备注', type: 'longtext' },
]

// 按状态计数：未落到定义选项的值不计入，避免脏数据把统计条数虚增。
export function countByStatus(rows) {
  const counts = Object.fromEntries(OWNED_STATUS_OPTIONS.map((o) => [o.value, 0]))
  for (const row of rows) {
    const value = row.values?.status
    if (Object.prototype.hasOwnProperty.call(counts, value)) counts[value] += 1
  }
  return OWNED_STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.value] }))
}

// 按血脉计数：与状态同构，返回顺序固定为选项定义顺序。
export function countByBloodline(rows) {
  const counts = Object.fromEntries(OWNED_BLOODLINE_OPTIONS.map((o) => [o.value, 0]))
  for (const row of rows) {
    const value = row.values?.bloodline
    if (Object.prototype.hasOwnProperty.call(counts, value)) counts[value] += 1
  }
  return OWNED_BLOODLINE_OPTIONS.map((o) => ({ ...o, count: counts[o.value] }))
}

// 异色计数：只关心"是"的数量，历史 boolean 数据（true）也算异色以兼容旧数据。
export function countShiny(rows) {
  let shiny = 0
  for (const row of rows) {
    const value = row.values?.shiny
    if (value === 'yes' || value === true) shiny += 1
  }
  return shiny
}

// 综合行搜索：昵称/备注/等级三个字段的字面量匹配，供列表搜索框使用。
// 引用字段（精灵）需要在组件层结合被引用表的 name 才能匹配，此处不介入。
export function matchesOwnedSearch(row, keyword) {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return true
  const values = row.values || {}
  const haystack = [values.nickname, values.note, values.level]
    .map((v) => (v == null ? '' : String(v).toLowerCase()))
    .join('\n')
  return haystack.includes(kw)
}
