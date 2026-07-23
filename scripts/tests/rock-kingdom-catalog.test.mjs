import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateAllNatures, evaluateNatureProfiles } from '../../src/domain/nature.js'
import { buildFormAnalysis, buildNatureAnalysisInput, buildPopulationStatSummary } from '../../src/domain/natureRowAdapter.js'
import { buildOwnedNatureIndex } from '../../src/domain/owned.js'
import { ROCK_KINGDOM_PRESET } from '../../src/presets/rockKingdom.js'
import {
  compareRockKingdomCreatureRows,
  buildEvolutionReferenceGroups,
  isRockKingdomNatureSelectableRow,
  pairRockKingdomComparisonForms,
  primaryRockKingdomNatureRows,
  relatedRockKingdomBossRows,
  visibleRockKingdomCreatureRows,
} from '../../src/domain/rockKingdom.js'
import { mergeFieldOptions, normalizeField } from '../../src/utils.js'

function row(id, no, name, form) {
  return { id, values: { no, name, form } }
}

test('matches acquired status by creature and exact nature', () => {
  const index = buildOwnedNatureIndex([
    {
      referenceKeys: ['ref'],
      natureKey: 'nature',
      rows: [
        { values: { ref: 'creature-a', nature: 'clever' } },
        { values: { ref: 'creature-a', nature: 'clever' } },
        { values: { ref: 'creature-a', nature: 'timid' } },
        { values: { ref: 'creature-b', nature: 'clever' } },
        { values: { ref: 'creature-a', nature: '' } },
      ],
    },
  ])

  assert.deepEqual(index.get('creature-a'), { clever: 2, timid: 1 })
  assert.deepEqual(index.get('creature-b'), { clever: 1 })
  assert.equal(index.get('creature-a').brave, undefined)
})

test('counts a collected growth stage as acquired for its full evolution line', () => {
  const stage = { id: 'stage', values: { evolutionLine: '火花 → 焰火 → 火神' } }
  const final = { id: 'final', values: { evolutionLine: '火花 → 焰火 → 火神' } }
  const index = buildOwnedNatureIndex([{
    referenceKeys: ['ref'],
    natureKey: 'nature',
    rows: [{ values: { ref: stage.id, nature: 'adamant' } }],
  }], buildEvolutionReferenceGroups([stage, final]))
  assert.equal(index.get(final.id).adamant, 1)
})

test('hides a superseded official row only when its replacement exists', () => {
  const legacy = row('rock-creature-src-017', 'NO.012', '板板壳（本来的样子）', '本来的样子')
  const current = row('rock-creature-bwiki-bf820721eb70', 'NO.012', '板板壳', 'Ⅰ阶')

  assert.deepEqual(visibleRockKingdomCreatureRows([legacy]), [legacy])
  assert.deepEqual(visibleRockKingdomCreatureRows([legacy, current]), [current])
})

test('hides an old random-id duplicate without deleting distinct BWiki forms', () => {
  const current = row('rock-creature-src-001', 'NO.001', '迪莫', '最终形态')
  const randomLegacy = row('legacy-random-dimo', 'NO.001', '迪莫', '最终形态')
  const boss = row('rock-creature-bwiki-160c55fe2dfd', 'NO.001', '圣光迪莫', '首领形态')

  assert.deepEqual(visibleRockKingdomCreatureRows([randomLegacy, current, boss]), [current, boss])
})

test('updates only untouched legacy option icons', () => {
  const preset = [{ value: 'light', label: '光', color: '#facc15', image: 'https://bwiki.example/light.png' }]
  const defaults = {
    light: {
      labels: ['光', '光系'],
      color: '#facc15',
      images: ['', 'https://legacy.example/light.png'],
    },
  }

  assert.deepEqual(
    mergeFieldOptions(
      [{ value: 'light', label: '光', color: '#facc15', image: 'https://legacy.example/light.png' }],
      preset,
      defaults,
    ),
    preset,
  )
  const customized = [{ value: 'light', label: '光', color: '#facc15', image: 'https://user.example/light.png' }]
  assert.deepEqual(mergeFieldOptions(customized, preset, defaults), customized)
})

test('preserves generic field presentation and icon metadata', () => {
  const field = normalizeField({
    id: 'field-status',
    tableId: 'table-status',
    key: 'status',
    type: 'select',
    display: { mode: 'icon', tableWidth: 68 },
    options: [{ value: 'yes', label: '启用', symbol: '◆', variant: 'colorful' }],
  })

  assert.deepEqual(field.display, { mode: 'icon', tableWidth: 68 })
  assert.equal(field.options[0].symbol, '◆')
  assert.equal(field.options[0].variant, 'colorful')
})

