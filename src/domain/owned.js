// 收集记录工具的领域逻辑：固定字段定义、选项常量、统计纯函数。
// 与「统计视图」的思路互补：统计视图回答"我拥有多少能达到条件的个体"，
// 收集记录回答"我具体拥有哪一只、它有哪些个体属性"。
//
// 存储上和资料库、统计视图共用 catalogTables/catalogFields/catalogRows，
// 通过 kind: 'owned' 区分，字段类型仍是标准的 reference/text/number/select/date/longtext，
// 因此可以直接复用 catalog 里的 FieldInput/CellView 渲染。

export const OWNED_TABLE_NAME = '收集记录'

const ELEMENT_BLOODLINE_OPTIONS = [
  ['normal', '普通', '#94a3b8'],
  ['grass', '草', '#22c55e'],
  ['fire', '火', '#f97316'],
  ['water', '水', '#38bdf8'],
  ['light', '光', '#facc15'],
  ['earth', '地', '#a16207'],
  ['ice', '冰', '#67e8f9'],
  ['dragon', '龙', '#d946ef'],
  ['electric', '电', '#eab308'],
  ['poison', '毒', '#a855f7'],
  ['bug', '虫', '#84cc16'],
  ['fighting', '武', '#b91c1c'],
  ['flying', '翼', '#60a5fa'],
  ['cute', '萌', '#f472b6'],
  ['ghost', '幽', '#334155'],
  ['dark', '恶', '#6b21a8'],
  ['mech', '机械', '#64748b'],
  ['illusion', '幻', '#7c3aed'],
]

// 血脉：保留首领/污染/奇异，并补充洛克王国 18 系作为血脉分类。
export const OWNED_BLOODLINE_OPTIONS = [
  { value: 'leader', label: '首领', color: '#dc2626' },
  { value: 'polluted', label: '污染', color: '#7c3aed' },
  { value: 'strange', label: '奇异', color: '#0891b2' },
  ...ELEMENT_BLOODLINE_OPTIONS.map(([value, label, color]) => ({
    value: `element-${value}`,
    label: `${label}系`,
    color,
  })),
]

export const OWNED_SHINY_OPTIONS = [
  { value: 'no', label: '非异色', color: '#64748b' },
  { value: 'yes', label: '异色', color: '#db2777' },
]

export const OWNED_COLORFUL_OPTIONS = [
  { value: 'no', label: '非炫彩', color: '#64748b' },
  { value: 'yes', label: '炫彩', color: '#db2777' },
]

export const OWNED_GENDER_OPTIONS = [
  { value: 'male', label: '公', color: '#2563eb' },
  { value: 'female', label: '母', color: '#db2777' },
]

export const OWNED_SPECIALTY_OPTIONS = [
  { value: 'mercy', label: '慈悲为怀', color: '#059669' },
  { value: 'brave', label: '勇敢', color: '#dc2626' },
  { value: 'homebody', label: '家里蹲', color: '#64748b' },
  { value: 'dexterous', label: '灵巧', color: '#0891b2' },
  { value: 'rideTogether', label: '同乘', color: '#2563eb' },
  { value: 'intimate', label: '亲密', color: '#db2777' },
  { value: 'sharing', label: '爱分享', color: '#d97706' },
  { value: 'swift', label: '疾行', color: '#0d9488' },
  { value: 'raid', label: '奇袭', color: '#7c3aed' },
  { value: 'mentor', label: '热心教', color: '#ea580c' },
]

const NATURE_COLOR_BY_RAISE = {
  魔攻: '#7c3aed',
  物攻: '#dc2626',
  魔防: '#0891b2',
  物防: '#059669',
  生命: '#2563eb',
  速度: '#d97706',
}

function makeNature(value, name, raise, lower) {
  return { value, label: `${name}（+${raise} -${lower}）`, color: NATURE_COLOR_BY_RAISE[raise] }
}

