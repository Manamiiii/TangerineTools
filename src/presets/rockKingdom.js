// 洛克王国预置场景：场景 + 资料表 + 字段定义。
// 行数据单独放在 public/presets/rockKingdomRows.json，运行时通过 fetch 加载，
// 避免把官方图鉴静态资源 URL 清单打进主 bundle。

import { normalizeField } from '../utils.js'

const SEED_TIME = '2026-01-01T00:00:00.000Z'

const SCENE_ID = 'scene-rock-kingdom'
const TABLE_ID = 'table-rock-kingdom-elf-basic'
const SKILL_TABLE_ID = 'table-rock-kingdom-skills'
export const ROCK_KINGDOM_ROWS_VERSION = 'official-d-json-2026-06-08'

// 系别图标：使用洛克王国官方图鉴的公开静态资源地址，URL 中的文件名直接是
// 系别的中文名（经 encodeURIComponent 编码），例如 普通系 -> 普通.png。
// 覆盖洛克王国官方公开的全部 18 系，与官方 d.json 展开的预置行数据保持一致，
// 用户仍可在字段编辑中按需增删。
const ELEMENT_SYSTEM_LIST = [
  { value: 'normal', cn: '普通', color: '#94a3b8' },
  { value: 'grass', cn: '草', color: '#22c55e' },
  { value: 'fire', cn: '火', color: '#f97316' },
  { value: 'water', cn: '水', color: '#38bdf8' },
  { value: 'light', cn: '光', color: '#facc15' },
  { value: 'earth', cn: '地', color: '#a16207' },
  { value: 'ice', cn: '冰', color: '#67e8f9' },
  { value: 'dragon', cn: '龙', color: '#d946ef' },
  { value: 'electric', cn: '电', color: '#eab308' },
  { value: 'poison', cn: '毒', color: '#a855f7' },
  { value: 'bug', cn: '虫', color: '#84cc16' },
  { value: 'fighting', cn: '武', color: '#b91c1c' },
  { value: 'flying', cn: '翼', color: '#60a5fa' },
  { value: 'cute', cn: '萌', color: '#f472b6' },
  { value: 'ghost', cn: '幽', color: '#334155' },
  { value: 'dark', cn: '恶', color: '#6b21a8' },
  { value: 'mech', cn: '机械', color: '#64748b' },
  { value: 'illusion', cn: '幻', color: '#7c3aed' },
]

const ELEMENT_OPTIONS = ELEMENT_SYSTEM_LIST.map(({ value, cn, color }) => ({
  value,
  label: cn,
  color,
  image: `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/a/e/${encodeURIComponent(cn)}.png`,
}))

export const ELEMENT_LEGACY_DEFAULTS = Object.fromEntries(
  ELEMENT_SYSTEM_LIST.map(({ value, cn, color }) => [value, { label: `${cn}系`, color }]),
)

// 异色的选项化表达：以 select 而非 boolean 存储，可以在表格里直接以彩色标签
// 展示；yes/no 的字面值也能兼容 boolean 的历史数据（true 会被渲染为空单元格，
// 迁移函数会在必要时补齐——见 db.js/rockKingdom 迁移路径）。
const SHINY_OPTIONS = [
  { value: 'no', label: '非异色', color: '#94a3b8', image: '' },
  { value: 'yes', label: '异色', color: '#db2777', image: '' },
]

// 特性标签：14 类倾向标签，用于多选描述精灵在队伍里的定位/资源循环特点。
// 其中 attack/control/support/defense/special 是第一轮就存在的旧值，
// 这里只更新了展示名称与配色（新语义更细），value 保持不变，
// 已保存的旧标签数据可以继续正常展示、不会变成空白或 undefined。
export const TRAIT_TAG_OPTIONS = [
  { value: 'attack', label: '双攻输出', color: '#dc2626', image: '' },
  { value: 'patkLean', label: '物攻输出', color: '#ea580c', image: '' },
  { value: 'matkLean', label: '魔攻输出', color: '#c026d3', image: '' },
  { value: 'spdLean', label: '高速先手', color: '#eab308', image: '' },
  { value: 'conditionalSpeedBoost', label: '条件加速', color: '#f59e0b', image: '' },
  { value: 'swiftSkill', label: '迅捷触发', color: '#facc15', image: '' },
  { value: 'defense', label: '耐久基础', color: '#2563eb', image: '' },
  { value: 'support', label: '回复辅助', color: '#059669', image: '' },
  { value: 'energyCycle', label: '能量循环', color: '#0d9488', image: '' },
  { value: 'counterGain', label: '克制收益', color: '#4f46e5', image: '' },
  { value: 'growth', label: '强化成长', color: '#65a30d', image: '' },
  { value: 'shieldReduce', label: '护盾减伤', color: '#0891b2', image: '' },
  { value: 'control', label: '异常控制', color: '#7c3aed', image: '' },
  { value: 'pivot', label: '换入返场', color: '#475569', image: '' },
  { value: 'special', label: '特殊机制', color: '#94a3b8', image: '' },
]