test('exposes trait as a configurable summary and keeps breeding images beside it', () => {
  const creatureFields = ROCK_KINGDOM_PRESET.fields
    .filter((field) => field.tableId === ROCK_KINGDOM_PRESET.tables[0].id)
    .sort((a, b) => a.order - b.order)
  const traitIndex = creatureFields.findIndex((field) => field.key === 'traitName')
  assert.equal(creatureFields[traitIndex].type, 'summary')
  assert.equal(creatureFields[traitIndex].display.imageField, 'traitIcon')
  assert.deepEqual(creatureFields.slice(traitIndex + 1, traitIndex + 3).map((field) => field.key), ['fruitImage', 'eggImage'])
})

test('sorts creature forms by number, stage, final form, then boss form', () => {
  const rows = [
    row('boss', 'NO.007', '烈火战神', '首领形态'),
    row('final', 'NO.007', '火神', '最终形态'),
    row('stage-2', 'NO.007', '焰火', 'II阶'),
    row('variant', 'NO.007', '火神（异色）', '最终形态'),
    row('stage-1', 'NO.007', '火花', 'Ⅰ阶'),
    row('next', 'NO.008', '水蓝蓝', 'Ⅰ阶'),
  ]

  assert.deepEqual(rows.sort(compareRockKingdomCreatureRows).map((item) => item.id), [
    'stage-1', 'stage-2', 'final', 'variant', 'boss', 'next',
  ])
})

test('nature selector classifies growth stages, bosses, and final variants', () => {
  assert.equal(isRockKingdomNatureSelectableRow(row('stage', 'NO.007', '火花', 'I阶')), false)
  assert.equal(isRockKingdomNatureSelectableRow(row('boss', 'NO.007', '烈火战神', '首领形态')), false)
  assert.equal(isRockKingdomNatureSelectableRow(row('final', 'NO.007', '火神', '最终形态')), true)
  assert.equal(isRockKingdomNatureSelectableRow(row('stage-variant', 'NO.011', '鸭吉吉（蓬松的样子）', 'Ⅰ阶')), false)
  assert.equal(isRockKingdomNatureSelectableRow(row('final-variant', 'NO.020', '岚鸟（春天的样子）', '最终形态')), true)
})

test('nature selector exposes one ordinary entry per number while preserving variants for analysis', () => {
  const rows = [
    row('base', 'NO.020', '岚鸟', '最终形态'),
    row('spring', 'NO.020', '岚鸟（春天的样子）', '最终形态'),
    row('boss', 'NO.020', '霜翼领主', '首领形态'),
    row('other', 'NO.021', '另一只精灵（本来的样子）', '最终形态'),
  ]
  assert.deepEqual(primaryRockKingdomNatureRows(rows).map((item) => item.id), ['base', 'other'])
})

test('nature selector exposes the last ordinary stage when only boss forms follow', () => {
  const rows = [
    row('duck', 'NO.011', '鸭吉吉（蓬松的样子）', 'Ⅰ阶'),
    row('duck-boss', 'NO.011', '鸭吉吉国王（蓬松的样子）', '首领形态'),
  ]
  assert.deepEqual(primaryRockKingdomNatureRows(rows).map((item) => item.id), ['duck'])
})

test('nature selector exposes a growth-labeled row at the end of its evolution line', () => {
  const terminal = row('terminal', 'NO.099', '测试终点', 'Ⅱ阶')
  terminal.values.evolutionLine = '测试起点 → 测试终点'
  assert.deepEqual(primaryRockKingdomNatureRows([terminal]).map((item) => item.id), ['terminal'])
  assert.deepEqual(primaryRockKingdomNatureRows([row('incomplete', 'NO.100', '测试起点', 'Ⅰ阶')]), [])
})

