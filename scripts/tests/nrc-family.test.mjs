import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPreview, resolveNrcFamily } from '../bwiki/build-preview.mjs'

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
  const currentRows = await json('../../public/presets/rockKingdomRows.json')
  const result = buildPreview({ creatures, details: (await json('../bwiki/data/nrc/staging/creature-details.json')).rows,
    skills: (await json('../bwiki/data/nrc/staging/skills.json')).rows,
    breedingRows: (await json('../bwiki/data/nrc/staging/breeding-rows.json')).rows,
    currentRows, currentSkills: await json('../../public/presets/rockKingdomSkillRows.json'), syncedAt: 'test' })
  const rows = result.creaturePreviewRows
  assert.equal(rows.length, creatures.length)
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
  assert(rows.every(row => row.values.speciesGroup))
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
