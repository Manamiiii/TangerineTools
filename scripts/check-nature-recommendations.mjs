#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATURE_DECISION_LABELS,
  STAT_LABELS,
  evaluateAllNatures,
  analyzeSkillInfo,
} from '../src/domain/nature.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const rowsPath = path.join(repoRoot, 'public/presets/rockKingdomRows.json')
const skillRowsPath = path.join(repoRoot, 'public/presets/rockKingdomSkillRows.json')
const samplesPath = path.join(repoRoot, 'scripts/data/natureCalibrationSamples.json')
const reportPath = path.join(repoRoot, 'docs/nature-calibration-report.md')

function pickArgValue(name) {
  const prefix = `${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefix))
  return matched ? matched.slice(prefix.length) : ''
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

function topReason(item) {
  return item.reasons?.[0] || '暂无推荐理由'
}

function topWarning(item) {
  return item.warnings?.[0] || '暂无明显风险'
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
  return { skills }
}

function renderDecisionList(items, limit = 5) {
  if (!items?.length) return '- 无'
  return items.slice(0, limit).map((item, index) => (
    `${index + 1}. ${natureShort(item)} — ${topReason(item)}${item.warnings?.length ? `；风险：${topWarning(item)}` : ''}`
  )).join('\n')
}

function renderEvaluationLine(item) {
  const decision = NATURE_DECISION_LABELS[item.decision] || item.decision
  return `- ${natureShort(item)}｜${decision}｜${topReason(item)}${item.warnings?.length ? `；风险：${topWarning(item)}` : ''}`
}

function renderRaiseGroups(evaluations) {
  const statOrder = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  const byRaise = evaluations.reduce((groups, item) => {
    groups[item.raise] ||= []
    groups[item.raise].push(item)
    return groups
  }, {})
  return statOrder
    .map((raise) => {
      const items = [...(byRaise[raise] || [])].sort((a, b) => b.score - a.score)
      if (items.length === 0) return ''
      return `#### 强化${STAT_LABELS[raise] || raise}\n\n${items.map(renderEvaluationLine).join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

function renderSample({ sample, row, skillInfo, evaluations }) {
  const groups = groupByDecision(evaluations)
  const skillProfile = analyzeSkillInfo(skillInfo)
  const counts = Object.entries(skillProfile.effectTagCounts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `${tag}×${count}`)
    .join(' / ') || '暂无效果标签'
  const recommended = groups.recommended || []
  const keepable = groups.keepable || []
  const notRecommended = groups.notRecommended || []
  const topRecommended = recommended.slice(0, 5).map(natureShort).join(' / ') || '无'

  return `## ${sample.name}${row.values?.form ? `（${row.values.form}）` : ''}\n\n` +
    `- 校准关注：${sample.focus || '未填写'}\n` +
    `- 备注：${sample.notes || '未填写'}\n` +
    `- 编号：${row.values?.no || '未知'}\n` +
    `- 六维：${statSummary(row.values)}\n` +
    `- 特性标签：${(row.values?.traitTags || []).join(' / ') || '无'}\n` +
    `- 技能摘要：${skillProfile.summary}\n` +
    `- 效果标签计数：${counts}\n` +
    `- 分布：${NATURE_DECISION_LABELS.recommended} ${recommended.length} / ${NATURE_DECISION_LABELS.keepable} ${keepable.length} / ${NATURE_DECISION_LABELS.notRecommended} ${notRecommended.length}\n\n` +
    `- 推荐摘要：${topRecommended}\n\n` +
    `### 按增益维度对比（全部 30 个性格）\n\n${renderRaiseGroups(evaluations)}\n\n` +
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
