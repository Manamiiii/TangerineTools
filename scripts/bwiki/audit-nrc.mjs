#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBwikiPaths, resolveRepoPath } from './lib/paths.mjs'
import { sha256 } from './lib/snapshots.mjs'
import { SOURCE_NOTICES } from './lib/source-manifest.mjs'
import { NRC_SKILL_SOURCES } from './lib/nrc-parser.mjs'
import { mapElements, mapSkillElement, mapSkillCategory, mapShiny, normalizeNumber } from './build-preview.mjs'

const nameKey = (name) => String(name ?? '').replace(/\s+/g, '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sorted = (values) => [...new Set(values)].sort()
const entry = (row) => ({ name: row.name, no: row.no, sourceId: row.sourceId, url: row.detailUrl || row.sourceUrl })
const base = (row) => ({ id: row.id, name: row.values.name, no: row.values.no })

function uniqueIndex(rows, key, label) {
  const index = new Map()
  for (const row of rows) {
    const value = key(row)
    if (!value || index.has(value)) throw new Error(`${label}: missing or duplicate key ${value}`)
    index.set(value, row)
  }
  return index
}

// This report compares source observations, never preview fallback values or approved identities.
export function auditNrc({ staging, currentRows, currentSkills }) {
  const version = staging.creatures?.version
  for (const key of ['creatures', 'skills', 'breeding', 'details']) {
    const input = staging[key]
    if (!version || input?.source !== 'bwiki-nrc' || input.version !== version || !Array.isArray(input.rows) || input.rowCount !== input.rows.length) {
      throw new Error(`Invalid NRC staging: ${key} source/version/rowCount`)
    }
  }
  const { creatures, skills, breeding, details } = Object.fromEntries(Object.entries(staging).map(([key, input]) => [key, input.rows]))
  const oldCreatures = uniqueIndex(currentRows, (row) => nameKey(row.values.name), 'formal creatures')
  const oldSkills = uniqueIndex(currentSkills, (row) => nameKey(row.values.name), 'formal skills')
  const newCreatures = uniqueIndex(creatures, (row) => nameKey(row.name), 'NRC creatures')
  const newSkills = uniqueIndex(skills, (row) => nameKey(row.name), 'NRC skills')
  const bySource = uniqueIndex(creatures, (row) => row.sourceId, 'NRC creature ids')
  const detailIndex = uniqueIndex(details, (row) => row.sourceId, 'NRC details')
  const breedingIndex = uniqueIndex(breeding, (row) => row.sourceId, 'NRC breeding')
  for (const row of [...details, ...breeding]) {
    const creature = bySource.get(row.sourceId)
    if (!creature || creature.name !== row.name || creature.no !== row.no) throw new Error(`NRC identity mismatch: ${row.name}`)
  }
  if (breedingIndex.size !== bySource.size) throw new Error('NRC breeding coverage mismatch')

  const report = {
    version,
    sourceNotices: SOURCE_NOTICES,
    inputHashes: Object.fromEntries(Object.entries({ ...staging, currentRows, currentSkills }).map(([key, value]) => [key, sha256(JSON.stringify(value))])),
    sources: Object.fromEntries(Object.entries(staging).map(([key, value]) => [key, { attribution: value.attribution, provenance: value.provenance }])),
    counts: { formalCreatures: currentRows.length, nrcCreatures: creatures.length, formalSkills: currentSkills.length, nrcSkills: skills.length, details: details.length },
    unmatchedCreatures: [], absentCreatures: [], identityCandidates: [],
    creatureChanges: [], skillChanges: [], addedSkills: [], absentSkills: [],
    categoryMappings: [], unknownFields: [], missingDetails: [], detailIssues: [],
    missingShinyImages: [], unexpectedShinyImages: [], femaleOnly: [],
    upstreamBlockers: [...new Set(Object.values(staging).flatMap((input) => input.releaseBlockers ?? []))],
  }
  const absent = currentRows.filter((row) => !newCreatures.has(nameKey(row.values.name)))
  report.absentCreatures = absent.map(base)
  for (const creature of creatures) {
    const old = oldCreatures.get(nameKey(creature.name))
    const info = entry(creature)
    if (!old) {
      report.unmatchedCreatures.push(info)
      // Same number only proposes a manual comparison; it never establishes a rename or reuses an id.
      const candidates = absent.filter((row) => row.values.no === creature.no).map(base)
      if (candidates.length) report.identityCandidates.push({ ...info, candidates })
    }
    const egg = breedingIndex.get(creature.sourceId)
    if (egg.femaleOnly) report.femaleOnly.push({ ...info, url: egg.sourceUrl })
    const shiny = mapShiny(creature.shinyLabel)
    if (shiny === 'yes' && !creature.shinyImage) report.missingShinyImages.push(info)
    if (shiny !== 'yes' && creature.shinyImage) report.unexpectedShinyImages.push(info)
    const elements = mapElements(creature.elements)
    if (elements.unknown.length) report.unknownFields.push({ ...info, field: 'element', values: elements.unknown })
    const detail = detailIndex.get(creature.sourceId)
    if (!detail) report.missingDetails.push(info)
    const changes = []
    const compare = (field, value, normalize = (v) => v ?? '') => {
      if (old && !same(normalize(old.values[field]), normalize(value))) changes.push({ field, before: old.values[field] ?? '', after: value })
    }
    compare('no', creature.no)
    if (!elements.unknown.length) compare('element', elements.mapped, (v) => sorted(v || []))
    compare('shiny', shiny)
    compare('eggGroups', egg.eggGroups, (v) => sorted((v || []).map((g) => g === '未发现' ? '无法孵蛋' : g)))
    if (detail) {
      const statKeys = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
      if (statKeys.some((key) => !Number.isFinite(detail.stats?.[key]) || detail.stats[key] <= 0) || statKeys.reduce((sum, key) => sum + detail.stats[key], 0) !== detail.stats.bst) {
        throw new Error(`Invalid detail stats: ${creature.name}`)
      }
      for (const field of [...statKeys, 'bst']) compare(field, detail.stats[field], normalizeNumber)
      compare('traitName', detail.trait?.name || '')
      compare('traitDesc', detail.trait?.description || '')
      const skillNames = sorted((detail.skills ?? []).map((row) => nameKey(row.name)))
      const unknown = skillNames.filter((name) => !newSkills.has(name))
      if (unknown.length) report.detailIssues.push({ ...info, issue: '详情技能在聚合页中缺失', names: unknown })
      if (!detail.skills?.length) report.detailIssues.push({ ...info, issue: '详情缺少技能' })
      if (!detail.evolution?.length || detail.evolutionReviewRequired) report.detailIssues.push({ ...info, issue: '进化分支缺少可靠匹配' })
      const sourceTypes = sorted((detail.skills ?? []).map((row) => row.sourceType))
      if (sourceTypes.some((type) => !NRC_SKILL_SOURCES.includes(type))) report.detailIssues.push({ ...info, issue: '未知技能来源', names: sourceTypes })
      if (old) {
        const oldIds = new Set(old.values.skillRefs || [])
        const previous = sorted(currentSkills.filter((row) => oldIds.has(row.id)).map((row) => nameKey(row.values.name)))
        if (!same(previous, skillNames)) changes.push({ field: 'skillNames', before: previous, after: skillNames })
      }
    }
    if (changes.length) report.creatureChanges.push({ ...info, id: old.id, changes })
  }
  for (const skill of skills) {
    const old = oldSkills.get(nameKey(skill.name))
    const category = mapSkillCategory(skill.category)
    const element = mapSkillElement(skill.element)
    for (const [field, result] of [['category', category], ['element', element]]) {
      if (result.unknown) report.unknownFields.push({ ...entry(skill), field, values: [result.unknown] })
    }
    if (!old) { report.addedSkills.push(entry(skill)); continue }
    if (category.mapped === old.values.category && skill.category === '防御') report.categoryMappings.push({ ...entry(skill), raw: skill.category, mapped: category.mapped })
    const normalized = { element: element.mapped, category: category.mapped, cost: normalizeNumber(skill.cost), power: normalizeNumber(skill.power), effect: skill.effect || '' }
    const changes = Object.entries(normalized).flatMap(([field, after]) => {
      if ((field === 'element' && element.unknown) || (field === 'category' && category.unknown)) return []
      const before = ['cost', 'power'].includes(field) ? normalizeNumber(old.values[field]) : old.values[field] || ''
      return same(before, after) ? [] : [{ field, before, after }]
    })
    if (changes.length) report.skillChanges.push({ ...entry(skill), id: old.id, changes, baselineLearners: currentRows.filter((row) => (row.values.skillRefs || []).includes(old.id)).map(base) })
  }
  report.absentSkills = currentSkills.filter((row) => !newSkills.has(nameKey(row.values.name))).map(base)
  return report
}

const cell = (value) => (Array.isArray(value) ? value.join('、') : String(value ?? '')).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replace(/[\r\n]+/g, ' / ')
const link = (row) => row.url ? `[${cell(row.name).replaceAll('[', '&#91;').replaceAll(']', '&#93;')}](<${row.url.replaceAll('>', '%3E')}>)` : cell(row.name)
function table(headers, rows) {
  return rows.length ? `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}` : '无。'
}
export function renderNrcAudit(report) {
  const sections = []
  const add = (title, body) => sections.push(`## ${title}\n\n${body}`)
  add('范围', `批次：${cell(report.version)}。正式精灵 ${report.counts.formalCreatures} → NRC ${report.counts.nrcCreatures}，技能 ${report.counts.formalSkills} → ${report.counts.nrcSkills}；详情 ${report.counts.details} / ${report.counts.nrcCreatures}。\n\n比较直接读取 staging 与正式基线，不读取 preview 回填值。差异是待核对候选，文本变化不自动等于平衡调整；缺详情不代表未变化。生成成功不表示可发布。JSON 附完整输入指纹与采集来源。`)
  add('身份待核对（不自动改名或复用 ID）', table(['NRC 名称', '编号', '同编号且正式名称缺席的候选'], report.identityCandidates.map((row) => [link(row), cell(row.no), cell(row.candidates.map((candidate) => `${candidate.name} (${candidate.id})`))])))
  add('未匹配精灵（含疑似改名）', table(['名称', '编号', '来源 ID'], report.unmatchedCreatures.map((row) => [link(row), cell(row.no), cell(row.sourceId)])))
  add('正式名称未出现在 NRC', table(['名称', '编号', '稳定 ID'], report.absentCreatures.map((row) => [cell(row.name), cell(row.no), cell(row.id)])))
  add('精灵字段差异', table(['名称', '字段', '正式值', 'NRC 值'], report.creatureChanges.flatMap((row) => row.changes.map((change) => [link(row), cell(change.field), cell(change.before), cell(change.after)]))))
  add('技能字段差异', table(['技能', '字段', '正式值', 'NRC 值', '正式技能池关联精灵数'], report.skillChanges.flatMap((row) => row.changes.map((change) => [link(row), cell(change.field), cell(change.before), cell(change.after), row.baselineLearners.length]))))
  add('技能影响范围', table(['技能', '正式技能池关联精灵（不代表推荐必变）'], report.skillChanges.map((row) => [link(row), cell(row.baselineLearners.map((creature) => creature.name))])))
  add('新增技能', table(['名称'], report.addedSkills.map((row) => [link(row)])))
  add('正式技能名称未出现在 NRC', table(['名称', '稳定 ID'], report.absentSkills.map((row) => [cell(row.name), cell(row.id)])))
  add('分类表示差异', `以下 ${report.categoryMappings.length} 个技能的“防御”按现有映射归入 status，不单独计作平衡变化。\n\n${table(['技能', '源类别', '现有映射'], report.categoryMappings.map((row) => [link(row), cell(row.raw), cell(row.mapped)]))}`)
  add('仅雌性标记（尚未接入孵蛋规则）', table(['名称', '编号'], report.femaleOnly.map((row) => [link(row), cell(row.no)])))
  for (const [title, rows] of [['存在异色但源页面缺图', report.missingShinyImages], ['非存在异色标记却有源图片', report.unexpectedShinyImages], ['缺少详情', report.missingDetails]]) add(title, table(['名称', '编号', '来源 ID'], rows.map((row) => [link(row), cell(row.no), cell(row.sourceId)])))
  add('详情问题', table(['名称', '问题', '相关值'], report.detailIssues.map((row) => [link(row), cell(row.issue), cell(row.names)])))
  add('未知字段', table(['名称', '字段', '源值'], report.unknownFields.map((row) => [link(row), cell(row.field), cell(row.values)])))
  add('上游发布阻塞', report.upstreamBlockers.map((value) => `- ${cell(value)}`).join('\n') || '上游未附阻塞；本报告不构成发布批准。')
  add('来源与许可', `${Object.values(report.sourceNotices).map((source) => `- [${cell(source.name)}](<${source.url}>)；${cell(source.authors)}；[${cell(source.license)}](<${source.licenseUrl}>)。${cell(source.scope)}`).join('\n')}\n\n正式基线来自 rocom，候选来自 NRC。各条 NRC 原页见表中链接；正式行原页见 src/presets/rockKingdomSources.json。报告将双方资料整理为差异，分别遵循来源许可，不将旧站内容重新声明为 NRC 授权。`)
  return `# NRC 原始资料差异审计\n\n${sections.join('\n\n')}\n`
}

async function main() {
  if (process.argv.length > 2) throw new Error('audit:bwiki:nrc does not accept arguments')
  const paths = getBwikiPaths('nrc')
  const inputs = { ...Object.fromEntries(['creatures', 'skills', 'details', 'breeding'].map((key) => [key, paths.staging[key]])), currentRows: paths.presets.creatures, currentSkills: paths.presets.skills }
  const parsed = Object.fromEntries(await Promise.all(Object.entries(inputs).map(async ([key, path]) => [key, JSON.parse(await readFile(resolveRepoPath(path), 'utf8'))])))
  const { currentRows, currentSkills, ...staging } = parsed
  const report = auditNrc({ staging, currentRows, currentSkills })
  const destination = resolveRepoPath('artifacts/bwiki/nrc/diff-report')
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(`${destination}.json`, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(`${destination}.md`, renderNrcAudit(report))
  console.log(JSON.stringify({ version: report.version, unmatchedCreatures: report.unmatchedCreatures.length, identityCandidates: report.identityCandidates.length, changedSkills: report.skillChanges.length, addedSkills: report.addedSkills.length, missingDetails: report.missingDetails.length, report: `${destination}.md` }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1 })
