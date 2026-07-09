#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateAllNatures, inferRoles, STAT_LABELS } from '../src/domain/nature.js'
import { TRAIT_TAG_OPTIONS } from '../src/presets/rockKingdom.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const rowsPath = path.join(repoRoot, 'public/presets/rockKingdomRows.json')
const skillRowsPath = path.join(repoRoot, 'public/presets/rockKingdomSkillRows.json')
const samplesPath = path.join(repoRoot, 'scripts/data/natureCalibrationSamples.json')
const outputPath = path.join(repoRoot, 'docs/rocom-position-audit-plan.md')

const TRAIT_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((option) => [option.value, option.label]))
const STAT_KEYS = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
const STAT_SHORT_LABELS = { hp: '生', patk: '物攻', matk: '魔攻', pdef: '物防', mdef: '魔防', spd: '速' }
const P50_HP = 91
const P75_HP = 110
const P75_PDEF = 102
const P75_MDEF = 101
const P75_SPD = 100

function readJson(filePath) {
  return readFile(filePath, 'utf8').then((text) => JSON.parse(text))
}

function md(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

function statSummary(values = {}) {
  return STAT_KEYS.map((key) => `${STAT_SHORT_LABELS[key]}${values[key] ?? 0}`).join(' / ')
}

function tagSummary(tags = []) {
  return tags.map((tag) => `${TRAIT_LABELS[tag] || tag}（${tag}）`).join('<br>') || '无'
}

function skillInfoFor(row, skillById) {
  const refs = Array.isArray(row.values?.skillRefs) ? row.values.skillRefs : []
  return refs
    .map((id) => skillById.get(id)?.values)
    .filter(Boolean)
    .map((values) => ({
      name: values.name,
      category: values.category,
      type: values.category,
      power: values.power,
      effect: values.effect,
      effectTags: values.effectTags,
    }))
}

function buildStats(values = {}) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, values[key] ?? 0]))
}

function topRoles(values, traitTags, skills) {
  return inferRoles(buildStats(values), traitTags, skills)
    .slice(0, 3)
    .map((role) => `${role.label}${Number(role.weight).toFixed(1)}`)
    .join('<br>') || '无'
}

function recommendedSummary(values, traitTags, skills) {
  const recommended = evaluateAllNatures(buildStats(values), traitTags, skills)
    .filter((item) => item.decision === 'recommended')
    .slice(0, 3)
  if (!recommended.length) return '暂无推荐'
  return recommended
    .map((item) => `${item.name}(+${STAT_LABELS[item.raise]}-${STAT_LABELS[item.lower]})`)
    .join('<br>')
}

function rowKey(row) {
  return `${row.values?.name || ''}::${row.values?.form || ''}`
}

function assignBatch(row, calibrationKeys) {
  const values = row.values || {}
  if (calibrationKeys.has(rowKey(row))) return { batch: '第 1 批', focus: '当前校准样例/争议样例，优先核对外部定位与推荐解释' }
  if ((values.hp || 0) < P50_HP && ((values.pdef || 0) >= P75_PDEF || (values.mdef || 0) >= P75_MDEF)) {
    return { batch: '第 2 批', focus: '低生命 + 高单防，核对是否被外部评价为脆或专项抗性' }
  }
  if ((values.hp || 0) + (values.pdef || 0) + (values.mdef || 0) >= 285 || (values.hp || 0) >= P75_HP) {
    return { batch: '第 3 批', focus: '综合肉度/高生命，核对耐久站场标签与生命性格' }
  }
  if ((values.spd || 0) >= P75_SPD || (values.traitTags || []).includes('spdLean') || (values.skillTags || []).includes('speed')) {
    return { batch: '第 4 批', focus: '速度线/先手节奏，核对保速、加速或后手例外' }
  }
  return { batch: '后续批次', focus: '常规样例，按编号分批补充外部资料' }
}

function batchSortValue(batch) {
  return { '第 1 批': 1, '第 2 批': 2, '第 3 批': 3, '第 4 批': 4, 后续批次: 5 }[batch] || 9
}

function tableRows(rows, skillById, calibrationKeys) {
  return rows
    .map((row) => {
      const values = row.values || {}
      const traits = Array.isArray(values.traitTags) ? values.traitTags : []
      const skills = skillInfoFor(row, skillById)
      const { batch, focus } = assignBatch(row, calibrationKeys)
      return {
        batch,
        no: values.no || '',
        name: values.name || '',
        form: values.form || '',
        stats: statSummary(values),
        tags: tagSummary(traits),
        roles: topRoles(values, traits, skills),
        recommendations: recommendedSummary(values, traits, skills),
        focus,
      }
    })
    .sort((a, b) => batchSortValue(a.batch) - batchSortValue(b.batch) || a.no.localeCompare(b.no, 'zh-Hans-CN'))
    .map((item) => `| ${md(item.batch)} | 待外部核对 | ${md(item.no)} | ${md(item.name)} | ${md(item.form)} | ${md(item.stats)} | ${md(item.tags)} | ${md(item.roles)} | ${md(item.recommendations)} | ${md(item.focus)} | 待补充 | 待补充 |`)
}

