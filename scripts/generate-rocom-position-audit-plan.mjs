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
const findingsPath = path.join(repoRoot, 'scripts/data/rocomAuditFindings.json')
const outputPath = path.join(repoRoot, 'docs/generated/rocom-position-audit-plan.md')

const TRAIT_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((option) => [option.value, option.label]))
const STAT_KEYS = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
const STAT_SHORT_LABELS = { hp: '生', patk: '物攻', matk: '魔攻', pdef: '物防', mdef: '魔防', spd: '速' }
const P50_HP = 91
const P75_HP = 110
const P75_PDEF = 102
const P75_MDEF = 101
const P75_SPD = 100
const BULK_P75 = 301

function readJson(filePath) {
  return readFile(filePath, 'utf8').then((text) => JSON.parse(text))
}

function validateFindings(findings) {
  if (!findings || typeof findings !== 'object' || Array.isArray(findings)) {
    throw new TypeError('rocomAuditFindings.json 必须是以“精灵名::形态”为键的对象')
  }
  for (const [key, finding] of Object.entries(findings)) {
    if (!key.includes('::')) throw new TypeError(`RoCom 核对键格式错误：${key}`)
    for (const field of ['status', 'summary', 'source']) {
      if (typeof finding?.[field] !== 'string' || !finding[field].trim()) {
        throw new TypeError(`RoCom 核对项 ${key} 缺少 ${field}`)
      }
    }
  }
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
  if (((values.hp || 0) + (values.pdef || 0) + (values.mdef || 0) >= BULK_P75 && (values.hp || 0) >= P50_HP) || (values.hp || 0) >= P75_HP) {
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

function tableRows(rows, skillById, calibrationKeys, externalAuditFindings) {
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
        finding: externalAuditFindings[rowKey(row)] || null,
      }
    })
    .sort((a, b) => batchSortValue(a.batch) - batchSortValue(b.batch) || a.no.localeCompare(b.no, 'zh-Hans-CN'))
    .map((item) => `| ${md(item.batch)} | ${md(item.finding?.status || '待外部核对')} | ${md(item.no)} | ${md(item.name)} | ${md(item.form)} | ${md(item.stats)} | ${md(item.tags)} | ${md(item.roles)} | ${md(item.recommendations)} | ${md(item.focus)} | ${md(item.finding?.summary || '待补充')} | ${md(item.finding?.source || '待补充')} |`)
}

