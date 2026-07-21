// 洛克王国资料表专用纯函数：识别"编号"字段、聚合同编号的不同形态行，
// 构建形态对比表格数据与摘要文案。不依赖 Dexie / React，便于复用与测试。

import { NUMBER_FIELD_KEYS, NUMBER_FIELD_NAMES } from '../constants.js'
import { optionLabel } from '../utils.js'

// P4 之前的 29 个稳定行 id 在 BWiki 展开主形态/地区形态后不再进入正式预置。
// 保留这些行本身以兼容旧 owned / stock 引用，但在资料选择与统计视图中隐藏，
// 避免已有浏览器同时显示旧概括行和新版精确形态行。
export const SUPERSEDED_CREATURE_ROW_ALIASES = new Map([
  ['rock-creature-src-448', 'rock-creature-bwiki-aef4b3565565'],
  ['rock-creature-src-017', 'rock-creature-bwiki-bf820721eb70'],
  ['rock-creature-src-018', 'rock-creature-bwiki-b44ab058ef4a'],
  ['rock-creature-src-019', 'rock-creature-bwiki-bde230d40211'],
  ['rock-creature-src-023', 'rock-creature-bwiki-836ff913b5bd'],
  ['rock-creature-src-024', 'rock-creature-bwiki-9ab657c3a5f5'],
  ['rock-creature-src-025', 'rock-creature-bwiki-879f28cfa0d4'],
  ['rock-creature-src-029', 'rock-creature-bwiki-c4d9725d943a'],
  ['rock-creature-src-030', 'rock-creature-bwiki-35640a657332'],
  ['rock-creature-src-031', 'rock-creature-bwiki-9e205d79234f'],
  ['rock-creature-src-452', 'rock-creature-bwiki-ad9d45c9053a'],
  ['rock-creature-src-455', 'rock-creature-bwiki-412274db18b2'],
  ['rock-creature-src-081', 'rock-creature-bwiki-aecb348a0459'],
  ['rock-creature-src-082', 'rock-creature-bwiki-35ea1fc47290'],
  ['rock-creature-src-083', 'rock-creature-bwiki-73bc337cb100'],
  ['rock-creature-src-151', 'rock-creature-bwiki-42dd2222ede0'],
  ['rock-creature-src-406', 'rock-creature-src-168'],
  ['rock-creature-src-407', 'rock-creature-src-169'],
  ['rock-creature-src-464', 'rock-creature-bwiki-7023282bddac'],
  ['rock-creature-src-217', 'rock-creature-bwiki-fcb42a4498f3'],
  ['rock-creature-src-419', 'rock-creature-bwiki-fcb42a4498f3'],
  ['rock-creature-src-218', 'rock-creature-bwiki-1ded386ad277'],
  ['rock-creature-src-420', 'rock-creature-bwiki-1ded386ad277'],
  ['rock-creature-src-439', 'rock-creature-bwiki-397d55675ef5'],
  ['rock-creature-src-440', 'rock-creature-bwiki-397d55675ef5'],
  ['rock-creature-src-441', 'rock-creature-bwiki-e4c7904c7a66'],
  ['rock-creature-src-442', 'rock-creature-bwiki-e4c7904c7a66'],
  ['rock-creature-src-443', 'rock-creature-bwiki-f1eb31e3f8a3'],
  ['rock-creature-src-444', 'rock-creature-bwiki-f1eb31e3f8a3'],
])

function naturalCreatureKey(row) {
  const values = row?.values ?? {}
  return [values.no, values.name, values.form].map((value) => String(value ?? '').trim()).join('::')
}