export const OWNED_NATURE_OPTIONS = [
  makeNature('clever', '聪明', '魔攻', '物攻'),
  makeNature('focused', '专注', '魔攻', '物防'),
  makeNature('paranoid', '偏执', '魔攻', '魔防'),
  makeNature('calm', '冷静', '魔攻', '速度'),
  makeNature('rational', '理性', '魔攻', '生命'),
  makeNature('bold', '大胆', '物攻', '物防'),
  makeNature('adamant', '固执', '物攻', '魔攻'),
  makeNature('naughty', '调皮', '物攻', '魔防'),
  makeNature('brave', '勇敢', '物攻', '速度'),
  makeNature('unyielding', '逞强', '物攻', '生命'),
  makeNature('vigilant', '警惕', '魔防', '物攻'),
  makeNature('gentle', '温顺', '魔防', '物防'),
  makeNature('shy', '害羞', '魔防', '魔攻'),
  makeNature('careful', '慎重', '魔防', '速度'),
  makeNature('anxious', '焦虑', '魔防', '生命'),
  makeNature('steady', '稳重', '物防', '物攻'),
  makeNature('naive', '天真', '物防', '魔攻'),
  makeNature('lazy', '懒散', '物防', '魔防'),
  makeNature('relaxed', '悠闲', '物防', '速度'),
  makeNature('frank', '坦率', '物防', '生命'),
  makeNature('silent', '沉默', '生命', '物攻'),
  makeNature('melancholy', '忧郁', '生命', '物防'),
  makeNature('peaceful', '平和', '生命', '魔攻'),
  makeNature('careless', '粗心', '生命', '魔防'),
  makeNature('practical', '踏实', '生命', '速度'),
  makeNature('timid', '胆小', '速度', '物攻'),
  makeNature('hasty', '急躁', '速度', '物防'),
  makeNature('cheerful', '开朗', '速度', '魔攻'),
  makeNature('rash', '莽撞', '速度', '魔防'),
  makeNature('passionate', '热情', '速度', '生命'),
]

// 洛克王国收集记录的预置字段，顺序即表格列顺序。
// key 手工指定稳定标识符（不经过 deriveFieldKey），便于统计函数直接取值。
// ref 字段的 refTableKind/refTableName 由 ensureOwnedTable 在运行时补齐，
// 因为它需要绑定到当前场景里的普通资料表（例如洛克王国的"精灵图鉴"）。
export const ROCK_KINGDOM_COLLECTION_FIELDS = [
  { key: 'ref', name: '精灵', type: 'reference' },
  { key: 'nature', name: '性格', type: 'select', options: OWNED_NATURE_OPTIONS },
  { key: 'bloodline', name: '血脉', type: 'select', options: OWNED_BLOODLINE_OPTIONS },
  { key: 'shiny', name: '是否异色', type: 'select', options: OWNED_SHINY_OPTIONS },
  { key: 'colorful', name: '是否炫彩', type: 'select', options: OWNED_COLORFUL_OPTIONS },
  { key: 'specialty', name: '特长', type: 'select', options: OWNED_SPECIALTY_OPTIONS },
  { key: 'gender', name: '性别', type: 'select', options: OWNED_GENDER_OPTIONS },
  { key: 'note', name: '备注', type: 'longtext' },
]

// 按血脉计数：返回顺序固定为选项定义顺序。
export function countByBloodline(rows) {
  const counts = Object.fromEntries(OWNED_BLOODLINE_OPTIONS.map((o) => [o.value, 0]))
  for (const row of rows) {
    const value = row.values?.bloodline
    if (Object.prototype.hasOwnProperty.call(counts, value)) counts[value] += 1
  }
  return OWNED_BLOODLINE_OPTIONS.map((o) => ({ ...o, count: counts[o.value] }))
}

// 炫彩计数：只关心“是”的数量；历史 shiny/boolean 数据也兼容计入。
export function countShiny(rows) {
  let colorful = 0
  for (const row of rows) {
    const value = row.values?.colorful ?? row.values?.shiny
    if (value === 'yes' || value === true) colorful += 1
  }
  return colorful
}

// 综合行搜索：对收集记录当前值做字面量匹配，供列表搜索框使用。
// 引用字段（精灵）需要在组件层结合被引用表的 name 才能匹配，此处不介入。
export function matchesOwnedSearch(row, keyword) {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return true
  const values = row.values || {}
  const haystack = Object.values(values)
    .map((v) => (v == null ? '' : String(v).toLowerCase()))
    .join('\n')
  return haystack.includes(kw)
}
