#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const INPUTS = {
  creatures: 'scripts/data/bwiki/creatures.staging.json',
  skills: 'scripts/data/bwiki/skills.staging.json',
  details: 'scripts/data/bwiki/creature-details.sample.staging.json',
  currentRows: 'public/presets/rockKingdomRows.json',
  currentSkills: 'public/presets/rockKingdomSkillRows.json',
}

const OUTPUTS = {
  rows: 'scripts/data/bwiki/rockKingdomRows.preview.json',
  skills: 'scripts/data/bwiki/rockKingdomSkillRows.preview.json',
  report: 'docs/bwiki-preview-report.md',
}

const ELEMENT_MAP = new Map([
  ['普通', 'normal'], ['草', 'grass'], ['火', 'fire'], ['水', 'water'], ['光', 'light'], ['地', 'earth'],
  ['冰', 'ice'], ['龙', 'dragon'], ['电', 'electric'], ['毒', 'poison'], ['虫', 'bug'], ['武', 'fighting'],
  ['翼', 'flying'], ['萌', 'cute'], ['幽', 'ghost'], ['恶', 'dark'], ['机械', 'mech'], ['幻', 'illusion'],
])
function hashId(prefix, value) {
  return `${prefix}-${createHash('sha1').update(String(value)).digest('hex').slice(0, 12)}`
}

