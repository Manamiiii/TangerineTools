#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATURE_DECISION_LABELS,
  STAT_LABELS,
  evaluateAllNatures,
  analyzeSkillInfo,
  analyzeStats,
  inferRoles,
  TRAIT_TAG_STAT_WEIGHTS,
} from '../src/domain/nature.js'
import { TRAIT_TAG_OPTIONS, SKILL_EFFECT_TAG_OPTIONS } from '../src/presets/rockKingdom.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const rowsPath = path.join(repoRoot, 'public/presets/rockKingdomRows.json')
const skillRowsPath = path.join(repoRoot, 'public/presets/rockKingdomSkillRows.json')
const samplesPath = path.join(repoRoot, 'scripts/data/natureCalibrationSamples.json')
const reportPath = path.join(repoRoot, 'docs/nature-calibration-report.md')

const TRAIT_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((option) => [option.value, option.label]))
const EFFECT_LABELS = Object.fromEntries(SKILL_EFFECT_TAG_OPTIONS.map((option) => [option.value, option.label]))

function tagLabel(tag, labels) {
  return `${labels[tag] || '未知标签'}（${tag}）`
}

function statWeightText(weights = {}) {
  return Object.entries(weights)
    .filter(([, value]) => value)
    .map(([key, value]) => `${STAT_LABELS[key] || key}+${value}`)
    .join(' / ') || '暂无六维倾向'
}

function uniqueItems(items = []) {
  return [...new Set(items.filter(Boolean))]
}

function commonItems(lists = []) {
  if (!lists.length) return []
  const [first, ...rest] = lists.map(uniqueItems)
  return first.filter((item) => rest.every((list) => list.includes(item)))
}

function renderIndentedList(items = [], emptyText = '无') {
  return items.length ? items.map((item) => `    - ${item}`).join('\n') : `    - ${emptyText}`
}