async function main() {
  const [rows, skillRows, samples, externalAuditFindings] = await Promise.all([
    readJson(rowsPath),
    readJson(skillRowsPath),
    readJson(samplesPath),
    readJson(findingsPath),
  ])
  const skillById = new Map(skillRows.map((row) => [row.id, row]))
  validateFindings(externalAuditFindings)
  const calibrationKeys = new Set(samples.map((sample) => `${sample.name}::${sample.form || '最终形态'}`))
  const bodyRows = tableRows(rows, skillById, calibrationKeys, externalAuditFindings)
  const batchCounts = bodyRows.reduce((counts, row) => {
    const batch = row.split('|')[1].trim()
    counts[batch] = (counts[batch] || 0) + 1
    return counts
  }, {})

  const markdown = `# 洛克王国精灵定位外部核对计划

> 本文由 \`npm run audit:rocom\` 生成基础清单与本地推荐摘要；已确认的外部核对结论维护在 \`scripts/data/rocomAuditFindings.json\`。请不要手工编辑本报告，也不要把批次当作日常执行顺序：日常仍按用户捕捉进度“一只精灵一轮”推进。

> 目的：按图鉴顺序逐只核对洛克王国世界外部攻略/百科/社区对精灵定位的描述，与本工具的资料倾向标签、综合定位和性格推荐规则做对照，帮助玩家捕捉时当场确认“推荐 / 可保留 / 不推荐”的性格取舍，并沉淀可复查的校准依据。

## 核对原则

1. **以本仓库官方同步数据为计算基准**：外部资料只用于理解玩家定位与玩法口径，不直接替代 \`public/presets/rockKingdomRows.json\` / \`public/presets/rockKingdomSkillRows.json\`。
2. **覆盖全部预置精灵**：本表已列出当前 ${rows.length} 条洛克王国预置精灵，每条都有当前状态、批次、六维、标签、综合定位和推荐摘要。
3. **主流程改为逐只推进**：默认从图鉴最前开始，随捕捉进度“一只精灵一轮”核对；批次字段保留为后台筛选和专题回归用，不再作为日常核对主流程。
4. **只使用洛克王国世界资料**：排除旧网页游戏“洛克王国”资料；若来源无法确认是新游资料，先不作为结论依据。
5. **关注定位评价，不照抄性格推荐**：外部性格推荐最多作为旁证，主要记录外部对精灵、技能、机制和实战定位的评价。
6. **记录来源与日期**：每个结论需要记录搜索日期、来源链接、关键词和摘要，避免把临时环境评价写成永久规则。
7. **逐只确认，规则复用**：每只精灵都可以给出当下捕捉建议；若发现偏差，优先沉淀为可复用规则，不做只服务单只精灵的硬编码特判。
8. **遇到口径冲突就暂停确认**：如果外部资料分歧很大，或资料明显过时，需要先和维护者确认再调整规则。


## 执行模式建议：逐只捕捉核对为主，批次只作回归索引

本项目当前最适合的节奏是“用户捕捉到哪只，就分析哪只”：一次只处理 1 只精灵，必要时带 1-2 个同编号形态或进化链对照。这样每轮输出能直接服务捕捉保留，不会被大批量报告淹没。Codex Cloud 默认负责读取本地数据、搜索洛克王国世界资料、归纳定位、给出性格取舍，并在需要时改规则和重跑报告。ChatGPT Work / 最新模型只作为**可选增强**，用于资料来源特别多、观点冲突复杂、或需要二次评审的单只精灵。

| 工作类型 | 默认执行方 | 何时引入 ChatGPT Work | 交付物 | 交接方式 |
|---|---|---|---|---|
| 单只精灵捕捉核对 | Codex Cloud | 资料来源很多、需要更强网页归纳时 | 单只精灵定位、性格保留建议、来源、待确认问题 | Codex 直接回复；需要沉淀时更新本文档并提交 PR。 |
| 专题批次回归 | Codex Cloud | 同类问题超过 10 只，或需要大量网页归纳时 | 审计表更新、规则问题清单、待确认问题 | Codex 直接改本文档；资料量特别大时可交给 ChatGPT Work。 |
| 推荐规则优化 | Codex Cloud | 规则口径不确定，需要先做高层推理评审时 | 代码补丁、重跑后的报告、测试结果 | Codex 修改规则并跑 \`check:nature\` / \`audit:rocom\`。正式预置仅走 BWiki 发布流程。 |
| 工具 UI / 可运行功能 | Codex Cloud | 需要多方案设计或文案评审时 | 可运行 UI 改动、截图/构建结果 | Codex 开发并本地验证；明显 UI 改动需截图。 |
| 新功能拆解 | Codex Cloud 或 ChatGPT Work | 范围很大、需要先拆路线图时 | 范围文档、任务列表、边界说明 | 先确认边界，再由 Codex 实现可验证部分。 |

协作原则：

1. **默认单端闭环**：能在 Codex Cloud 完成搜索、分析、改代码和跑检查的轮次，就不要额外引入 ChatGPT Work，避免流程变重。
2. **一轮只设一个主执行方**：如果引入 ChatGPT Work，它负责资料归纳或方案评审；Codex Cloud 负责最终代码、生成文件和本地回归。不要两边同时改同一批文件。
3. **先逐只确认，再专题回归**：日常按图鉴顺序逐只确认；当连续多只暴露同类偏差时，再开专题批次统一修规则并重跑全量标签/报告。
4. **ChatGPT Work 可以写 GitHub，但 PR 类型要受控**：资料审计/规则口径文档可以直接 PR；推荐规则代码、同步脚本、生成文件大改动必须由 Codex Cloud 拉取后本地复验。
5. **外部资料不直接决定推荐性格**：外部资料只记录定位、机制、强弱评价；最终性格仍由本仓库规则产出。
6. **每只确认后要有可复查记录**：更新本表状态、来源、摘要和待人工确认项；避免口头结论丢失。
7. **冲突集中给用户确认**：资料冲突、版本口径冲突、或会影响大量精灵的阈值变化，先标记“待人工确认”。

### 每轮标准流程（单只精灵）

| 步骤 | 默认执行方 | 用户输入 | 产出 | 是否需要 ChatGPT Work |
|---|---|---|---|---|
| 0. 指定本轮精灵 | 用户 | 编号/名称/形态、捕捉目标、是否已有候选性格 | 本轮任务说明 | 否。 |
| 1. 本地基线读取 | Codex Cloud | 当前分支与目标精灵 | 六维、标签、技能摘要、综合定位、推荐/可保留/不推荐摘要 | 否。 |
| 2. 外部资料核对 | Codex Cloud | 只看洛克王国世界、不要照抄性格推荐 | 外部定位评价、关键机制、来源链接、与本地差异 | 资料冲突复杂时可选。 |
| 3. 捕捉取舍建议 | Codex Cloud | 本地 + 外部定位 | 本轮建议：推荐性格、可保留性格、明确不保留性格、原因和风险 | 否。 |
| 4. 用户确认/捕捉决策 | 用户 | 是否认可玩法口径、是否要保留某类性格 | 最终口径：已确认 / 待人工确认 / 需调规则 | 可选。 |
| 5. 记录或落地 | Codex Cloud | 用户确认结果 | 更新审计状态；如改规则则重跑 check:nature/audit/lint/build 并提交 PR | 通常不需要。 |

### 推荐的 Codex Cloud 单端输入格式

大多数轮次直接使用这个格式即可：

\`\`\`md
## 本轮 Codex 任务
- 范围：单只精灵（编号 / 名称 / 形态），必要时附同编号形态或进化链
- 目标：捕捉时性格取舍核对 / 定位核对 / 规则问题记录
- 资料口径：只看洛克王国世界；不采用旧网页游戏洛克王国；不照抄外部推荐性格
- 是否允许改代码：默认否；只有确认是通用规则问题时才改
- 不允许做：不改 Dexie schema、不引入战斗模拟、不直接照抄外部推荐性格、不做硬编码单只特判
- 输出要求：推荐性格 / 可保留性格 / 不推荐性格；说明本地依据、外部定位、风险和是否需要记录到审计表
- 必跑命令：仅在改规则或文档生成脚本时运行 check:nature / audit:rocom / lint / build / git diff --check
- 需要暂停确认的情况：外部资料冲突、会影响大批阈值、需要用户判断玩法口径
\`\`\`

### ChatGPT Work 交接包格式（可选）

只有在需要大量资料搜索或外部评审时使用。ChatGPT Work 做资料搜索或分析时，建议输出以下结构，方便直接贴给 Codex Cloud：

\`\`\`md
## 本轮范围
- 精灵：NO.xxx 名称（形态）
- 上下文：捕捉中 / 已有候选性格 / 需要同编号形态对比
- 目标：定位核对 / 规则口径分析 / UI 方案 / 新功能拆解

## 外部资料口径
- 只使用洛克王国世界资料：是/否
- 排除旧网页洛克王国资料：是/否
- 搜索日期：YYYY-MM-DD

## 单只精灵结论
### NO.xxx 名称（形态）
- 外部定位摘要：高速输出 / 启动压制 / 低生命高单防但偏脆 / 等
- 关键机制：技能、特性、节奏、站场、后手、传递等
- 来源：URL + 一句话说明
- 与本地差异：本地标签/综合定位/推荐摘要哪里不一致
- 建议状态：已核对-无差异 / 待人工确认 / 已核对-需调整 / 核对中
- 建议动作：不改规则 / 需要用户确认 / 建议 Codex 调整某类规则
- 置信度：高 / 中 / 低

## 需要用户确认
1. 问题 A：...
2. 问题 B：...

## 给 Codex Cloud 的实现建议
- 只改文档 / 改标签阈值 / 改 src/domain/nature.js / 改 UI / 需要重跑哪些脚本
\`\`\`

### GitHub PR 分工建议

| PR 类型 | ChatGPT Work 是否适合直接提交 | Codex Cloud 是否需要复验 | 说明 |
|---|---|---|---|
| 资料搜索 / 审计台账文档 | 可以 | 可选 | 适合 ChatGPT Work 更新来源、摘要、待确认问题；Codex 也可直接完成。 |
| 规则口径文档 / 方案设计 | 可以 | 可选 | 不改代码时可直接由 ChatGPT Work 提 PR。 |
| 推荐规则代码 / 同步脚本 | 不作为默认路径；可做草案 | 必须 | Codex Cloud 需要本地重跑数据、报告、lint、build。 |
| UI 原型 / 新功能代码 | 可做草案 | 必须 | Codex Cloud 负责本地验证、截图和冲突处理。 |
| 生成文件大改动 | 不建议 | 必须 | 生成文件应由 Codex Cloud 运行脚本产出，避免手改报告或预置 JSON。 |

## 状态流转

| 状态 | 含义 |
|---|---|
| 待外部核对 | 已生成本地标签/推荐摘要，但尚未搜索外部资料。 |
| 核对中 | 正在搜索并记录来源。 |
| 待人工确认 | 外部资料与本地规则冲突，或资料口径分歧，需要维护者确认。 |
| 已核对-无差异 | 外部定位与当前标签/推荐基本一致。 |
| 已核对-需调整 | 已确认规则/标签/解释存在问题，需要进入后续规则调整。 |

## 批次定义（专题回归索引，不是日常处理顺序）

批次字段仍然有用：它用于发现连续多只精灵暴露的同类规则问题，并在确认通用口径后做专题回归。日常捕捉建议不按批次推进，优先处理用户本轮给出的编号/名称/形态。

| 批次 | 数量 | 核对重点 |
|---|---:|---|
| 第 1 批 | ${batchCounts['第 1 批'] || 0} | 当前校准样例/争议样例；保留为专题回归用，日常仍按图鉴逐只推进。 |
| 第 2 批 | ${batchCounts['第 2 批'] || 0} | 低生命 + 高单防，核对是否被外部评价为脆或只是专项抗性。 |
| 第 3 批 | ${batchCounts['第 3 批'] || 0} | 综合肉度/高生命，核对耐久站场标签与生命性格。 |
| 第 4 批 | ${batchCounts['第 4 批'] || 0} | 速度线/先手节奏，核对保速、加速或后手例外。 |
| 后续批次 | ${batchCounts['后续批次'] || 0} | 常规样例，按编号继续分批补充外部资料。 |

## 每只精灵核对字段

| 字段 | 说明 |
|---|---|
| 批次 | 自动按当前争议样例、低生命高单防、综合肉度、速度线和剩余样例分类；主要用于筛选专题问题，不再代表日常处理顺序。 |
| 当前状态 | 初始均为“待外部核对”；已核对状态在 \`scripts/data/rocomAuditFindings.json\` 中人工维护。 |
| 本地六维 | 生命、物攻、魔攻、物防、魔防、速度。 |
| 本地标签 | 当前资料行的 \`traitTags\`。 |
| 本地综合定位 | \`inferRoles()\` 当前前三项和权重。 |
| 当前推荐摘要 | 当前 \`evaluateAllNatures()\` 的前三个推荐性格。 |
| 核对重点 | 本批次应重点验证的问题。 |
| 外部定位摘要 | 后续搜索后填写。 |
| 来源 | URL、查询关键词、访问日期。 |

## 第 1 批执行记录

本次在收紧耐久/防御基础阈值后重新生成第 1 批本地标签与推荐摘要，并继续按“只看洛克王国世界、不照抄推荐性格、重点核对定位评价”的口径整理外部资料。旧网页游戏洛克王国来源已从结论依据中移除；耐久标签过宽的问题已在彩蝶鲨、影狸等样例上得到缓解，影狸的双攻转单攻分支已按规则覆盖；剩余待人工确认项主要集中在迅捷启动/站场型机制、资料不足或外部口径分歧。

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