// 第一轮（round 1）里 5 个旧标签值的默认展示名/配色，仅供迁移逻辑判断
// "用户是否自定义过这个选项"：如果本地字段里同 value 的选项仍然完全等于
// 这里记录的旧默认值，才会被迁移覆盖为上面的新展示名；一旦用户改过名称
// 或颜色，迁移会跳过它，不覆盖用户的编辑。见 db.js 的 migrateRockKingdomFieldOptions。
export const TRAIT_TAG_LEGACY_DEFAULTS = {
  attack: { label: '输出', color: '#dc2626' },
  control: { label: '控制', color: '#7c3aed' },
  support: { label: '辅助', color: '#059669' },
  defense: { label: '防御', color: '#2563eb' },
  special: { label: '特殊', color: '#d97706' },
}

const SKILL_TAG_OPTIONS = [
  { value: 'physicalMoves', label: '物攻技能', color: '#ea580c', image: '' },
  { value: 'magicalMoves', label: '魔攻技能', color: '#c026d3', image: '' },
  { value: 'mixedMoves', label: '双攻技能池', color: '#dc2626', image: '' },
  { value: 'physicalLean', label: '物攻技能偏多', color: '#f97316', image: '' },
  { value: 'magicalLean', label: '魔攻技能偏多', color: '#d946ef', image: '' },
  { value: 'speed', label: '速度/先手', color: '#eab308', image: '' },
  { value: 'slowBenefit', label: '后手收益', color: '#64748b', image: '' },
  { value: 'control', label: '控制/异常', color: '#7c3aed', image: '' },
  { value: 'support', label: '回复辅助', color: '#059669', image: '' },
  { value: 'energyCycle', label: '能量循环', color: '#0d9488', image: '' },
  { value: 'defense', label: '防御减伤', color: '#2563eb', image: '' },
]

const SKILL_CATEGORY_OPTIONS = [
  {
    value: 'physical',
    label: '物攻',
    color: '#ea580c',
    image: 'https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/a/st/%E7%89%A9%E6%94%BB.png',
  },
  {
    value: 'magical',
    label: '魔攻',
    color: '#c026d3',
    image: 'https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/a/st/%E9%AD%94%E6%94%BB.png',
  },
  {
    value: 'status',
    label: '状态',
    color: '#64748b',
    image: 'https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/a/st/%E7%8A%B6%E6%80%81.png',
  },
]

export const SKILL_CATEGORY_LEGACY_DEFAULTS = {
  physical: { label: '物理', color: '#ea580c' },
  magical: { label: '魔法', color: '#c026d3' },
  status: { label: '状态', color: '#64748b' },
}

export const SKILL_EFFECT_TAG_OPTIONS = [
  { value: 'priority', label: '先手优先', color: '#eab308', image: '' },
  { value: 'swift', label: '迅捷先手', color: '#f59e0b', image: '' },
  { value: 'speed', label: '速度节奏', color: '#facc15', image: '' },
  { value: 'healing', label: '回复吸血', color: '#16a34a', image: '' },
  { value: 'damageReduction', label: '护盾减伤', color: '#2563eb', image: '' },
  { value: 'energyGain', label: '回能迸发', color: '#0d9488', image: '' },
  { value: 'energyDrain', label: '能量干扰', color: '#0891b2', image: '' },
  { value: 'costChange', label: '能耗变化', color: '#14b8a6', image: '' },
  { value: 'statBoost', label: '自身强化', color: '#65a30d', image: '' },
  { value: 'boostTransfer', label: '强化传递', color: '#22c55e', image: '' },
  { value: 'statDebuff', label: '削弱对手', color: '#9333ea', image: '' },
  { value: 'control', label: '异常控制', color: '#7c3aed', image: '' },
  { value: 'counterAttack', label: '应对攻击', color: '#dc2626', image: '' },
  { value: 'counterDefense', label: '应对防御', color: '#475569', image: '' },
  { value: 'counterStatus', label: '应对状态', color: '#db2777', image: '' },
  { value: 'pivot', label: '脱离轮转', color: '#64748b', image: '' },
  { value: 'multiHit', label: '连击', color: '#f97316', image: '' },
  { value: 'charge', label: '蓄力', color: '#a16207', image: '' },
  { value: 'fieldEffect', label: '天气场地', color: '#0ea5e9', image: '' },
]