export function visibleRockKingdomCreatureRows(rows = []) {
  const allIds = new Set(rows.map((row) => row.id))
  const withoutSuperseded = rows.filter((row) => {
    const replacementId = SUPERSEDED_CREATURE_ROW_ALIASES.get(row.id)
    return !replacementId || !allIds.has(replacementId)
  })
  const canonicalKeys = new Set(withoutSuperseded
    .filter((row) => /^rock-creature-(?:src|bwiki)-/.test(row.id || ''))
    .map(naturalCreatureKey))
  const seen = new Set()
  return withoutSuperseded.filter((row) => {
    const key = naturalCreatureKey(row)
    const isCanonical = /^rock-creature-(?:src|bwiki)-/.test(row.id || '')
    if (!isCanonical && canonicalKeys.has(key)) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

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

// 适合方向的推荐候选：按优先级从上往下匹配，命中第一个即返回。
// 每条规则的 test 收到该行的六维、种族值、特性标签、以及同组内的最大值信息，
// 用尽量少的判断给出"这个形态最擅长做什么"的一句话结论。
// 顺序设计：先看输出/速度/耐久之类的结构性定位，再看能量/续航/控制之类的功能性倾向。
const FORM_DIRECTION_RULES = [
  {
    // 物攻显著高于魔攻且是组内最高的物攻。
    label: '物攻输出',
    test: ({ stats, groupMax }) =>
      stats.patk >= 90 && stats.patk >= stats.matk + 20 && stats.patk === groupMax.patk,
  },
  {
    // 魔攻显著高于物攻且是组内最高的魔攻。
    label: '魔攻输出',
    test: ({ stats, groupMax }) =>
      stats.matk >= 90 && stats.matk >= stats.patk + 20 && stats.matk === groupMax.matk,
  },
  {
    // 双攻均高、差距不大：双攻输出。
    label: '双攻输出',
    test: ({ stats }) => stats.patk >= 85 && stats.matk >= 85 && Math.abs(stats.patk - stats.matk) <= 20,
  },
  {
    // 速度在组内最高且明显偏高：主打速攻/先手。
    label: '高速先手',
    test: ({ stats, groupMax }) => stats.spd >= 95 && stats.spd === groupMax.spd,
  },
  {
    // 生命+双防合计明显偏高：耐久坦克。
    label: '耐久坦克',
    test: ({ stats }) => stats.hp + stats.pdef + stats.mdef >= 320,
  },
  {
    // 携带 energyCycle 标签：能量循环。
    label: '能量循环',
    test: ({ traitTags }) => traitTags.includes('energyCycle'),
  },
  {
    // 携带 support 标签：辅助续航。
    label: '辅助续航',
    test: ({ traitTags }) => traitTags.includes('support'),
  },
  {
    // 携带 control 标签：异常控制。
    label: '异常控制',
    test: ({ traitTags }) => traitTags.includes('control'),
  },
]

// 兜底方向：所有规则都没命中时，根据组内最高的单项六维给一个粗略定位。
function fallbackDirection(stats, groupMax) {
  const candidates = [
    { key: 'patk', label: '物攻侧重' },
    { key: 'matk', label: '魔攻侧重' },
    { key: 'spd', label: '速度侧重' },
    { key: 'hp', label: '生存侧重' },
    { key: 'pdef', label: '物防侧重' },
    { key: 'mdef', label: '魔防侧重' },
  ]
  const hit = candidates.find((c) => stats[c.key] === groupMax[c.key])
  return hit?.label || '均衡定位'
}

// 计算适合方向 + 主要差异（相对同组均值的最大正/负偏差维度）。
// 均值维度包括六维；正偏差用于"擅长"，负偏差用于"薄弱"；
// 完全均衡（各维度都在均值 ±5% 内）时不列薄弱维度，避免噪音结论。
function computeFormExtras(row, allRows, groupMax) {
  const values = row.values || {}
  const stats = {
    hp: Number(values.hp) || 0,
    patk: Number(values.patk) || 0,
    matk: Number(values.matk) || 0,
    pdef: Number(values.pdef) || 0,
    mdef: Number(values.mdef) || 0,
    spd: Number(values.spd) || 0,
  }
  const traitTags = Array.isArray(values.traitTags) ? values.traitTags : []

  const rule = FORM_DIRECTION_RULES.find((r) => r.test({ stats, traitTags, groupMax }))
  const direction = rule ? rule.label : fallbackDirection(stats, groupMax)

  // 主要差异：找出这一行相对同组均值偏差最大的正向 + 负向维度。
  const dimKeys = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  const dimLabels = {
    hp: '生命',
    patk: '物攻',
    matk: '魔攻',
    pdef: '物防',
    mdef: '魔防',
    spd: '速度',
  }
  const means = {}
  for (const key of dimKeys) {
    const sum = allRows.reduce((acc, r) => acc + (Number(r.values?.[key]) || 0), 0)
    means[key] = allRows.length ? sum / allRows.length : 0
  }
  const diffs = dimKeys.map((key) => ({
    key,
    label: dimLabels[key],
    diff: stats[key] - means[key],
    mean: means[key],
  }))
  const strongest = diffs.filter((d) => d.diff > 5).sort((a, b) => b.diff - a.diff)[0]
  const weakest = diffs.filter((d) => d.diff < -5).sort((a, b) => a.diff - b.diff)[0]
  const parts = []
  if (strongest) parts.push(`强项：${strongest.label}`)
  if (weakest) parts.push(`短板：${weakest.label}`)
  const difference = parts.length ? parts.join(' / ') : '均衡'

  return { direction, difference }
}

// 基于同编号的行集合，构建对比表格数据：名称/形态 + 各数值维度（含最高/最低/相同标注）
// + 适合方向 + 主要差异。只有 2 行及以上才具备对比意义，否则返回空数组，
// 调用方应据此隐藏对比区块。
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

  // 组内六维最大值：适合方向规则里判断"是否为组内最强"要用到，
  // 在这里统一算好，避免每行重算。
  const groupMax = {
    hp: Math.max(...rows.map((r) => Number(r.values?.hp) || 0)),
    patk: Math.max(...rows.map((r) => Number(r.values?.patk) || 0)),
    matk: Math.max(...rows.map((r) => Number(r.values?.matk) || 0)),
    pdef: Math.max(...rows.map((r) => Number(r.values?.pdef) || 0)),
    mdef: Math.max(...rows.map((r) => Number(r.values?.mdef) || 0)),
    spd: Math.max(...rows.map((r) => Number(r.values?.spd) || 0)),
  }

  return rows.map((row) => {
    const formValue = row.values?.form
    // form 字段迁移到 text 类型之后，直接使用文本值；旧的 select 数据仍用 optionLabel 兜底。
    const formLabel =
      formField && formValue != null
        ? formField.type === 'select'
          ? optionLabel(formField, formValue)
          : String(formValue)
        : ''
    const stats = dims.map((dim) => {
      const value = Number(row.values?.[dim.key]) || 0
      const { max, min, allEqual } = extremes.get(dim.key)
      let mark = 'middle'
      if (allEqual) mark = 'same'
      else if (value === max) mark = 'highest'
      else if (value === min) mark = 'lowest'
      return { key: dim.key, label: dim.label, value, mark }
    })
    const extras = computeFormExtras(row, rows, groupMax)
    return {
      rowId: row.id,
      name: row.values?.name || '未命名',
      form: formLabel,
      stats,
      direction: extras.direction,
      difference: extras.difference,
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
