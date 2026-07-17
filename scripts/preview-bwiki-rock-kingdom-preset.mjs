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
  breedingRows: 'public/presets/rockKingdomBreedingRows.json',
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
  if (value === null || value === undefined || value === '') return ''
  return Number.isFinite(Number(value)) ? Number(value) : ''
}

function deriveForm(creature, existingValues) {
  if (existingValues.form) return { value: existingValues.form, strategy: 'existing' }
  const nameForm = String(creature.name ?? '').match(/（([^）]+)）/)?.[1] ?? ''
  if (nameForm) return { value: nameForm, strategy: 'name' }
  const stageForm = new Map([
    ['一阶', 'Ⅰ阶'],
    ['二阶', 'Ⅱ阶'],
    ['三阶', '最终形态'],
  ]).get(creature.stageLabel)
  if (stageForm) return { value: stageForm, strategy: 'stage' }
  return { value: creature.formCategoryLabel || '', strategy: creature.formCategoryLabel ? 'category' : 'empty' }
}

function formatEvolutionLine(evolution = []) {
  const names = evolution.map((step) => step.name || step.linkName).filter(Boolean)
  if (names.length === 0) return ''
  const first = names[0]
  const branchStarts = names.map((name, index) => (name === first ? index : -1)).filter((index) => index >= 0)
  const branches = branchStarts.map((start, index) => {
    const end = branchStarts[index + 1] ?? names.length
    return names.slice(start, end)
  }).filter((branch) => branch.length > 0)
  if (branches.length <= 1) return names.join(' → ')

  let commonLength = 0
  while (branches.every((branch) => branch[commonLength] && branch[commonLength] === branches[0][commonLength])) {
    commonLength += 1
  }
  const commonPrefix = branches[0].slice(0, commonLength)
  const suffixes = branches.map((branch) => branch.slice(commonLength)).filter((suffix) => suffix.length > 0)
  if (commonPrefix.length > 0 && suffixes.length === branches.length) {
    return `${commonPrefix.join(' → ')} →（${suffixes.map((suffix) => suffix.join(' → ')).join(' / ')}）`
  }
  return branches.map((branch) => branch.join(' → ')).join('；')
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

function findDuplicateIds(rows) {
  const counts = new Map()
  for (const row of rows) counts.set(row.id, (counts.get(row.id) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${id}（${count} 行）`)
}

function findCreatureMatch(row, indexes) {
  const exact = firstUnique(indexes.creatureByExact, stagedCreatureKey(row))
  if (exact) return { row: exact, strategy: 'no+name' }
  const byName = firstUnique(indexes.creatureByName, normalizeName(row.name))
  if (byName) return { row: byName, strategy: 'name' }
  return { row: null, strategy: 'new' }
}

function findSkillMatch(row, indexes) {
  const byName = firstUnique(indexes.skillByName, stagedSkillKey(row))
  return byName ? { row: byName, strategy: 'name' } : { row: null, strategy: 'new' }
}

function findBreedingMatch(row, indexes) {
  const exact = firstUnique(indexes.breedingByExact, stagedCreatureKey(row))
  if (exact) return exact
  return firstUnique(indexes.breedingByName, normalizeName(row.name))
}

function valuesDiffer(left, right) {
  return JSON.stringify(left ?? '') !== JSON.stringify(right ?? '')
}

function countFieldChanges(previewRows, currentRows, fields) {
  const currentById = new Map(currentRows.map((row) => [row.id, row]))
  return fields.map((field) => [field, previewRows.filter((row) => {
    const current = currentById.get(row.id)
    return current && valuesDiffer(current.values?.[field], row.values?.[field])
  }).length])
}

function buildPreview({ creatures, skills, details, currentRows, currentSkills, breedingRows, syncedAt }) {
  const detailByCreature = new Map(details.map((row) => [stagedCreatureKey(row), row]))
  const creatureIndexes = {
    creatureByExact: indexBy(currentRows, creatureMatchKey),
    creatureByName: indexBy(currentRows, (row) => normalizeName(readValue(row, 'name'))),
  }
  const skillIndexes = {
    skillByName: indexBy(currentSkills, skillMatchKey),
  }
  const breedingIndexes = {
    breedingByExact: indexBy(breedingRows, (row) => `${row.no || ''}|${normalizeName(row.name)}`),
    breedingByName: indexBy(breedingRows, (row) => normalizeName(row.name)),
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
    elementOrderChanges: [],
    elementValueChanges: [],
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
    const breeding = findBreedingMatch(creature, breedingIndexes)
    const element = mapElements(creature.elements)
    const form = deriveForm(creature, existingValues)
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
        const change = `${creature.no} ${creature.name}：${oldElements.join('、') || '（空）'} → ${element.mapped.join('、')}`
        const isOrderOnly = [...oldElements].sort().join('|') === [...element.mapped].sort().join('|')
        if (isOrderOnly) creatureIssues.elementOrderChanges.push(change)
        else creatureIssues.elementValueChanges.push(change)
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
        form: form.value,
        ...stats,
        shiny: mapShiny(creature.shinyLabel),
        traitName: detail?.trait?.name || creature.traitName || existingValues.traitName || '',
        traitTags: existingValues.traitTags || [],
        traitIcon: detail?.trait?.image || existingValues.traitIcon || '',
        traitDesc: detail?.trait?.description || existingValues.traitDesc || '',
        skillTags: existingValues.skillTags || [],
        skillRefs: skillRefs.length > 0 ? skillRefs : existingValues.skillRefs || [],
        eggGroups: existingValues.eggGroups?.length ? existingValues.eggGroups : breeding?.eggGroups || [],
        speciesGroup: existingValues.speciesGroup || breeding?.speciesGroup || '',
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
        formStrategy: form.strategy,
        formCategoryLabel: creature.formCategoryLabel || '',
        isMainForm: Boolean(creature.isMainForm),
        seasonLabel: creature.seasonLabel || '',
        breedingSource: breeding?.sourceUrl || '',
        imageSource: creature.image ? (creature.image.includes('patchwiki') ? 'patchwiki' : 'bwiki') : existingValues.image ? 'existing-public-preset' : 'empty',
      },
    }
  })

  for (const creature of creaturePreviewRows) {
    for (const skillId of creature.values.skillRefs ?? []) {
      const skill = skillPreviewById.get(skillId)
      if (skill && !skill.values.learnerRefs.includes(creature.id)) skill.values.learnerRefs.push(creature.id)
    }
  }

  const previewCreatureIds = new Set(creaturePreviewRows.map((row) => row.id))
  const omittedCurrentCreatures = currentRows
    .filter((row) => !previewCreatureIds.has(row.id))
    .map((row) => `${readValue(row, 'no') || '（无编号）'} ${readValue(row, 'name') || row.id} → ${row.id}`)
  const relationConsistency = {
    forwardEdges: 0,
    reverseEdges: 0,
    missingReverse: [],
    missingForward: [],
    danglingSkillRefs: [],
    danglingLearnerRefs: [],
  }
  const creaturePreviewById = new Map(creaturePreviewRows.map((row) => [row.id, row]))
  for (const creature of creaturePreviewRows) {
    for (const skillId of creature.values.skillRefs ?? []) {
      relationConsistency.forwardEdges += 1
      const skill = skillPreviewById.get(skillId)
      if (!skill) relationConsistency.danglingSkillRefs.push(`${creature.values.no} ${creature.values.name} → ${skillId}`)
      else if (!skill.values.learnerRefs.includes(creature.id)) relationConsistency.missingReverse.push(`${creature.values.no} ${creature.values.name} → ${skill.values.name}`)
    }
  }
  for (const skill of skillPreviewRows) {
    for (const creatureId of skill.values.learnerRefs ?? []) {
      relationConsistency.reverseEdges += 1
      const creature = creaturePreviewById.get(creatureId)
      if (!creature) relationConsistency.danglingLearnerRefs.push(`${skill.values.name} → ${creatureId}`)
      else if (!creature.values.skillRefs.includes(skill.id)) relationConsistency.missingForward.push(`${skill.values.name} → ${creature.values.no} ${creature.values.name}`)
    }
  }

  const creatureFieldChanges = countFieldChanges(creaturePreviewRows, currentRows, [
    'image', 'element', 'form', 'bst', 'hp', 'patk', 'matk', 'pdef', 'mdef', 'spd', 'shiny',
    'traitName', 'traitIcon', 'traitDesc', 'skillRefs', 'eggGroups', 'speciesGroup', 'evolutionLine',
    'eggImage', 'fruitImage',
  ])
  const skillFieldChanges = countFieldChanges(skillPreviewRows, currentSkills, [
    'image', 'element', 'category', 'power', 'cost', 'priority', 'effect', 'learnerRefs',
  ])

  const report = renderReport({
    syncedAt,
    inputs: { creatures, skills, details, currentRows, currentSkills, breedingRows },
    outputs: { creaturePreviewRows, skillPreviewRows },
    creatureIssues,
    skillIssues,
    skillRelationIssues,
    relationConsistency,
    omittedCurrentCreatures,
    creatureFieldChanges,
    skillFieldChanges,
    duplicateCreatureIds: findDuplicateIds(creaturePreviewRows),
    duplicateSkillIds: findDuplicateIds(skillPreviewRows),
  })

  return { creaturePreviewRows, skillPreviewRows, report }
}

function renderReport({ syncedAt, inputs, outputs, creatureIssues, skillIssues, skillRelationIssues, relationConsistency, omittedCurrentCreatures, creatureFieldChanges, skillFieldChanges, duplicateCreatureIds, duplicateSkillIds }) {
  const imageCounts = countBy(outputs.creaturePreviewRows, (row) => row.previewMeta.imageSource)
  const idStrategyCounts = countBy(outputs.creaturePreviewRows, (row) => row.previewMeta.idStrategy)
  const skillIdStrategyCounts = countBy(outputs.skillPreviewRows, (row) => row.previewMeta.idStrategy)
  const relationRate = skillRelationIssues.totalCards === 0 ? '0.00%' : `${((skillRelationIssues.matchedCards / skillRelationIssues.totalCards) * 100).toFixed(2)}%`
  const creaturesWithSkillRefs = outputs.creaturePreviewRows.filter((row) => row.values.skillRefs.length > 0).length
  const creaturesWithoutSkillRefs = outputs.creaturePreviewRows.length - creaturesWithSkillRefs
  const emptyImageRows = outputs.creaturePreviewRows.filter((row) => !row.values.image).map((row) => `${row.values.no} ${row.values.name}`)
  const p4Blockers = [
    inputs.details.length < inputs.creatures.length ? `详情 staging 仅覆盖 ${inputs.details.length} / ${inputs.creatures.length} 条精灵` : '',
    creaturesWithoutSkillRefs ? `仍有 ${creaturesWithoutSkillRefs} 条精灵没有技能引用` : '',
    relationConsistency.missingReverse.length || relationConsistency.missingForward.length || relationConsistency.danglingSkillRefs.length || relationConsistency.danglingLearnerRefs.length ? '技能双向关系仍不一致' : '',
    emptyImageRows.length ? `仍有 ${emptyImageRows.length} 条精灵缺少图片` : '',
  ].filter(Boolean)

  return `# BWiki 预置 preview 报告

生成时间：${syncedAt}

> 本报告由 \`npm run preview:bwiki\` 生成。脚本只读取 BWiki staging / detail staging 与当前 public preset JSON，然后只写入 preview / 审计产物。它**不会**覆盖 \`public/presets/*\`，**不会**触碰 Dexie / 浏览器用户数据，也**不会**修改 UI 代码。

## 输入与输出

| 类型 | 数量 / 路径 |
|---|---:|
| BWiki 精灵 staging 行数 | ${inputs.creatures.length} |
| BWiki 技能 staging 行数 | ${inputs.skills.length} |
| BWiki 详情 staging 行数 | ${inputs.details.length} |
| 已读取当前 public 精灵预置行数 | ${inputs.currentRows.length} |
| 已读取当前 public 技能预置行数 | ${inputs.currentSkills.length} |
| 已读取孵蛋补充快照行数 | ${inputs.breedingRows.length} |
| 精灵 preview 输出 | \`${OUTPUTS.rows}\`（${outputs.creaturePreviewRows.length} 行） |
| 技能 preview 输出 | \`${OUTPUTS.skills}\`（${outputs.skillPreviewRows.length} 行） |

## ID 复用摘要

| 精灵 id 策略 | 数量 |
|---|---:|
${renderCountTable(idStrategyCounts)}

| 技能 id 策略 | 数量 |
|---|---:|
${renderCountTable(skillIdStrategyCounts)}

### 重复 preview id

精灵 preview 重复 id：

${renderList(duplicateCreatureIds)}

技能 preview 重复 id：

${renderList(duplicateSkillIds)}

## 名称匹配与新增行

### 精灵改名匹配

${renderList(creatureIssues.renamedRows)}

### 新增精灵 id

${renderList(creatureIssues.newRows)}

### 新增技能 id

${renderList(skillIssues.newRows)}

### 当前稳定精灵 id 未进入 preview

${renderList(omittedCurrentCreatures)}

> 用户已确认这些旧行均能在新版数据中找到对应精灵，差异主要来自“（本来的样子）”等括号文本消失。它们不再阻塞 P4；现有浏览器仍按 merge-by-id 保留旧行和 owned 引用，覆盖命令不得主动删除或重写用户引用。

## 字段变化摘要

### 精灵字段

| 字段 | 变化行数 |
|---|---:|
${renderCountTable(creatureFieldChanges)}

### 技能字段

| 字段 | 变化行数 |
|---|---:|
${renderCountTable(skillFieldChanges)}

## 字段冲突与缺口

### 特性冲突：筛选页 vs 详情页 staging

${renderList(creatureIssues.traitConflicts)}

### 种族值冲突：当前 public 预置 vs BWiki staging

${renderList(creatureIssues.statConflicts)}

### 系别顺序变化：当前 public 预置 vs BWiki staging

${renderList(creatureIssues.elementOrderChanges)}

### 系别实质变化：当前 public 预置 vs BWiki staging

${renderList(creatureIssues.elementValueChanges)}

> 用户已确认 BWiki 系别变化符合预期；技能与精灵系别继续以 BWiki staging 为新版本主来源。

### 空值 / 非数字种族值

${renderList(creatureIssues.nonNumericStats)}

### 未识别精灵系别

${renderList(creatureIssues.unknownElements)}

### 未识别技能系别

${renderList(skillIssues.unknownElements)}

### 未识别技能类型

${renderList(skillIssues.unknownCategories)}

## 技能关系覆盖率

| 详情技能卡总数 | 已匹配技能卡 | 覆盖率 | 未匹配技能名数量 |
|---:|---:|---:|---:|
| ${skillRelationIssues.totalCards} | ${skillRelationIssues.matchedCards} | ${relationRate} | ${skillRelationIssues.unmatchedCards.length} |

${renderList(skillRelationIssues.unmatchedCards)}

### Preview 全量双向一致性

| 有技能引用的精灵 | 精灵 → 技能边数 | 技能 → 精灵边数 | 缺反向关系 | 缺正向关系 | 悬空技能引用 | 悬空精灵引用 |
|---:|---:|---:|---:|---:|---:|---:|
| ${creaturesWithSkillRefs} / ${outputs.creaturePreviewRows.length} | ${relationConsistency.forwardEdges} | ${relationConsistency.reverseEdges} | ${relationConsistency.missingReverse.length} | ${relationConsistency.missingForward.length} | ${relationConsistency.danglingSkillRefs.length} | ${relationConsistency.danglingLearnerRefs.length} |

> 详情技能卡覆盖率只衡量已抓取详情样本中的技能名能否匹配；全量双向一致性用于检查最终 preview 中的 \`skillRefs\` / \`learnerRefs\` 是否互相对应。

## 蛋组 / 繁育谱系

- BWiki 精灵筛选页的 \`data-param8\` 是归属赛季，preview 只把它保留在 \`previewMeta.seasonLabel\` 供审计，不写入蛋组。
- 已匹配精灵保留当前 public 预置中的 \`eggGroups\` / \`speciesGroup\`；空值或新增精灵只从版本化的孵蛋补充快照按“编号 + 名称”或唯一名称安全补齐。

## 图片来源摘要

| 图片来源 | 数量 |
|---|---:|
${renderCountTable(imageCounts)}

缺少精灵图片的行：

${renderList(emptyImageRows)}

## P4 准入判断

${p4Blockers.length ? `当前 **不建议进入 P4 覆盖**：\n\n${renderList(p4Blockers)}` : '当前 preview 未发现自动阻塞项，可以进入 P4 显式覆盖命令设计；正式覆盖仍需用户明确授权。'}

## 安全声明

- \`public/presets/rockKingdomRows.json\` 和 \`public/presets/rockKingdomSkillRows.json\` 只作为形状 / id 参考被读取。
- 未触碰 Dexie schema version、迁移逻辑、导入 / 导出行为、用户 \`owned\` 记录或用户 \`stock\` 记录。
- 本 preview 是审计产物。后续如需替换 public presets，必须另行审阅显式覆盖命令。
`
}

async function main() {
  const [creatureStaging, skillStaging, detailStaging, currentRows, currentSkills, breedingSnapshot] = await Promise.all([
    readJson(INPUTS.creatures),
    readJson(INPUTS.skills),
    readJson(INPUTS.details),
    readJson(INPUTS.currentRows),
    readJson(INPUTS.currentSkills),
    readJson(INPUTS.breedingRows),
  ])
  const syncedAt = new Date().toISOString()
  const { creaturePreviewRows, skillPreviewRows, report } = buildPreview({
    creatures: creatureStaging.rows ?? [],
    skills: skillStaging.rows ?? [],
    details: detailStaging.rows ?? [],
    currentRows,
    currentSkills,
    breedingRows: breedingSnapshot.rows ?? [],
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