function makeField(partial, order, tableId = TABLE_ID, idPrefix = 'field-rock') {
  return normalizeField({
    id: `${idPrefix}-${partial.key}`,
    tableId,
    order,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    ...partial,
  })
}

const fields = [
  makeField({ key: 'image', name: '精灵图', type: 'image' }, 0),
  makeField({ key: 'name', name: '名称', type: 'text' }, 1),
  makeField({ key: 'no', name: '编号', type: 'text' }, 2),
  makeField({ key: 'element', name: '系别', type: 'multiselect', options: ELEMENT_OPTIONS }, 3),
  makeField({ key: 'form', name: '形态', type: 'text' }, 4),
  makeField({ key: 'bst', name: '种族值', type: 'number' }, 5),
  makeField(
    {
      key: 'stats',
      name: '六维',
      type: 'stats',
      statsStyle: 'bars',
      statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' },
      statsDimensions: [
        { key: 'hp', label: '生命', fieldKey: 'hp' },
        { key: 'patk', label: '物攻', fieldKey: 'patk' },
        { key: 'matk', label: '魔攻', fieldKey: 'matk' },
        { key: 'pdef', label: '物防', fieldKey: 'pdef' },
        { key: 'mdef', label: '魔防', fieldKey: 'mdef' },
        { key: 'spd', label: '速度', fieldKey: 'spd' },
      ],
    },
    6,
  ),
  makeField({ key: 'shiny', name: '是否异色', type: 'select', options: SHINY_OPTIONS }, 7),
  makeField({ key: 'traitName', name: '特性名称', type: 'text' }, 8),
  makeField(
    { key: 'traitTags', name: '特性标签', type: 'multiselect', options: TRAIT_TAG_OPTIONS },
    9,
  ),
  makeField({ key: 'traitIcon', name: '特性图标', type: 'image' }, 10),
  makeField({ key: 'traitDesc', name: '特性描述', type: 'longtext' }, 11),
  makeField({ key: 'skillTags', name: '技能标签', type: 'multiselect', options: SKILL_TAG_OPTIONS }, 12),
  makeField({ key: 'skillRefs', name: '可用技能', type: 'references', referenceTableId: SKILL_TABLE_ID }, 13),
  makeField({ key: 'hp', name: '生命', type: 'number', hidden: true }, 14),
  makeField({ key: 'patk', name: '物攻', type: 'number', hidden: true }, 15),
  makeField({ key: 'matk', name: '魔攻', type: 'number', hidden: true }, 16),
  makeField({ key: 'pdef', name: '物防', type: 'number', hidden: true }, 17),
  makeField({ key: 'mdef', name: '魔防', type: 'number', hidden: true }, 18),
  makeField({ key: 'spd', name: '速度', type: 'number', hidden: true }, 19),
]

const skillFields = [
  makeField({ key: 'image', name: '技能图标', type: 'image' }, 0, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'name', name: '技能名称', type: 'text' }, 1, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'element', name: '系别', type: 'select', options: ELEMENT_OPTIONS }, 2, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'category', name: '类型', type: 'select', options: SKILL_CATEGORY_OPTIONS }, 3, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'power', name: '威力', type: 'number' }, 4, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'cost', name: '能耗', type: 'number' }, 5, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'priority', name: '先制/速度', type: 'text' }, 6, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField(
    { key: 'effectTags', name: '效果标签', type: 'multiselect', options: SKILL_EFFECT_TAG_OPTIONS },
    7,
    SKILL_TABLE_ID,
    'field-rock-skill',
  ),
  makeField({ key: 'effect', name: '效果', type: 'longtext' }, 8, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'learnerRefs', name: '可学精灵', type: 'references', referenceTableId: TABLE_ID }, 9, SKILL_TABLE_ID, 'field-rock-skill'),
]

export const ROCK_KINGDOM_PRESET = {
  scene: {
    id: SCENE_ID,
    name: '洛克王国',
    type: 'game',
    tools: ['catalog', 'owned', 'stock', 'nature'],
    order: 0,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  tables: [
    {
      id: TABLE_ID,
      sceneId: SCENE_ID,
      name: '精灵基础资料',
      order: 0,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    },
    {
      id: SKILL_TABLE_ID,
      sceneId: SCENE_ID,
      name: '技能资料',
      order: 1,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    },
  ],
  fields: [...fields, ...skillFields],
}