function pickArgValue(name) {
  const prefix = `${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefix))
  return matched ? matched.slice(prefix.length) : ''
}


function percentileBandText(score) {
  return [
    '后10%档（低于 P10）',
    'P10-P25 偏低档',
    'P25-P50 中低档',
    'P50-P75 中高档',
    'P75-P90 较高档',
    '前10%档（达到 P90）',
  ][score] || '未知档位'
}

function renderStatDistribution(values = {}) {
  const analysis = analyzeStats(values)
  const header = '| 维度 | 数值 | 分布位置 | 粗分位档 |\n| --- | ---: | --- | --- |'
  const rows = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => {
    const percentile = analysis.percentiles[key]
    return `| ${STAT_LABELS[key] || key} | ${analysis.stats[key] || 0} | ${percentile.label} | ${percentileBandText(percentile.score)} |`
  })
  return [header, ...rows].join('\n')
}

function statSummary(values = {}) {
  return [
    ['hp', '生命'],
    ['patk', '物攻'],
    ['matk', '魔攻'],
    ['pdef', '物防'],
    ['mdef', '魔防'],
    ['spd', '速度'],
  ].map(([key, label]) => `${label}${values[key] ?? 0}`).join(' / ')
}

function natureShort(item) {
  const raise = STAT_LABELS[item.raise] || item.raise
  const lower = STAT_LABELS[item.lower] || item.lower
  return `${item.name}（+${raise} -${lower}，${item.score}）`
}


function groupByDecision(evaluations) {
  return evaluations.reduce((groups, item) => {
    groups[item.decision] ||= []
    groups[item.decision].push(item)
    return groups
  }, {})
}

function findSampleRows(rows, sample) {
  const matched = rows.filter((row) => row.values?.name === sample.name)
  if (sample.form) return matched.filter((row) => row.values?.form === sample.form)
  return matched.slice(0, 1)
}

function buildSkillInfo(row, skillById) {
  const refs = Array.isArray(row.values?.skillRefs) ? row.values.skillRefs : []
  const skills = refs
    .map((id) => skillById.get(id)?.values)
    .filter(Boolean)
    .map((values) => ({
      name: values.name,
      category: values.category,
      type: values.category,
      power: values.power,
      cost: values.cost,
      priority: values.priority,
      effectTags: Array.isArray(values.effectTags) ? values.effectTags : [],
      effect: values.effect,
      description: values.effect,
    }))
  const traitText = [row.values?.traitName, row.values?.traitDesc].filter(Boolean).join('：')
  return {
    skills,
    traitText: /继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(traitText) ? traitText : '',
  }
}

function renderDecisionList(items, limit = 5) {
  if (!items?.length) return '- 无'
  return items.slice(0, limit).map((item, index) => {
    const decision = NATURE_DECISION_LABELS[item.decision] || item.decision
    return `${index + 1}. **${natureShort(item)}**｜${decision}｜定位：${item.roleLabel || '泛用'}\n` +
      `   - 理由：\n${renderIndentedList(uniqueItems(item.reasons))}\n` +
      `   - 风险：\n${renderIndentedList(uniqueItems(item.warnings))}`
  }).join('\n')
}

function renderEvaluationBlock(item, sharedReasons = []) {
  const decision = NATURE_DECISION_LABELS[item.decision] || item.decision
  const reasons = uniqueItems(item.reasons).filter((reason) => !sharedReasons.includes(reason))
  const warnings = uniqueItems(item.warnings)
  return `- **${natureShort(item)}**｜${decision}｜定位：${item.roleLabel || '泛用'}\n` +
    `  - 个性理由：\n${renderIndentedList(reasons, '无额外理由，主要参考本组公共理由')}\n` +
    `  - 风险：\n${renderIndentedList(warnings)}`
}

function renderNatureComparisonGroups(evaluations, groupKey, statOrder, titlePrefix, sharedTitle, sharedField, renderBlock) {
  const byStat = evaluations.reduce((groups, item) => {
    groups[item[groupKey]] ||= []
    groups[item[groupKey]].push(item)
    return groups
  }, {})
  return statOrder
    .map((stat) => {
      const items = [...(byStat[stat] || [])].sort((a, b) => b.score - a.score)
      if (items.length === 0) return ''
      const sharedItems = commonItems(items.map((item) => item[sharedField] || []))
      const sharedText = sharedItems.length
        ? `**${sharedTitle}**\n\n${sharedItems.map((item) => `- ${item}`).join('\n')}\n\n`
        : ''
      return `#### ${titlePrefix}${STAT_LABELS[stat] || stat}\n\n${sharedText}${items.map((item) => renderBlock(item, sharedItems)).join('\n\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

function renderRaiseGroups(evaluations) {
  const statOrder = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  return renderNatureComparisonGroups(
    evaluations,
    'raise',
    statOrder,
    '强化',
    '本组公共强化理由',
    'reasons',
    renderEvaluationBlock,
  )
}

function routeLabelForCandidate(item) {
  if (item.raise === 'spd') return '速度/节奏'
  if (['patk', 'matk'].includes(item.raise)) return '输出强化'
  if (item.raise === 'hp') return '平衡容错'
  if (['pdef', 'mdef'].includes(item.raise)) return '专项肉度'
  return '其他路线'
}

function isMeaningfulLowerGroup(lower, items) {
  const viable = items.filter((item) => item.decision !== 'notRecommended')
  const viableRoutes = new Set(viable.map(routeLabelForCandidate))
  const hasCheapSacrifice = items.some((item) => (item.reasons || []).some((reason) => /代价较低|牺牲项/.test(reason)))
  const hasSpecialSpeedContext = lower === 'spd' && items.some((item) => (
    [...(item.reasons || []), ...(item.warnings || [])].some((text) => /后手|强化传递|速度线|先手|节奏/.test(text))
  ))
  return viable.length >= 2 || (viable.length >= 1 && viableRoutes.size >= 2 && hasCheapSacrifice) || hasSpecialSpeedContext
}

function renderLowerSummary(evaluations) {
  const statOrder = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  const byLower = evaluations.reduce((groups, item) => {
    groups[item.lower] ||= []
    groups[item.lower].push(item)
    return groups
  }, {})
  const sections = statOrder
    .map((lower) => {
      const items = [...(byLower[lower] || [])].sort((a, b) => b.score - a.score)
      if (items.length === 0 || !isMeaningfulLowerGroup(lower, items)) return ''
      const viable = items.filter((item) => item.decision !== 'notRecommended')
      const routeText = [...new Set(viable.map(routeLabelForCandidate))].join(' / ') || '暂无可保留路线'
      const showReason = viable.length >= 2
        ? '该牺牲项下存在需要横向比较的可保留/推荐路线。'
        : lower === 'spd'
          ? '速度牺牲涉及后手/强化传递/先手节奏冲突，保留摘要用于人工确认。'
          : '该牺牲项下存在特殊机制或路线差异，保留摘要用于人工确认。'
      const lines = items.map((item) => {
        const decision = NATURE_DECISION_LABELS[item.decision] || item.decision
        const keyReasons = uniqueItems(item.reasons).filter((reason) => /符合|更贴合|容错|稳定性|代价较低|强化传递|速度/.test(reason)).slice(0, 2)
        const keyWarnings = uniqueItems(item.warnings).filter((warning) => /风险|削弱|冲突|支配|慢速|速度/.test(warning)).slice(0, 2)
        return `- ${natureShort(item)}｜${decision}｜${routeLabelForCandidate(item)}｜理由：${keyReasons.join('；') || '见增益组'}｜风险：${keyWarnings.join('；') || '无'}`
      }).join('\n')
      return `#### 弱化${STAT_LABELS[lower] || lower}\n\n- 展示原因：${showReason}\n- 主要路线：${routeText}\n\n${lines}`
    })
    .filter(Boolean)
  return sections.length
    ? sections.join('\n\n')
    : '本样例的同减益视角没有产生额外结论，已在“按增益维度对比”中通过支配/风险说明覆盖。'
}

function renderTraitTagDetails(traitTags = []) {
  if (!traitTags.length) return '- 无'
  return traitTags.map((tag) => `- ${tagLabel(tag, TRAIT_LABELS)} → ${statWeightText(TRAIT_TAG_STAT_WEIGHTS[tag])}`).join('\n')
}

function renderRoleBreakdown(roles = []) {
  if (!roles.length) return '- 无'
  return roles.map((role) => `- ${role.label}（权重 ${Math.round(role.weight * 10) / 10}）：${role.reasons.join('；')}`).join('\n')
}

function renderSkillExamples(skillInfo) {
  const skills = skillInfo.skills || []
  if (!skills.length) return '- 无技能资料'
  return skills.slice(0, 8).map((skill) => {
    const tags = (skill.effectTags || []).map((tag) => tagLabel(tag, EFFECT_LABELS)).join(' / ') || '无效果标签'
    return `- ${skill.name || '未知技能'}：${skill.category || '未知类型'} / 威力${skill.power || 0} / 能耗${skill.cost || 0} / 先制${skill.priority || 0}；标签：${tags}；效果：${skill.effect || '无'}`
  }).join('\n') + (skills.length > 8 ? `\n- ……其余 ${skills.length - 8} 条技能已参与统计` : '')
}

function renderSample({ sample, row, skillInfo, evaluations }) {
  const groups = groupByDecision(evaluations)
  const skillProfile = analyzeSkillInfo(skillInfo)
  const counts = Object.entries(skillProfile.effectTagCounts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `${tagLabel(tag, EFFECT_LABELS)}×${count}`)
    .join(' / ') || '暂无效果标签'
  const recommended = groups.recommended || []
  const keepable = groups.keepable || []
  const notRecommended = groups.notRecommended || []
  const topRecommended = recommended.slice(0, 5).map(natureShort).join(' / ') || '无'
  const traitTags = Array.isArray(row.values?.traitTags) ? row.values.traitTags : []
  const roles = inferRoles(row.values || {}, traitTags, skillInfo)
  const traitTagText = traitTags.map((tag) => tagLabel(tag, TRAIT_LABELS)).join(' / ') || '无'

  return `## ${sample.name}${row.values?.form ? `（${row.values.form}）` : ''}\n\n` +
    `- 校准关注：${sample.focus || '未填写'}\n` +
    `- 备注：${sample.notes || '未填写'}\n` +
    `- 编号：${row.values?.no || '未知'}\n` +
    `- 六维：${statSummary(row.values)}\n` +
    `\n### 六维分布\n\n${renderStatDistribution(row.values)}\n\n` +
    `- 特性名称：${row.values?.traitName || '无'}\n` +
    `- 特性效果原文：${row.values?.traitDesc || '无'}\n` +
    `- 特性标签：${traitTagText}\n` +
    `- 技能摘要：${skillProfile.summary}\n` +
    `- 效果标签计数：${counts}\n` +
    `- 分布：${NATURE_DECISION_LABELS.recommended} ${recommended.length} / ${NATURE_DECISION_LABELS.keepable} ${keepable.length} / ${NATURE_DECISION_LABELS.notRecommended} ${notRecommended.length}\n\n` +
    `- 推荐摘要：${topRecommended}\n\n` +
    `### 特性标签倾向\n\n${renderTraitTagDetails(traitTags)}\n\n` +
    `### 技能摘要明细\n\n${renderSkillExamples(skillInfo)}\n\n` +
    `### 综合定位拆解\n\n${renderRoleBreakdown(roles)}\n\n` +
    `### 按增益维度对比（全部 30 个性格）\n\n${renderRaiseGroups(evaluations)}\n\n` +
    `### 关键牺牲项摘要（仅展示有额外信息的同减益对比）\n\n${renderLowerSummary(evaluations)}\n\n` +
    `### 最终分档摘要\n\n` +
    `#### 推荐（前 5）\n\n${renderDecisionList(recommended, 5)}\n\n` +
    `#### 可保留（前 6）\n\n${renderDecisionList(keepable, 6)}\n\n` +
    `#### 不推荐（前 5）\n\n${renderDecisionList(notRecommended, 5)}\n`
}

async function main() {
  const output = pickArgValue('--output') || reportPath
  const [rows, skillRows, samples] = await Promise.all([
    readFile(rowsPath, 'utf8').then(JSON.parse),
    readFile(skillRowsPath, 'utf8').then(JSON.parse),
    readFile(samplesPath, 'utf8').then(JSON.parse),
  ])
  const skillById = new Map(skillRows.map((row) => [row.id, row]))
  const sections = []
  const missing = []

  for (const sample of samples) {
    const matchedRows = findSampleRows(rows, sample)
    if (matchedRows.length === 0) {
      missing.push(sample.name)
      continue
    }
    const row = matchedRows[0]
    const skillInfo = buildSkillInfo(row, skillById)
    const stats = {
      hp: row.values?.hp,
      patk: row.values?.patk,
      matk: row.values?.matk,
      pdef: row.values?.pdef,
      mdef: row.values?.mdef,
      spd: row.values?.spd,
    }
    const evaluations = evaluateAllNatures(stats, row.values?.traitTags || [], skillInfo)
    sections.push(renderSample({ sample, row, skillInfo, evaluations }))
  }

  const now = new Date().toISOString()
  const report = `# 洛克王国性格推荐校准报告\n\n` +
    `生成时间：${now}\n\n` +
    `本报告由 \`npm run check:nature\` 生成，用于人工校准性格推荐规则。它只读取官方 \`d.json\` 同步出的预置精灵与技能资料，不引入阵容、属性克制或战斗模拟。\n\n` +
    `> 样例口径：本轮跳过迪莫。迪莫只有单只、不涉及捕捉保留，并且特性会随战斗叠加攻防速，基础面板性格校准容易把特殊机制误当成通用规则。\n\n` +
    `> 技能口径：技能摘要按官方预置可学技能池统计；血脉类/互斥技能若同一精灵只能选择一种，当前资料源没有可稳定识别的互斥分组字段，因此报告仅作为候选线索，不把全部技能视为可同时携带。后续若官方同步结果提供血脉标记，再按分组单独校准。\n\n` +
    `## 使用方式\n\n` +
    `1. 先看每个样例的“技能摘要”和“效果标签计数”是否符合直觉。\n` +
    `2. 再按“强化生命/物攻/魔攻/物防/魔防/速度”分组横向比较全部 30 个性格，优先找同一强化项里哪个弱化项被误判。\n` +
    `3. 最后看“推荐 / 可保留 / 不推荐”的最终分档是否符合该精灵定位。\n` +
    `4. 如果某类样例普遍偏差，再回到 \`src/domain/nature.js\` 调整对应权重。\n` +
    `5. 调整后重新运行 \`npm run check:nature\`、\`npm run build\`、\`npm run lint\`。\n\n` +
    (missing.length ? `> 未找到样例：${missing.join('、')}\n\n` : '') +
    sections.join('\n\n') + '\n'

  await writeFile(output, report, 'utf8')
  console.log(`wrote ${path.relative(repoRoot, output)}`)
  console.log(`samples: ${sections.length}, missing: ${missing.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
