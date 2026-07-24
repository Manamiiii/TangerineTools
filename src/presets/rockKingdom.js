// 洛克王国预置场景：场景 + 资料表 + 字段定义。
// 行数据单独放在 public/presets/rockKingdomRows.json，运行时通过 fetch 加载，
// 避免把官方图鉴静态资源 URL 清单打进主 bundle。

import { normalizeField } from '../utils.js'
import { BILI_EGG_GROUP_NAMES } from '../domain/breedingData.js'

const SEED_TIME = '2026-01-01T00:00:00.000Z'

const SCENE_ID = 'scene-rock-kingdom'
export const ROCK_KINGDOM_CREATURE_TABLE_ID = 'table-rock-kingdom-elf-basic'
const TABLE_ID = ROCK_KINGDOM_CREATURE_TABLE_ID
const SKILL_TABLE_ID = 'table-rock-kingdom-skills'
export const ROCK_KINGDOM_ROWS_VERSION = 'bwiki-2026-07-24-2c7990a98d3181f9'

// 系别图标使用 BWiki 精灵筛选页公开的无文字 patchwiki 小图标。
// 覆盖当前全部 18 系；用户仍可在字段编辑中按需增删或替换自定义图标。
const ELEMENT_SYSTEM_LIST = [
  { value: 'normal', cn: '普通', color: '#94a3b8', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/6/69/nc77midbqeafn7i2snh5a5h16ctdi0o.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%99%AE%E9%80%9A.png' },
  { value: 'grass', cn: '草', color: '#22c55e', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/1/12/b8bsilucec9a98rsmqkmxt06c4mnnix.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E8%8D%89.png' },
  { value: 'fire', cn: '火', color: '#f97316', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/a/ab/8wvxz3p479e2b702afdqyzhx9340qgx.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E7%81%AB.png' },
  { value: 'water', cn: '水', color: '#38bdf8', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/d/d1/csqsyhq1k488329455xdlzdcybv6zjh.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%B0%B4.png' },
  { value: 'light', cn: '光', color: '#facc15', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/d/de/pxfi7cg0j94c45uxf4itigu90wis7jr.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E5%85%89.png' },
  { value: 'earth', cn: '地', color: '#a16207', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/3/32/0w5pybmkd8qm306doqx8kh5onl1o8cq.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E5%9C%B0.png' },
  { value: 'ice', cn: '冰', color: '#67e8f9', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/9/9b/oxnxxud1xhopw87c7mnawxijz8r1hns.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E5%86%B0.png' },
  { value: 'dragon', cn: '龙', color: '#d946ef', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/6/65/kgcg0hvl19o7up0ug8f42bbvhi71dke.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E9%BE%99.png' },
  { value: 'electric', cn: '电', color: '#eab308', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/0/02/iqzkamzcra945jsw5z6o8h9p30fv7db.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E7%94%B5.png' },
  { value: 'poison', cn: '毒', color: '#a855f7', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/5/53/jnd3vijasgthdz2ukggyfpisd464r2v.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%AF%92.png' },
  { value: 'bug', cn: '虫', color: '#84cc16', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/c/cb/q3mlwj270f67spwr934hpqx7hj62bm3.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E8%99%AB.png' },
  { value: 'fighting', cn: '武', color: '#b91c1c', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/5/52/q9hbq9nrnhjt7t86hy7sftv3e2e5fvx.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%AD%A6.png' },
  { value: 'flying', cn: '翼', color: '#60a5fa', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/2/2b/p7wdw88ziupp84s1mr8t9t602psswzz.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E7%BF%BC.png' },
  { value: 'cute', cn: '萌', color: '#f472b6', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/5/5f/80jhk99eosjv1ld26wp7ljtmif27lfv.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E8%90%8C.png' },
  { value: 'ghost', cn: '幽', color: '#334155', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/e/e7/ttqdi3zlz72g5dgmc8qg9ko4aorwllw.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E5%B9%BD.png' },
  { value: 'dark', cn: '恶', color: '#6b21a8', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/3/3b/hrdmz7n0qt3bnmir9fdn7977fvleec0.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%81%B6.png' },
  { value: 'mech', cn: '机械', color: '#64748b', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/a/ad/fw81a2pvdickbcnq5rt17m6066cchcf.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E6%9C%BA%E6%A2%B0.png' },
  { value: 'illusion', cn: '幻', color: '#7c3aed', icon: 'https://patchwiki.biligame.com/images/rocom/thumb/6/64/89miqle961qdw2tt56hb78bps6f34ci.png/22px-%E5%9B%BE%E6%A0%87_%E5%AE%A0%E7%89%A9_%E5%B1%9E%E6%80%A7_%E5%B9%BB.png' },
]

const ELEMENT_OPTIONS = ELEMENT_SYSTEM_LIST.map(({ value, cn, color, icon }) => ({
  value,
  label: cn,
  color,
  image: icon,
}))

export const ELEMENT_LEGACY_DEFAULTS = Object.fromEntries(
  ELEMENT_SYSTEM_LIST.map(({ value, cn, color }) => [value, {
    labels: [cn, `${cn}系`],
    color,
    images: ['', `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/a/e/${encodeURIComponent(cn)}.png`],
  }]),
)

// 异色的选项化表达：以 select 而非 boolean 存储，可以在表格里直接以彩色标签
// 展示；yes/no 的字面值也能兼容 boolean 的历史数据（true 会被渲染为空单元格，
// 迁移函数会在必要时补齐——见 db.js/rockKingdom 迁移路径）。
const SHINY_OPTIONS = [
  { value: 'no', label: '无异色形态', color: '#94a3b8', image: '' },
  { value: 'yes', label: '存在异色形态', color: '#db2777', image: '' },
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
  { value: 'dispel', label: '驱散净化', color: '#0284c7', image: '' },
  { value: 'mark', label: '印记机制', color: '#8b5cf6', image: '' },
  { value: 'choice', label: '选择变化', color: '#d97706', image: '' },
  { value: 'teamSupport', label: '队伍辅助', color: '#059669', image: '' },
  { value: 'directDamage', label: '直接伤害', color: '#e11d48', image: '' },
  { value: 'specialMechanic', label: '特殊机制', color: '#64748b', image: '' },
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
  makeField({ key: 'image', name: '精灵图', type: 'image', display: { compact: true, tableWidth: 74 } }, 0),
  makeField({ key: 'name', name: '名称', type: 'text', display: { breakParentheses: true, compact: true, tableWidth: 116 } }, 1),
  makeField({ key: 'no', name: '编号', type: 'text', display: { compact: true, tableWidth: 72 } }, 2),
  makeField({ key: 'element', name: '系别', type: 'multiselect', options: ELEMENT_OPTIONS, display: { stack: true, tableMaxItems: 2, compact: true, tableWidth: 78 } }, 3),
  makeField({ key: 'form', name: '形态', type: 'text', display: { compact: true, tableWidth: 92 } }, 4),
  makeField({ key: 'bst', name: '种族值', type: 'number', display: { compact: true, tableWidth: 76 } }, 5),
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
      display: { compact: true, tableWidth: 166 },
    },
    6,
  ),
  makeField({ key: 'traitName', name: '特性', type: 'summary', display: { kind: 'summary', imageField: 'traitIcon', descriptionField: 'traitDesc', compact: true, tableWidth: 220 } }, 7),
  makeField({ key: 'fruitImage', name: '种子', type: 'image', display: { compact: true, tableWidth: 66 } }, 8),
  makeField({ key: 'eggImage', name: '精灵蛋', type: 'image', display: { compact: true, tableWidth: 66 } }, 9),
  makeField(
    { key: 'traitTags', name: '特性标签', type: 'multiselect', options: TRAIT_TAG_OPTIONS, display: { tableLines: 5, tableMaxItems: 10, compact: true, tableWidth: 172 } },
    10,
  ),
  makeField({ key: 'skillTags', name: '技能标签', type: 'multiselect', options: SKILL_TAG_OPTIONS, display: { tableLines: 5, tableMaxItems: 10, compact: true, tableWidth: 172 } }, 11),
  makeField({ key: 'skillRefs', name: '可用技能', type: 'references', referenceTableId: SKILL_TABLE_ID, display: { referenceLabelFields: ['name'], tableLines: 5, tableMaxItems: 10, compact: true, tableWidth: 196 } }, 12),
  makeField({ key: 'eggGroups', name: '蛋组', type: 'multiselect', options: BILI_EGG_GROUP_NAMES.map((name, index) => ({
    value: name,
    label: name,
    color: ['#64748b', '#f97316', '#8b5cf6', '#64748b', '#d946ef', '#38bdf8', '#14b8a6', '#22c55e', '#a16207', '#f472b6', '#84cc16', '#06b6d4', '#475569', '#0ea5e9', '#ef4444'][index] || '#64748b',
  })) }, 13),
  makeField({ key: 'speciesGroup', name: '繁育谱系', type: 'text', hidden: true }, 14),
  makeField({ key: 'shiny', name: '异色形态', type: 'select', options: SHINY_OPTIONS, hidden: true }, 15),
  makeField({ key: 'traitIcon', name: '特性图标', type: 'image', hidden: true }, 16),
  makeField({ key: 'traitDesc', name: '特性描述', type: 'longtext', hidden: true }, 17),
  makeField({ key: 'hp', name: '生命', type: 'number', hidden: true }, 18),
  makeField({ key: 'patk', name: '物攻', type: 'number', hidden: true }, 19),
  makeField({ key: 'matk', name: '魔攻', type: 'number', hidden: true }, 20),
  makeField({ key: 'pdef', name: '物防', type: 'number', hidden: true }, 21),
  makeField({ key: 'mdef', name: '魔防', type: 'number', hidden: true }, 22),
  makeField({ key: 'spd', name: '速度', type: 'number', hidden: true }, 23),
  makeField({ key: 'evolutionLine', name: '进化链', type: 'longtext', hidden: true, display: { kind: 'chain' } }, 24),
]

const skillFields = [
  makeField({ key: 'image', name: '技能图标', type: 'image', display: { compact: true, tableWidth: 80 } }, 0, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'name', name: '技能名称', type: 'text', display: { breakParentheses: true, compact: true, tableWidth: 132 } }, 1, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'element', name: '系别', type: 'select', options: ELEMENT_OPTIONS, display: { compact: true, tableWidth: 78 } }, 2, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'category', name: '类型', type: 'select', options: SKILL_CATEGORY_OPTIONS, display: { compact: true, tableWidth: 88 } }, 3, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'power', name: '威力', type: 'number', display: { compact: true, tableWidth: 66 } }, 4, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'cost', name: '能耗', type: 'number', display: { compact: true, tableWidth: 66 } }, 5, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'priority', name: '先制/速度', type: 'text', display: { compact: true, tableWidth: 82 } }, 6, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField(
    { key: 'effectTags', name: '效果标签', type: 'multiselect', options: SKILL_EFFECT_TAG_OPTIONS, display: { tableLines: 2, tableMaxItems: 5, compact: true, tableWidth: 172 } },
    7,
    SKILL_TABLE_ID,
    'field-rock-skill',
  ),
  makeField({ key: 'effect', name: '效果', type: 'longtext', display: { compact: true, tableWidth: 236 } }, 8, SKILL_TABLE_ID, 'field-rock-skill'),
  makeField({ key: 'learnerRefs', name: '可学精灵', type: 'references', referenceTableId: TABLE_ID, display: { referenceLabelFields: ['name'], plainReference: true, tableLines: 2, tableMaxItems: 5, compact: true, tableWidth: 196 } }, 9, SKILL_TABLE_ID, 'field-rock-skill'),
]

export const ROCK_KINGDOM_PRESET = {
  scene: {
    id: SCENE_ID,
    name: '洛克王国',
    type: 'game',
    tools: ['catalog', 'nature', 'owned', 'breeding', 'stock'],
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