test('population stat summary exposes one fixed global scale across all dimensions', () => {
  const fields = [
    normalizeField({ id: 'stats', key: 'stats', type: 'stats', statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' } }),
    ...['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => normalizeField({ id: key, key, type: 'number' })),
  ]
  const low = { id: 'low', values: { hp: 5, patk: 10, matk: 20, pdef: 30, mdef: 40, spd: 50 } }
  const high = { id: 'high', values: { hp: 100, patk: 120, matk: 140, pdef: 160, mdef: 180, spd: 290 } }
  const summary = buildPopulationStatSummary([low, high], fields, low)
  assert.equal(summary.globalMin, 5)
  assert.equal(summary.globalMax, 290)
})

test('matches a final variant with its corresponding boss variant', () => {
  const target = row('spring', 'NO.020', '岚鸟（春天的样子）', '春天的样子')
  const springBoss = row('spring-boss', 'NO.020', '霜翼领主（春天的样子）', '首领形态')
  const summerBoss = row('summer-boss', 'NO.020', '霜翼领主（夏天的样子）', '首领形态')
  assert.deepEqual(relatedRockKingdomBossRows(target, [target, summerBoss, springBoss]), [springBoss])
})

test('pairs ordinary and boss comparison cards by their shared variant label', () => {
  const groups = pairRockKingdomComparisonForms([
    { id: 'soft', name: '鸭吉吉（蓬松的样子）', form: '最终形态' },
    { id: 'firm', name: '鸭吉吉（紧实的样子）', form: '最终形态' },
    { id: 'soft-boss', name: '鸭吉吉国王（蓬松的样子）', form: '首领形态' },
    { id: 'firm-boss', name: '鸭吉吉国王（紧实的样子）', form: '首领形态' },
  ])
  assert.deepEqual(groups.map((group) => ({
    variant: group.variant,
    paired: group.paired,
    ids: group.forms.map((form) => form.id),
  })), [
    { variant: '蓬松的样子', paired: true, ids: ['soft', 'soft-boss'] },
    { variant: '紧实的样子', paired: true, ids: ['firm', 'firm-boss'] },
  ])
})

test('pairs an unlabelled ordinary form with its corresponding unlabelled boss form', () => {
  const groups = pairRockKingdomComparisonForms([
    { id: 'ordinary', name: '岚鸟', form: '最终形态' },
    { id: 'boss', name: '霜翼领主', form: '首领形态' },
  ])
  assert.deepEqual(groups.map((group) => ({
    variant: group.variant,
    paired: group.paired,
    ids: group.forms.map((form) => form.id),
  })), [
    { variant: '', paired: true, ids: ['ordinary', 'boss'] },
  ])
})

test('combined nature evaluation uses the union of independently evaluated forms', () => {
  const stats = { hp: 100, patk: 120, matk: 50, pdef: 80, mdef: 80, spd: 100 }
  const bossStats = { hp: 110, patk: 50, matk: 150, pdef: 90, mdef: 85, spd: 120 }
  const results = evaluateNatureProfiles(stats, ['patkLean'], { skills: [] }, [
    { id: 'boss', label: '魔攻首领', stats: bossStats, traitTags: ['matkLean', 'spdLean'], skillInfo: { skills: [] } },
  ])
  assert.equal(results.length, 30)
  assert.ok(results.every((item) => item.analysisFormCount === 2))
  assert.ok(results[0].reasons.some((reason) => reason.includes('结果的并集')))
  const physicalNature = results.find((item) => item.raise === 'patk' && item.lower === 'matk')
  const magicalNature = results.find((item) => item.raise === 'matk' && item.lower === 'patk')
  assert.notEqual(physicalNature.decision, 'notRecommended')
  assert.notEqual(magicalNature.decision, 'notRecommended')
  assert.deepEqual(
    physicalNature.formDecisions.filter((item) => item.decision !== 'notRecommended').map((item) => item.id),
    ['primary'],
  )
  assert.deepEqual(
    magicalNature.formDecisions.filter((item) => item.decision !== 'notRecommended').map((item) => item.id),
    ['boss'],
  )
})

test('nature analysis keeps each form trait and skill evidence independent', () => {
  const fields = [
    normalizeField({ id: 'stats', key: 'stats', type: 'stats', statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' } }),
    normalizeField({ id: 'name', key: 'name', type: 'text' }),
    normalizeField({ id: 'form', key: 'form', type: 'text' }),
    normalizeField({ id: 'tags', key: 'traitTags', type: 'multiselect' }),
    normalizeField({ id: 'skills', key: 'skillRefs', type: 'references' }),
    ...['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => normalizeField({ id: key, key, type: 'number' })),
  ]
  const target = {
    id: 'ordinary',
    values: { name: '普通形态', hp: 100, patk: 120, matk: 50, pdef: 80, mdef: 80, spd: 100, traitTags: ['patkLean'], skillRefs: ['physical'] },
  }
  const boss = {
    id: 'boss',
    values: { name: '首领形态', hp: 100, patk: 50, matk: 120, pdef: 80, mdef: 80, spd: 100, traitTags: ['matkLean'], skillRefs: ['magical'] },
  }
  const skillRows = [
    { id: 'physical', values: { name: '物理技能', category: '物理', power: 80 } },
    { id: 'magical', values: { name: '魔法技能', category: '魔法', power: 80 } },
  ]
  const input = buildNatureAnalysisInput(target, [boss], fields, skillRows, [target, boss])
  assert.deepEqual(input.traitTags, ['patkLean'])
  assert.deepEqual(input.skillInfo.skills.map((skill) => skill.name), ['物理技能'])
  assert.deepEqual(input.analysisProfiles[0].traitTags, ['matkLean'])
  assert.deepEqual(input.analysisProfiles[0].skillInfo.skills.map((skill) => skill.name), ['魔法技能'])
})

test('balanced functional mixed attackers keep a supported short-defense branch despite minor skill drift', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const decisions = Object.fromEntries(rows
    .filter((item) => item.values?.no === 'NO.004')
    .map((form) => {
      const input = buildNatureAnalysisInput(form, [], fields, skillRows, rows)
      const steady = evaluateAllNatures(input.stats, input.traitTags, input.skillInfo)
        .find((candidate) => candidate.name === '稳重')
      return [form.values.name, steady.decision]
    }))
  assert.equal(decisions['魔力猫'], 'keepable')
  assert.equal(decisions['叶冕魔力猫'], 'keepable')
  assert.equal(decisions['武斗酷猫'], 'notRecommended')
})

test('balanced mixed attackers keep both routes when skill counts remain close', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const decisionFor = (no, nature) => {
    const forms = rows.filter((item) => item.values?.no === no)
    const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
    return evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
      .find((candidate) => candidate.name === nature)?.decision
  }
  assert.equal(decisionFor('NO.023', '开朗'), 'keepable')
  assert.equal(decisionFor('NO.023', '胆小'), 'keepable')
  assert.equal(decisionFor('NO.038', '开朗'), 'keepable')
  assert.equal(decisionFor('NO.038', '胆小'), 'keepable')
  assert.equal(decisionFor('NO.038', '天真'), 'keepable')
})

test('close dual attacks keep both sacrifice directions despite a skill-count gap', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.051')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  for (const name of ['固执', '平和', '开朗', '天真', '害羞']) {
    assert.notEqual(candidates.find((candidate) => candidate.name === name)?.decision, 'notRecommended')
  }
})

test('balanced mixed routes do not rescue low-value speed natures', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.040')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  assert.equal(candidates.find((candidate) => candidate.name === '开朗')?.decision, 'notRecommended')
  assert.equal(candidates.find((candidate) => candidate.name === '胆小')?.decision, 'notRecommended')
})

test('functional forms do not sacrifice their standout defense', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.040')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  for (const name of ['忧郁', '大胆', '专注', '温顺']) {
    assert.equal(candidates.find((candidate) => candidate.name === name)?.decision, 'notRecommended')
  }
})

