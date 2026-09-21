import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBwikiPaths, resolveRepoPath } from './lib/paths.mjs'
import { sha256 } from './lib/snapshots.mjs'

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const cell = value => String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replaceAll('|', '&#124;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\s+/g, ' ')

// Read-only technical review. Publication approval is deliberately not an input.
export function reviewNrc({ staging, creatures, skills, currentCreatures, currentSkills }) {
  const errors = []
  const check = (ok, message) => { if (!ok) errors.push(message) }
  check(creatures.sourceProfile === 'nrc' && skills.sourceProfile === 'nrc', '候选来源不是 NRC')
  check(Boolean(creatures.sourceVersion) && creatures.sourceVersion === skills.sourceVersion, '候选版本不一致')
  for (const [key, value] of Object.entries(staging)) {
    check(value.source === 'bwiki-nrc' && value.version === creatures.sourceVersion, `${key} 来源或版本不一致`)
    check(value.rowCount === value.rows.length, `${key} 行数不一致`)
    const hash = sha256(JSON.stringify(value))
    check(creatures.stagingHashes?.[key] === hash && skills.stagingHashes?.[key] === hash, `${key} 指纹不一致`)
  }
  check(staging.details.errorCount === 0 && !staging.details.missing?.length && !staging.details.failures?.length, '详情存在缺口或错误')
  check(staging.details.rows.length === creatures.rows.length, '详情与候选不等量')
  const detailById = new Map(staging.details.rows.map(row => [row.sourceId, row]))
  const creatureByName = new Map(creatures.rows.map(row => [row.values.name, row]))
  const skillByName = new Map(skills.rows.map(row => [row.values.name, row]))
  const creatureById = new Map(creatures.rows.map(row => [row.id, row]))
  const skillById = new Map(skills.rows.map(row => [row.id, row]))
  const stats = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  for (const [label, payload, baseline] of [['精灵', creatures, currentCreatures], ['技能', skills, currentSkills]]) {
    check(payload.rowCount === payload.rows.length, `${label} 候选行数不一致`)
    check(new Set(payload.rows.map(row => row.id)).size === payload.rows.length, `${label} ID 重复`)
    check(new Set(payload.rows.map(row => row.values.name)).size === payload.rows.length, `${label} 名称重复`)
    for (const row of baseline) check(payload.rows.some(next => next.id === row.id), `${label} 旧 ID 遗漏：${row.id}`)
  }
  const sourceCounts = {}
  for (const source of staging.creatures.rows) {
    const row = creatureByName.get(source.name)
    const detail = detailById.get(source.sourceId)
    check(Boolean(row && detail && detail.name === source.name), `详情身份缺失：${source.name}`)
    if (!row || !detail) continue
    check(stats.every(key => row.values[key] > 0 && row.values[key] === detail.stats[key]) && stats.reduce((sum, key) => sum + row.values[key], 0) === row.values.bst, `六维不一致：${source.name}`)
    check(Boolean(row.values.speciesGroup && row.values.eggGroups?.length), `繁育字段缺失：${source.name}`)
    check(row.values.shiny === 'yes' ? Boolean(row.values.shinyImage) : !row.values.shinyImage, `异色图矛盾：${source.name}`)
    const expected = new Set()
    for (const relation of detail.skills) {
      sourceCounts[relation.sourceType] = (sourceCounts[relation.sourceType] ?? 0) + 1
      const skill = skillByName.get(relation.name)
      check(Boolean(skill), `缺技能：${source.name} / ${relation.name}`)
      if (skill) expected.add(skill.id)
    }
    check(equal([...expected].sort(), [...(row.values.skillRefs ?? [])].sort()), `技能来源并集不一致：${source.name}`)
    for (const id of row.values.skillRefs ?? []) check(skillById.get(id)?.values.learnerRefs?.includes(row.id), `技能反向引用缺失：${source.name} / ${id}`)
  }
  for (const source of staging.skills.rows) {
    const row = skillByName.get(source.name)
    check(Boolean(row), `缺技能正文：${source.name}`)
    if (!row) continue
    for (const key of ['cost', 'effect']) check(equal(row.values[key], source[key]), `技能${key}不一致：${source.name}`)
    check(equal(row.values.power, source.power ?? ''), `技能威力不一致：${source.name}`)
    for (const id of row.values.learnerRefs ?? []) check(creatureById.get(id)?.values.skillRefs?.includes(row.id), `精灵正向引用缺失：${source.name} / ${id}`)
  }
  const changes = [], additions = []
  for (const [kind, payload, baseline] of [['精灵', creatures, currentCreatures], ['技能', skills, currentSkills]]) {
    const old = new Map(baseline.map(row => [row.id, row]))
    for (const row of payload.rows) {
      const previous = old.get(row.id)
      if (!previous) { additions.push({ kind, id: row.id, name: row.values.name }); continue }
      const fields = Object.keys(row.values).filter(key => {
        if (['skillRefs', 'learnerRefs', 'element', 'eggGroups'].includes(key)) return !equal([...(previous.values[key] ?? [])].sort(), [...(row.values[key] ?? [])].sort())
        return !equal(previous.values[key], row.values[key])
      }).map(field => {
        const change = { field, before: previous.values[field], after: row.values[field] }
        if (field === 'skillRefs') {
          const names = new Map([...currentSkills, ...skills.rows].map(skill => [skill.id, skill.values.name]))
          change.removed = (previous.values[field] ?? []).filter(id => !row.values[field].includes(id)).map(id => names.get(id) || id)
          change.added = row.values[field].filter(id => !(previous.values[field] ?? []).includes(id)).map(id => names.get(id) || id)
        }
        return change
      })
      if (fields.length) changes.push({ kind, id: row.id, name: row.values.name, fields })
    }
  }
  return { version: creatures.sourceVersion, errors, sourceCounts, additions, changes,
    inputHashes: { creatures: sha256(JSON.stringify(creatures)), skills: sha256(JSON.stringify(skills)), currentCreatures: sha256(JSON.stringify(currentCreatures)), currentSkills: sha256(JSON.stringify(currentSkills)) },
    releaseBlockers: [...new Set([...(creatures.releaseBlockers ?? []), ...(skills.releaseBlockers ?? [])])],
    publicationApproved: false }
}

export function renderReview(report) {
  const lines = ['# NRC 候选技术检查与发布审阅清单', '', `批次：${report.version}。技术检查：${report.errors.length ? '失败' : '通过'}。本报告不批准发布，不修改正式预置或迁移清单。`, '', '## 检查问题', '', ...report.errors.map(error => `- ${cell(error)}`), ...(report.errors.length ? [] : ['无。']), '', '## 技能学习来源', '', ...Object.entries(report.sourceCounts).map(([source, count]) => `- ${source}：${count} 条关系。`), '', '候选按四种来源并集生成可用技能，按技能 ID 去重，不表示某个收藏个体已解锁这些技能。', '', '## 新增资料', '', ...report.additions.map(row => `- ${row.kind}：${cell(row.name)}（${row.id}）`), '', '## 发布待确认', '', ...report.releaseBlockers.map(row => `- ${cell(row)}`), '', '## 内容差异', '', '以下排除图片地址、派生标签、引用顺序及繁育兼容字段；完整字段旧值、新值和输入指纹见同名 JSON。差异不自动等于游戏平衡调整。', '']
  const relevant = new Set(['name', 'no', 'hp', 'patk', 'matk', 'pdef', 'mdef', 'spd', 'bst', 'shiny', 'traitName', 'traitDesc', 'power', 'cost', 'effect', 'skillRefs'])
  for (const row of report.changes) {
    const fields = row.fields.filter(field => relevant.has(field.field))
    if (!fields.length) continue
    lines.push(`### ${cell(row.kind)}：${cell(row.name)}`, '', '| 字段 | 旧值 | 候选值 |', '|---|---|---|')
    for (const change of fields) lines.push(change.field === 'skillRefs'
      ? `| 技能池增减 | 移除：${cell(change.removed.join('、') || '无')} | 新增：${cell(change.added.join('、') || '无')} |`
      : `| ${change.field} | ${cell(change.before)} | ${cell(change.after)} |`)
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

async function main() {
  if (process.argv.length > 2) throw new Error('review:bwiki:nrc 不接受参数或发布选项')
  const paths = getBwikiPaths('nrc')
  const json = async path => JSON.parse(await readFile(resolveRepoPath(path), 'utf8'))
  const staging = Object.fromEntries(await Promise.all(['creatures', 'skills', 'details', 'breeding'].map(async key => [key, await json(paths.staging[key])])))
  const report = reviewNrc({ staging, creatures: await json(paths.preview.creatures), skills: await json(paths.preview.skills), currentCreatures: await json(paths.presets.creatures), currentSkills: await json(paths.presets.skills) })
  const destination = resolveRepoPath('artifacts/bwiki/nrc/publication-review')
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(`${destination}.json`, JSON.stringify(report, null, 2) + '\n')
  await writeFile(`${destination}.md`, renderReview(report))
  console.log(JSON.stringify({ errors: report.errors, addedCreatures: report.additions.filter(row => row.kind === '精灵').length, addedSkills: report.additions.filter(row => row.kind === '技能').length, publicationApproved: false, report: `${destination}.md` }, null, 2))
  if (report.errors.length) process.exitCode = 1
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1 })