function normalizeName(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

function readValue(row, key) {
  return row?.values?.[key]
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'))
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function indexBy(rows, getter) {
  const map = new Map()
  for (const row of rows) {
    const key = getter(row)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function firstUnique(map, key) {
  const matches = map.get(key) ?? []
  return matches.length === 1 ? matches[0] : null
}

function creatureMatchKey(row) {
  return `${readValue(row, 'no') || ''}|${normalizeName(readValue(row, 'name'))}`
}

function stagedCreatureKey(row) {
  return `${row.no || ''}|${normalizeName(row.name)}`
}

function skillMatchKey(row) {
  return normalizeName(readValue(row, 'name'))
}

function stagedSkillKey(row) {
  return normalizeName(row.name)
}

function mapElements(elements) {
  const mapped = []
  const unknown = []
  for (const element of elements ?? []) {
    const value = ELEMENT_MAP.get(element)
    if (value) mapped.push(value)
    else if (element) unknown.push(element)
  }
  return { mapped, unknown }
}

function mapSkillElement(element) {
  const mapped = ELEMENT_MAP.get(element || '') || ''
  return { mapped, unknown: element && !mapped ? element : '' }
}

function mapSkillCategory(category) {
  if (/物攻|物理/.test(category || '')) return { mapped: 'physical', unknown: '' }
  if (/魔攻|魔法|特殊/.test(category || '')) return { mapped: 'magical', unknown: '' }
  if (/状态|变化|辅助|防御/.test(category || '')) return { mapped: 'status', unknown: '' }
  return { mapped: '', unknown: category || '' }
}

function mapShiny(label) {
  if (label === '是') return 'yes'
  if (label === '否') return 'no'
  return 'unknown'
}

function normalizeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : ''
}

function formatEvolutionLine(evolution = []) {
  return evolution
    .map((step) => [step.name || step.linkName, step.condition].filter(Boolean).join('：'))
    .filter(Boolean)
    .join(' → ')
}

function countBy(rows, getter) {
  const counts = new Map()
  for (const row of rows) {
    const key = getter(row) || '（空）'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
}

function renderCountTable(rows) {
  return rows.map(([label, count]) => `| ${label} | ${count} |`).join('\n') || '| （无） | 0 |'
}

function renderList(items, limit = 40) {
  if (items.length === 0) return '- （无）'
  const visible = items.slice(0, limit).map((item) => `- ${item}`)
  if (items.length > limit) visible.push(`- ……另有 ${items.length - limit} 项`)
  return visible.join('\n')
}

function findCreatureMatch(row, indexes) {
  const exact = firstUnique(indexes.creatureByExact, stagedCreatureKey(row))
  if (exact) return { row: exact, strategy: 'no+name' }
  const byName = firstUnique(indexes.creatureByName, normalizeName(row.name))
  if (byName) return { row: byName, strategy: 'name' }
  const byNo = firstUnique(indexes.creatureByNo, row.no)
  if (byNo) return { row: byNo, strategy: 'unique-no' }
  return { row: null, strategy: 'new' }
}

function findSkillMatch(row, indexes) {
  const byName = firstUnique(indexes.skillByName, stagedSkillKey(row))
  return byName ? { row: byName, strategy: 'name' } : { row: null, strategy: 'new' }
}

function buildPreview({ creatures, skills, details, currentRows, currentSkills, syncedAt }) {
  const detailByCreature = new Map(details.map((row) => [stagedCreatureKey(row), row]))
  const creatureIndexes = {
    creatureByExact: indexBy(currentRows, creatureMatchKey),
    creatureByName: indexBy(currentRows, (row) => normalizeName(readValue(row, 'name'))),
    creatureByNo: indexBy(currentRows, (row) => readValue(row, 'no')),
  }
  const skillIndexes = {
    skillByName: indexBy(currentSkills, skillMatchKey),
  }

  const skillMatches = new Map()
  const skillNameToId = new Map()
  const skillIssues = {
    unknownElements: [],
    unknownCategories: [],
    newRows: [],
    reusedRows: [],
    duplicateNames: [...skillIndexes.skillByName.entries()].filter(([, rows]) => rows.length > 1).map(([name, rows]) => `${name}（现有 ${rows.length} 行）`),
  }

  const skillPreviewRows = skills.map((skill) => {
    const match = findSkillMatch(skill, skillIndexes)
    const id = match.row?.id ?? hashId('rock-skill-bwiki', skill.name)
    const existingValues = match.row?.values ?? {}
    const element = mapSkillElement(skill.element)
    const category = mapSkillCategory(skill.category)
    if (element.unknown) skillIssues.unknownElements.push(`${skill.name}：${element.unknown}`)
    if (category.unknown) skillIssues.unknownCategories.push(`${skill.name}：${category.unknown}`)
    if (match.row) skillIssues.reusedRows.push(`${skill.name} → ${id}`)
    else skillIssues.newRows.push(`${skill.name} → ${id}`)
    skillMatches.set(skill.name, { id, match })
    skillNameToId.set(normalizeName(skill.name), id)
    return {
      id,
      values: {
        ...existingValues,
        image: skill.image || existingValues.image || '',
        name: skill.name,
        element: element.mapped,
        category: category.mapped,
        power: normalizeNumber(skill.power),
        cost: normalizeNumber(skill.cost),
        priority: existingValues.priority || '',
        effectTags: existingValues.effectTags || [],
        effect: skill.effect || existingValues.effect || '',
        learnerRefs: [],
      },
      previewMeta: {
        source: skill.source,
        sourceUrl: skill.sourceUrl,
        detailUrl: skill.detailUrl,
        idStrategy: match.strategy,
        previousId: match.row?.id || '',
      },
    }
  })

  const skillPreviewById = new Map(skillPreviewRows.map((row) => [row.id, row]))
  const creatureIssues = {
    unknownElements: [],
    nonNumericStats: [],
    traitConflicts: [],
    statConflicts: [],
    elementConflicts: [],
    newRows: [],
    reusedRows: [],
    renamedRows: [],
    duplicateNames: [...creatureIndexes.creatureByName.entries()].filter(([, rows]) => rows.length > 1).map(([name, rows]) => `${name}（现有 ${rows.length} 行）`),
  }
  const skillRelationIssues = {
    totalCards: 0,
    matchedCards: 0,
    unmatchedCards: [],
    creaturesWithDetails: details.length,
  }

  const creaturePreviewRows = creatures.map((creature) => {
    const match = findCreatureMatch(creature, creatureIndexes)
    const existingValues = match.row?.values ?? {}
    const id = match.row?.id ?? hashId('rock-creature-bwiki', `${creature.no}|${creature.name}`)
    const detail = detailByCreature.get(stagedCreatureKey(creature))
    const element = mapElements(creature.elements)
    if (element.unknown.length > 0) creatureIssues.unknownElements.push(`${creature.no} ${creature.name}：${element.unknown.join('、')}`)

    const statKeys = ['bst', 'hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
    const stats = Object.fromEntries(statKeys.map((key) => [key, normalizeNumber(creature[key])]))
    for (const [key, value] of Object.entries(stats)) {
      if (value === '') creatureIssues.nonNumericStats.push(`${creature.no} ${creature.name}：${key}`)
      if (match.row && existingValues[key] !== undefined && value !== '' && Number(existingValues[key]) !== Number(value)) {
        creatureIssues.statConflicts.push(`${creature.no} ${creature.name}：${key} ${existingValues[key]} → ${value}`)
      }
    }

    if (match.row) {
      creatureIssues.reusedRows.push(`${creature.no} ${creature.name} → ${id}（${match.strategy}）`)
      if (normalizeName(existingValues.name) !== normalizeName(creature.name)) {
        creatureIssues.renamedRows.push(`${creature.no} ${existingValues.name} → ${creature.name}`)
      }
      const oldElements = Array.isArray(existingValues.element) ? existingValues.element : []
      if (element.mapped.length > 0 && oldElements.join('|') !== element.mapped.join('|')) {
        creatureIssues.elementConflicts.push(`${creature.no} ${creature.name}：${oldElements.join('、') || '（空）'} → ${element.mapped.join('、')}`)
      }
    } else {
      creatureIssues.newRows.push(`${creature.no} ${creature.name} → ${id}`)
    }

    if (detail?.trait?.name && detail.trait.name !== creature.traitName) {
      creatureIssues.traitConflicts.push(`${creature.no} ${creature.name}：筛选页「${creature.traitName || '（空）'}」/ 详情页「${detail.trait.name}」`)
    }

    const skillRefs = []
    for (const skill of detail?.skills ?? []) {
      skillRelationIssues.totalCards += 1
      const skillId = skillNameToId.get(normalizeName(skill.name))
      if (skillId) {
        skillRelationIssues.matchedCards += 1
        if (!skillRefs.includes(skillId)) skillRefs.push(skillId)
        const skillPreview = skillPreviewById.get(skillId)
        if (skillPreview && !skillPreview.values.learnerRefs.includes(id)) skillPreview.values.learnerRefs.push(id)
      } else {
        skillRelationIssues.unmatchedCards.push(`${creature.no} ${creature.name}：${skill.name}`)
      }
    }

    return {
      id,
      values: {
        ...existingValues,
        image: creature.image || existingValues.image || '',
        name: creature.name,
        no: creature.no,
        element: element.mapped,
        form: creature.formCategoryLabel || existingValues.form || '',
        ...stats,
        shiny: mapShiny(creature.shinyLabel),
        traitName: detail?.trait?.name || creature.traitName || existingValues.traitName || '',
        traitTags: existingValues.traitTags || [],
        traitIcon: detail?.trait?.image || existingValues.traitIcon || '',
        traitDesc: detail?.trait?.description || existingValues.traitDesc || '',
        skillTags: existingValues.skillTags || [],
        skillRefs: skillRefs.length > 0 ? skillRefs : existingValues.skillRefs || [],
        eggGroups: creature.eggGroupLabel ? [creature.eggGroupLabel] : existingValues.eggGroups || [],
        speciesGroup: existingValues.speciesGroup || '',
        evolutionLine: formatEvolutionLine(detail?.evolution) || existingValues.evolutionLine || '',
        eggImage: creature.eggImage || existingValues.eggImage || '',
        fruitImage: creature.fruitImage || existingValues.fruitImage || '',
      },
      previewMeta: {
        source: creature.source,
        sourceUrl: creature.sourceUrl,
        detailUrl: creature.detailUrl,
        idStrategy: match.strategy,
        previousId: match.row?.id || '',
        detailStaging: Boolean(detail),
        imageSource: creature.image ? (creature.image.includes('patchwiki') ? 'patchwiki' : 'bwiki') : existingValues.image ? 'existing-public-preset' : 'empty',
      },
    }
  })

  const report = renderReport({
    syncedAt,
    inputs: { creatures, skills, details, currentRows, currentSkills },
    outputs: { creaturePreviewRows, skillPreviewRows },
    creatureIssues,
    skillIssues,
    skillRelationIssues,
  })

  return { creaturePreviewRows, skillPreviewRows, report }
}

function renderReport({ syncedAt, inputs, outputs, creatureIssues, skillIssues, skillRelationIssues }) {
  const imageCounts = countBy(outputs.creaturePreviewRows, (row) => row.previewMeta.imageSource)
  const idStrategyCounts = countBy(outputs.creaturePreviewRows, (row) => row.previewMeta.idStrategy)
  const skillIdStrategyCounts = countBy(outputs.skillPreviewRows, (row) => row.previewMeta.idStrategy)
  const relationRate = skillRelationIssues.totalCards === 0 ? '0.00%' : `${((skillRelationIssues.matchedCards / skillRelationIssues.totalCards) * 100).toFixed(2)}%`

  return `# BWiki preset preview report

Generated at: ${syncedAt}

> This report is generated by \`npm run preview:bwiki\`. It reads BWiki staging/detail staging and current public preset JSON files, then writes preview/audit outputs only. It does **not** overwrite \`public/presets/*\`, does **not** touch Dexie/browser data, and does **not** change UI code.

## Inputs and outputs

| Kind | Count / path |
|---|---:|
| BWiki creature staging rows | ${inputs.creatures.length} |
| BWiki skill staging rows | ${inputs.skills.length} |
| BWiki detail staging rows | ${inputs.details.length} |
| Current public creature preset rows read | ${inputs.currentRows.length} |
| Current public skill preset rows read | ${inputs.currentSkills.length} |
| Creature preview output | \`${OUTPUTS.rows}\` (${outputs.creaturePreviewRows.length} rows) |
| Skill preview output | \`${OUTPUTS.skills}\` (${outputs.skillPreviewRows.length} rows) |

## ID reuse summary

| Creature id strategy | Count |
|---|---:|
${renderCountTable(idStrategyCounts)}

| Skill id strategy | Count |
|---|---:|
${renderCountTable(skillIdStrategyCounts)}

## Name matching and new rows

### Creature renamed matches

${renderList(creatureIssues.renamedRows)}

### New creature ids

${renderList(creatureIssues.newRows)}

### New skill ids

${renderList(skillIssues.newRows)}

## Field conflicts and gaps

### Trait conflicts: filter vs detail staging

${renderList(creatureIssues.traitConflicts)}

### Stat conflicts: current public preset vs BWiki staging

${renderList(creatureIssues.statConflicts)}

### Element conflicts: current public preset vs BWiki staging

${renderList(creatureIssues.elementConflicts)}

### Unknown creature elements

${renderList(creatureIssues.unknownElements)}

### Unknown skill elements

${renderList(skillIssues.unknownElements)}

### Unknown skill categories

${renderList(skillIssues.unknownCategories)}

## Skill relationship coverage

| Detail skill cards | Matched skill cards | Coverage | Unmatched skill names |
|---:|---:|---:|---:|
| ${skillRelationIssues.totalCards} | ${skillRelationIssues.matchedCards} | ${relationRate} | ${skillRelationIssues.unmatchedCards.length} |

${renderList(skillRelationIssues.unmatchedCards)}

## Egg groups / species groups

- Preview writes BWiki filter-page \`eggGroupLabel\` into the existing \`eggGroups\` field as a candidate array.
- Preview keeps current \`speciesGroup\` values when a public preset row was matched; it does not infer new species groups in this batch.

## Image source summary

| Image source | Count |
|---|---:|
${renderCountTable(imageCounts)}

## Safety statement

- \`public/presets/rockKingdomRows.json\` and \`public/presets/rockKingdomSkillRows.json\` were read as shape/id references only.
- No Dexie schema version, migration logic, import/export behavior, user \`owned\` records, or user \`stock\` records were touched.
- This preview is an audit artifact. A later explicit overwrite command must be reviewed separately before replacing public presets.
`
}

async function main() {
  const [creatureStaging, skillStaging, detailStaging, currentRows, currentSkills] = await Promise.all([
    readJson(INPUTS.creatures),
    readJson(INPUTS.skills),
    readJson(INPUTS.details),
    readJson(INPUTS.currentRows),
    readJson(INPUTS.currentSkills),
  ])
  const syncedAt = new Date().toISOString()
  const { creaturePreviewRows, skillPreviewRows, report } = buildPreview({
    creatures: creatureStaging.rows ?? [],
    skills: skillStaging.rows ?? [],
    details: detailStaging.rows ?? [],
    currentRows,
    currentSkills,
    syncedAt,
  })

  await Promise.all([
    writeJson(OUTPUTS.rows, {
      source: 'bwiki-preview',
      generatedAt: syncedAt,
      inputs: INPUTS,
      rowCount: creaturePreviewRows.length,
      rows: creaturePreviewRows,
    }),
    writeJson(OUTPUTS.skills, {
      source: 'bwiki-preview',
      generatedAt: syncedAt,
      inputs: INPUTS,
      rowCount: skillPreviewRows.length,
      rows: skillPreviewRows,
    }),
    writeFile(OUTPUTS.report, report, 'utf8'),
  ])

  console.log(`wrote ${OUTPUTS.rows} (${creaturePreviewRows.length} rows)`)
  console.log(`wrote ${OUTPUTS.skills} (${skillPreviewRows.length} rows)`)
  console.log(`wrote ${OUTPUTS.report}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