test('functional forms protect a clearly stronger defense just below the upper quartile', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.059')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  for (const name of ['莽撞', '粗心', '调皮', '懒散', '偏执']) {
    assert.equal(candidates.find((candidate) => candidate.name === name)?.decision, 'notRecommended')
  }
})

test('a weaker attack sacrifice does not bypass same-raise dominance as a defense specialty', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.026')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  assert.equal(candidates.find((candidate) => candidate.name === '天真')?.decision, 'keepable')
  assert.equal(candidates.find((candidate) => candidate.name === '稳重')?.decision, 'notRecommended')
})

test('multi-form union does not add boss-only life branches that sacrifice a defense', () => {
  const rows = visibleRockKingdomCreatureRows(
    JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8')),
  )
  const skillRows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomSkillRows.json', import.meta.url), 'utf8'))
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const fields = ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === creatureTableId)
  const forms = rows.filter((item) => item.values?.no === 'NO.011')
  const input = buildNatureAnalysisInput(forms[0], forms, fields, skillRows, rows)
  const candidates = evaluateNatureProfiles(input.stats, input.traitTags, input.skillInfo, input.analysisProfiles)
  assert.equal(candidates.find((candidate) => candidate.name === '忧郁')?.decision, 'notRecommended')
  assert.equal(candidates.find((candidate) => candidate.name === '粗心')?.decision, 'notRecommended')
})

test('official preset classifies 烈火战神 as a boss form', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const boss = rows.find((item) => item.values?.name === '烈火战神')
  assert.equal(boss?.values?.form, '首领形态')
})

test('official preset exposes Dimo as the only final-form selector entry for NO.001', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const numberOne = rows.filter((item) => item.values?.no === 'NO.001')
  assert.deepEqual(primaryRockKingdomNatureRows(numberOne).map((item) => item.id), ['rock-creature-src-001'])
  assert.equal(numberOne.find((item) => item.id === 'rock-creature-src-001')?.values?.form, '最终形态')
})

