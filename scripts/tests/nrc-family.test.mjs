import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPreview, resolveNrcFamily, confirmedNrcPreviousName } from '../bwiki/build-preview.mjs'

test('NRC family uses an exact initial form and preserves established cross-form families', () => {
  const creature = { name: '成体（下弦）', sourceId: 'pet_2' }
  const root = { name: '幼体（下弦）' }
  const detail = { ...creature, evolutionBranches: [[root, creature]] }
  const rows = [root, creature]
  assert.equal(resolveNrcFamily(creature, detail, rows, []).value, root.name)
  const baseline = [{ values: { name: root.name, speciesGroup: '幼体（上弦）' } }]
  assert.equal(resolveNrcFamily(creature, detail, rows, baseline).value, '幼体（上弦）')
  assert.equal(resolveNrcFamily(creature, { ...detail, sourceId: 'other' }, rows, []).value, '')
  assert.equal(resolveNrcFamily(creature, detail, [creature, { name: '幼体' }], []).value, '')
  const branching = { ...detail, evolutionBranches: [...detail.evolutionBranches, [{ name: '其他幼体' }, creature]] }
  assert.equal(resolveNrcFamily(creature, branching, [...rows, { name: '其他幼体' }], []).value, '')
  assert.equal(resolveNrcFamily(creature, { ...detail, evolutionBranches: [[{ name: '其他成体' }]] }, rows, []).value, '')
})

test('Full NRC preview fills all new families without changing existing family keys or merging forms', async () => {
  const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  const creatures = (await json('../bwiki/data/nrc/staging/creatures.json')).rows
  const previousNames = { 'rock-creature-src-240': '香草甜甜', 'rock-creature-src-241': '圣代甜甜', 'rock-creature-src-482': '加油蟹' }
  const currentRows = (await json('../../public/presets/rockKingdomRows.json')).map(row => previousNames[row.id]
    ? { ...row, values: { ...row.values, name: previousNames[row.id] } } : row)
  const result = buildPreview({ creatures, details: (await json('../bwiki/data/nrc/staging/creature-details.json')).rows,
    skills: (await json('../bwiki/data/nrc/staging/skills.json')).rows,
    breedingRows: (await json('../bwiki/data/nrc/staging/breeding-rows.json')).rows,
    currentRows, currentSkills: await json('../../public/presets/rockKingdomSkillRows.json'), syncedAt: 'test', sourceVersion: 'S4-2026-09-11-browser-full' })
  const rows = result.creaturePreviewRows
  assert.equal(rows.length, creatures.length)
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
  assert(currentRows.every(old => rows.some(row => row.id === old.id)), 'Every formal creature ID survives the rename mapping')
  for (const [id, name] of [['rock-creature-src-240', '香草甜甜（樱桃饰品）'], ['rock-creature-src-241', '圣代甜甜（樱桃巧克力口味）'], ['rock-creature-src-482', '加油蟹（两只海葵的样子）']]) {
    const row = rows.find(row => row.id === id)
    assert.equal(row.values.name, name)
    assert.equal(row.previewMeta.idStrategy, 'user-confirmed-name')
  }
  for (const row of rows) for (const id of row.values.skillRefs) {
    assert(result.skillPreviewRows.find(skill => skill.id === id).values.learnerRefs.includes(row.id))
  }
  assert(rows.every(row => row.values.speciesGroup))
  assert.equal(rows.find(row => row.values.name === '火红尾').values.shiny, 'yes')
  assert.equal(rows.filter(row => row.values.shiny === 'no' && row.values.shinyImage).length, 0)
  for (const row of rows) {
    const old = currentRows.find(old => old.id === row.id)
    if (old?.values.speciesGroup) assert.equal(row.values.speciesGroup, old.values.speciesGroup)
  }
  const group = name => rows.find(row => row.values.name === name).values.speciesGroup
  assert.equal(group('烈焰狂战士'), '火尾瓦特')
  assert.equal(group('圣代甜甜（樱桃巧克力口味）'), '脆筒甜甜')
  assert.equal(group('宝藏沙狐'), '宝藏小狐')
  assert.equal(group('满月砣（下弦的样子）'), group('刺轮砣（下弦的样子）'))
})

test('Confirmed renames never generalize to other forms, batches or sources', () => {
  const row = { source: 'bwiki-nrc', sourceId: 'pet_000487', name: '加油蟹（两只海葵的样子）', no: 'NO.361' }
  const version = 'S4-2026-09-11-browser-full'
  assert.equal(confirmedNrcPreviousName(row, version).previousId, 'rock-creature-src-482')
  for (const patch of [{ name: '加油蟹（单只海葵的样子）' }, { sourceId: 'pet_other' }, { no: 'NO.362' }, { source: 'other' }]) {
    assert.equal(confirmedNrcPreviousName({ ...row, ...patch }, version), null)
  }
  assert.equal(confirmedNrcPreviousName(row, 'future-batch'), null)
})
