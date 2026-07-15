// 孵蛋推荐预置辅助数据。
// 来源：B 站洛克王国手游 WIKI「蛋组计算器」页面（2026-06-16 更新）可见的蛋组清单与精灵条目。
// 这里只收录本仓库用于首屏验证和示例数据的安全子集；用户自定义非空字段不会被覆盖。

export const BILI_EGG_GROUP_SOURCE_URL = 'https://wiki.biligame.com/rocom/%E8%9B%8B%E7%BB%84%E8%AE%A1%E7%AE%97%E5%99%A8'

export const BILI_EGG_GROUP_NAMES = [
  '无法孵蛋',
  '动物组',
  '拟人组',
  '巨灵组',
  '魔力组',
  '天空组',
  '两栖组',
  '植物组',
  '大地组',
  '妖精组',
  '昆虫组',
  '软体组',
  '机械组',
  '海洋组',
  '龙组',
]

export const BREEDING_PRESET_BY_NAME = {
  喵喵: { eggGroups: ['动物组'], speciesGroup: '喵喵系' },
  喵呜: { eggGroups: ['动物组'], speciesGroup: '喵喵系' },
  魔力猫: { eggGroups: ['动物组'], speciesGroup: '喵喵系' },
  叶冕魔力猫: { eggGroups: ['动物组'], speciesGroup: '喵喵系' },
  锥尾羊: { eggGroups: ['动物组'], speciesGroup: '锥尾羊系' },
  铃兰羊: { eggGroups: ['动物组'], speciesGroup: '锥尾羊系' },
  花影羚羊: { eggGroups: ['动物组'], speciesGroup: '锥尾羊系' },
  小鼠獭: { eggGroups: ['动物组'], speciesGroup: '小鼠獭系' },
  燕尾獭: { eggGroups: ['动物组'], speciesGroup: '小鼠獭系' },
  卷胡巨獭: { eggGroups: ['动物组'], speciesGroup: '小鼠獭系' },
  护主犬: { eggGroups: ['动物组'], speciesGroup: '护主犬系' },
  音速犬: { eggGroups: ['动物组'], speciesGroup: '护主犬系' },
  风暴战犬: { eggGroups: ['动物组'], speciesGroup: '护主犬系' },
  绿耳松鼠: { eggGroups: ['动物组'], speciesGroup: '绿耳松鼠系' },
  抱枕松鼠: { eggGroups: ['动物组'], speciesGroup: '绿耳松鼠系' },
  蹦床松鼠: { eggGroups: ['动物组'], speciesGroup: '绿耳松鼠系' },
}

export const BREEDING_DEMO_OWNED = [
  { name: '喵喵', gender: 'female', nature: 'peaceful', shiny: 'no', colorful: 'no', note: '孵蛋推荐示例：普通母本，目标补同种异色。' },
  { name: '魔力猫', gender: 'male', nature: 'relaxed', shiny: 'yes', colorful: 'yes', note: '孵蛋推荐示例：异色炫彩父本。' },
  { name: '锥尾羊', gender: 'female', nature: 'cheerful', shiny: 'yes', colorful: 'no', note: '孵蛋推荐示例：异色母本。' },
  { name: '花影羚羊', gender: 'male', nature: 'adamant', shiny: 'yes', colorful: 'yes', note: '孵蛋推荐示例：异色炫彩父本。' },
  { name: '小鼠獭', gender: 'female', nature: 'silent', shiny: 'no', colorful: 'no', note: '孵蛋推荐示例：普通母本。' },
  { name: '卷胡巨獭', gender: 'male', nature: 'clever', shiny: 'yes', colorful: 'yes', note: '孵蛋推荐示例：异色炫彩父本。' },
  { name: '绿耳松鼠', gender: 'female', nature: 'steady', shiny: 'no', colorful: 'no', note: '孵蛋推荐示例：普通母本。' },
  { name: '蹦床松鼠', gender: 'male', nature: 'clever', shiny: 'yes', colorful: 'yes', note: '孵蛋推荐示例：异色炫彩父本。' },
  { name: '护主犬', gender: 'female', nature: 'cheerful', shiny: 'yes', colorful: 'no', note: '孵蛋推荐示例：异色母本。' },
  { name: '音速犬', gender: 'male', nature: 'adamant', shiny: 'yes', colorful: 'yes', note: '孵蛋推荐示例：异色炫彩父本。' },
]