test('official preset exposes the first ordinary Duck variant before its boss forms', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const numberEleven = rows.filter((item) => item.values?.no === 'NO.011')
  assert.deepEqual(primaryRockKingdomNatureRows(numberEleven).map((item) => item.id), ['rock-creature-src-011'])
  assert.ok(numberEleven.filter((item) => item.values?.form !== '首领形态')
    .every((item) => item.values?.form === '最终形态'))
})

test('official preset treats an ordinary row followed only by its boss as final form', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const dingding = rows.find((item) => item.values?.name === '叮叮恶魔')
  assert.equal(dingding?.values?.form, '最终形态')
})

test('form analysis explains differences and detects equivalent related forms', () => {
  const fields = [
    normalizeField({ id: 'stats', key: 'stats', type: 'stats', statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' } }),
    normalizeField({ id: 'name', key: 'name', type: 'text' }),
    normalizeField({ id: 'no', key: 'no', type: 'text' }),
    normalizeField({ id: 'form', key: 'form', type: 'text' }),
    normalizeField({ id: 'tags', key: 'traitTags', type: 'multiselect' }),
    normalizeField({ id: 'skills', key: 'skillRefs', type: 'references' }),
    ...['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => normalizeField({ id: key, key, type: 'number' })),
  ]
  const target = { id: 'final', values: { name: '测试精灵', hp: 100, patk: 100, matk: 80, pdef: 90, mdef: 90, spd: 100, traitName: '特性甲', traitTags: ['attack'], skillRefs: ['a'] } }
  const bossA = { id: 'boss-a', values: { ...target.values, name: '首领甲', patk: 120, traitName: '特性乙', skillRefs: ['a', 'b'] } }
  const bossB = { id: 'boss-b', values: { ...bossA.values, name: '首领乙' } }
  const analysis = buildFormAnalysis(target, [bossA, bossB], fields)
  assert.equal(analysis.allFormsEquivalent, true)
  assert.deepEqual(analysis.forms[0].statChanges.map((item) => [item.key, item.delta]), [['patk', 20]])
  assert.equal(analysis.forms[0].traitChanged, true)
  assert.equal(analysis.forms[0].addedSkillCount, 1)
  assert.deepEqual(analysis.forms[0].uniqueSkillNames, [])
})

test('form analysis highlights skills owned by only one form', () => {
  const fields = [
    normalizeField({ id: 'stats', key: 'stats', type: 'stats', statsMap: { hp: 'hp', patk: 'patk', matk: 'matk', pdef: 'pdef', mdef: 'mdef', spd: 'spd' } }),
    normalizeField({ id: 'name', key: 'name', type: 'text' }),
    normalizeField({ id: 'skills', key: 'skillRefs', type: 'references' }),
    ...['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => normalizeField({ id: key, key, type: 'number' })),
  ]
  const baseValues = { hp: 100, patk: 100, matk: 80, pdef: 90, mdef: 90, spd: 100 }
  const target = { id: 'base', values: { ...baseValues, name: '普通形态', skillRefs: ['shared', 'base-only'] } }
  const boss = { id: 'boss', values: { ...baseValues, name: '首领形态', skillRefs: ['shared', 'boss-only'] } }
  const skills = [
    { id: 'shared', values: { name: '共有技能' } },
    { id: 'base-only', values: { name: '普通独有' } },
    { id: 'boss-only', values: { name: '首领独有' } },
  ]
  const analysis = buildFormAnalysis(target, [target, boss], fields, skills)
  assert.deepEqual(analysis.forms[0].uniqueSkillNames, ['普通独有'])
  assert.deepEqual(analysis.forms[1].uniqueSkillNames, ['首领独有'])
})

test('official preset includes collected egg and seed images', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  assert.equal(rows.filter((item) => item.values?.eggImage).length, 121)
  assert.equal(rows.filter((item) => item.values?.fruitImage).length, 118)
})

test('official preset uses only canonical growth forms for named variants', () => {
  const rows = JSON.parse(readFileSync(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8'))
  const forms = new Set(rows.map((item) => item.values?.form))
  assert.deepEqual([...forms].sort(), ['Ⅰ阶', 'Ⅱ阶', '最终形态', '首领形态'].sort())
  assert.equal(rows.find((item) => item.values?.name === '冬羽雀（春天的样子）')?.values?.form, 'Ⅱ阶')
  assert.equal(rows.find((item) => item.values?.name === '岚鸟（春天的样子）')?.values?.form, '最终形态')
})
