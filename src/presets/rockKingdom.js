// 洛克王国预置场景：场景 + 资料表 + 字段定义。
// 行数据（少量 mock）单独放在 public/presets/rockKingdomRows.json，
// 通过 fetch 加载，避免图片占位数据进入主 bundle。

import { normalizeField } from '../utils.js'

const SEED_TIME = '2026-01-01T00:00:00.000Z'

const SCENE_ID = 'scene-rock-kingdom'
const TABLE_ID = 'table-rock-kingdom-elf-basic'

// 生成一个纯本地、无外部依赖的占位图标（内联 SVG data URI）。
// 第一轮不接入真实素材，避免引用未授权的美术资源或不稳定的外链。
function placeholderIcon(text, bg, fg = '#ffffff') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="10" fill="${bg}"/><text x="24" y="32" font-size="20" text-anchor="middle" fill="${fg}" font-family="sans-serif">${text}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const ELEMENT_OPTIONS = [
  { value: 'normal', label: '普通系', color: '#94a3b8' },
  { value: 'magic', label: '魔法系', color: '#a855f7' },
  { value: 'water', label: '水系', color: '#38bdf8' },
  { value: 'flying', label: '飞行系', color: '#60a5fa' },
  { value: 'fire', label: '火系', color: '#f97316' },
  { value: 'mech', label: '机械系', color: '#64748b' },
  { value: 'dark', label: '黑暗系', color: '#6b21a8' },
  { value: 'holy', label: '圣灵系', color: '#facc15' },
].map((opt) => ({ ...opt, image: placeholderIcon(opt.label.slice(0, 1), opt.color) }))

const FORM_OPTIONS = [
  { value: 'base', label: '基础形态', color: '#94a3b8', image: '' },
  { value: 'evolved', label: '进化形态', color: '#2563eb', image: '' },
]

const TRAIT_TAG_OPTIONS = [
  { value: 'attack', label: '输出', color: '#dc2626', image: '' },
  { value: 'control', label: '控制', color: '#7c3aed', image: '' },
  { value: 'support', label: '辅助', color: '#059669', image: '' },
  { value: 'defense', label: '防御', color: '#2563eb', image: '' },
  { value: 'special', label: '特殊', color: '#d97706', image: '' },
]

function makeField(partial, order) {
  return normalizeField({
    id: `field-rock-${partial.key}`,
    tableId: TABLE_ID,
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
  makeField({ key: 'element', name: '系别', type: 'select', options: ELEMENT_OPTIONS }, 3),
  makeField({ key: 'form', name: '形态', type: 'select', options: FORM_OPTIONS }, 4),
  makeField({ key: 'bst', name: '种族值', type: 'number' }, 5),
  makeField(
    {
      key: 'stats',
      name: '六维',
      type: 'stats',
      statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' },
    },
    6,
  ),
  makeField({ key: 'shiny', name: '是否异色', type: 'boolean' }, 7),
  makeField({ key: 'traitName', name: '特性名称', type: 'text' }, 8),
  makeField(
    { key: 'traitTags', name: '特性标签', type: 'multiselect', options: TRAIT_TAG_OPTIONS },
    9,
  ),
  makeField({ key: 'traitIcon', name: '特性图标', type: 'image' }, 10),
  makeField({ key: 'traitDesc', name: '特性描述', type: 'longtext' }, 11),
  makeField({ key: 'hp', name: '生命', type: 'number', hidden: true }, 12),
  makeField({ key: 'patk', name: '物攻', type: 'number', hidden: true }, 13),
  makeField({ key: 'matk', name: '魔攻', type: 'number', hidden: true }, 14),
  makeField({ key: 'pdef', name: '物防', type: 'number', hidden: true }, 15),
  makeField({ key: 'mdef', name: '魔防', type: 'number', hidden: true }, 16),
  makeField({ key: 'spd', name: '速度', type: 'number', hidden: true }, 17),
]

export const ROCK_KINGDOM_PRESET = {
  scene: {
    id: SCENE_ID,
    name: '洛克王国',
    type: 'game',
    color: '#2563eb',
    tools: ['catalog'],
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
  ],
  fields,
}