async function main() {
  const [rows, skillRows, samples] = await Promise.all([readJson(rowsPath), readJson(skillRowsPath), readJson(samplesPath)])
  const skillById = new Map(skillRows.map((row) => [row.id, row]))
  const calibrationKeys = new Set(samples.map((sample) => `${sample.name}::${sample.form || '最终形态'}`))
  const bodyRows = tableRows(rows, skillById, calibrationKeys)
  const batchCounts = bodyRows.reduce((counts, row) => {
    const batch = row.split('|')[1].trim()
    counts[batch] = (counts[batch] || 0) + 1
    return counts
  }, {})

  const markdown = `# 洛克王国精灵定位外部核对计划

> 目的：分批核对外部攻略/百科/社区对精灵定位的描述，与本工具的资料倾向标签、综合定位和性格推荐规则做对照，沉淀可复查的校准依据。

## 核对原则

1. **以本仓库官方同步数据为计算基准**：外部资料只用于理解玩家定位与玩法口径，不直接替代 \`public/presets/rockKingdomRows.json\` / \`public/presets/rockKingdomSkillRows.json\`。
2. **覆盖全部预置精灵**：本表已列出当前 ${rows.length} 条洛克王国预置精灵，每条都有当前状态、批次、六维、标签、综合定位和推荐摘要。
3. **分批推进**：先核对当前校准争议样例，再核对低生命高单防、综合肉度、速度线样例，最后按编号推进剩余精灵。
4. **记录来源与日期**：每个结论需要记录搜索日期、来源链接、关键词和摘要，避免把临时环境评价写成永久规则。
5. **先找规则问题，再讨论权重**：优先定位标签来源、阈值、解释文案和分档门槛是否合理；不做单只精灵手工特判。
6. **遇到口径冲突就暂停确认**：如果外部资料分歧很大，或资料明显过时，需要先和维护者确认再调整规则。

## 状态流转

| 状态 | 含义 |
|---|---|
| 待外部核对 | 已生成本地标签/推荐摘要，但尚未搜索外部资料。 |
| 核对中 | 正在搜索并记录来源。 |
| 待人工确认 | 外部资料与本地规则冲突，或资料口径分歧，需要维护者确认。 |
| 已核对-无差异 | 外部定位与当前标签/推荐基本一致。 |
| 已核对-需调整 | 已确认规则/标签/解释存在问题，需要进入后续规则调整。 |

## 批次定义

| 批次 | 数量 | 核对重点 |
|---|---:|---|
| 第 1 批 | ${batchCounts['第 1 批'] || 0} | 当前校准样例/争议样例，优先核对外部定位与推荐解释。 |
| 第 2 批 | ${batchCounts['第 2 批'] || 0} | 低生命 + 高单防，核对是否被外部评价为脆或只是专项抗性。 |
| 第 3 批 | ${batchCounts['第 3 批'] || 0} | 综合肉度/高生命，核对耐久站场标签与生命性格。 |
| 第 4 批 | ${batchCounts['第 4 批'] || 0} | 速度线/先手节奏，核对保速、加速或后手例外。 |
| 后续批次 | ${batchCounts['后续批次'] || 0} | 常规样例，按编号继续分批补充外部资料。 |

## 每只精灵核对字段

| 字段 | 说明 |
|---|---|
| 批次 | 自动按当前争议样例、低生命高单防、综合肉度、速度线和剩余样例分类。 |
| 当前状态 | 初始均为“待外部核对”，后续人工维护。 |
| 本地六维 | 生命、物攻、魔攻、物防、魔防、速度。 |
| 本地标签 | 当前资料行的 \`traitTags\`。 |
| 本地综合定位 | \`inferRoles()\` 当前前三项和权重。 |
| 当前推荐摘要 | 当前 \`evaluateAllNatures()\` 的前三个推荐性格。 |
| 核对重点 | 本批次应重点验证的问题。 |
| 外部定位摘要 | 后续搜索后填写。 |
| 来源 | URL、查询关键词、访问日期。 |

## 全量核对清单

| 批次 | 当前状态 | 编号 | 精灵 | 形态 | 本地六维 | 本地标签 | 本地综合定位 | 当前推荐摘要 | 核对重点 | 外部定位摘要 | 来源 |
|---|---|---|---|---|---|---|---|---|---|---|---|
${bodyRows.join('\n')}
`

  await writeFile(outputPath, markdown, 'utf8')
  console.log(`wrote ${path.relative(repoRoot, outputPath)} with ${rows.length} rows`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
