import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { hashPresetValue, mergeVersionedPresetValues } from '../../src/domain/presetMigration.js'

async function patch(key, oldValue) {
  return { key, acceptedHashes: [await hashPresetValue(oldValue)] }
}

test('uses the same SHA-256 representation as the versioned preset generator', async () => {
  const value = ['rock-skill-old', { nested: true }]
  const expected = createHash('sha256').update(JSON.stringify(value)).digest('hex')
  assert.equal(await hashPresetValue(value), expected)
})

test('updates unchanged official scalar and reference values', async () => {
  const existingValues = {
    name: '旧官方名称',
    skillRefs: ['skill-old'],
    note: '用户附加字段',
  }
  const result = await mergeVersionedPresetValues({
    existingValues,
    presetValues: {
      name: '新官方名称',
      skillRefs: ['skill-new'],
    },
    fieldPatches: [
      await patch('name', '旧官方名称'),
      await patch('skillRefs', ['skill-old']),
    ],
  })

  assert.deepEqual(result, {
    name: '新官方名称',
    skillRefs: ['skill-new'],
    note: '用户附加字段',
  })
})

test('preserves customized non-empty scalar and reference values', async () => {
  const existingValues = {
    effect: '我的技能说明',
    learnerRefs: ['my-creature'],
  }
  const result = await mergeVersionedPresetValues({
    existingValues,
    presetValues: {
      effect: '新版官方技能说明',
      learnerRefs: ['official-creature'],
    },
    fieldPatches: [
      await patch('effect', '旧版官方技能说明'),
      await patch('learnerRefs', ['old-official-creature']),
    ],
  })

  assert.strictEqual(result, existingValues)
  assert.deepEqual(result, existingValues)
})

test('fills empty values and repairs explicitly invalid values', async () => {
  const result = await mergeVersionedPresetValues({
    existingValues: { image: '', element: ['unknown'], traitDesc: '用户描述' },
    presetValues: { image: 'https://example.test/image.png', element: ['light'], traitDesc: '官方描述' },
    isInvalidValue: (key) => key === 'element',
  })

  assert.deepEqual(result, {
    image: 'https://example.test/image.png',
    element: ['light'],
    traitDesc: '用户描述',
  })
})

test('clears a removed official value only when the current value is still official', async () => {
  const fieldPatch = await patch('priority', '先手+1')
  const officialResult = await mergeVersionedPresetValues({
    existingValues: { priority: '先手+1' },
    presetValues: { priority: '' },
    fieldPatches: [fieldPatch],
  })
  const customResult = await mergeVersionedPresetValues({
    existingValues: { priority: '我的先制说明' },
    presetValues: { priority: '' },
    fieldPatches: [fieldPatch],
  })

  assert.equal(officialResult.priority, '')
  assert.equal(customResult.priority, '我的先制说明')
})

test('returns the original object when no field needs migration', async () => {
  const existingValues = { name: '相同', effect: '用户值' }
  const result = await mergeVersionedPresetValues({
    existingValues,
    presetValues: { name: '相同', effect: '新版官方值' },
    fieldPatches: [await patch('effect', '旧版官方值')],
  })

  assert.strictEqual(result, existingValues)
})

test('migrates a real reused creature while preserving a customized field', async () => {
  const [currentRows, preview, manifest] = await Promise.all([
    readFile(new URL('../../public/presets/rockKingdomRows.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../bwiki/data/preview/creature-rows.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../public/presets/rockKingdomPresetMigration.json', import.meta.url), 'utf8').then(JSON.parse),
  ])
  const id = 'rock-creature-src-001'
  const current = currentRows.find((row) => row.id === id)
  const target = preview.rows.find((row) => row.id === id)
  const fields = manifest.creatures.rows.find((row) => row.id === id).fields
  const existingValues = { ...current.values, image: 'https://user.example/custom.png' }
  const result = await mergeVersionedPresetValues({
    existingValues,
    presetValues: target.values,
    fieldPatches: fields,
  })

  assert.equal(result.image, 'https://user.example/custom.png')
  assert.deepEqual(result.skillRefs, target.values.skillRefs)
  assert.equal(result.evolutionLine, target.values.evolutionLine)
})

test('migrates every reused official row to all material target values', async () => {
  const manifest = await readFile(
    new URL('../../public/presets/rockKingdomPresetMigration.json', import.meta.url),
    'utf8',
  ).then(JSON.parse)
  const cases = [
    ['creatures', '../../public/presets/rockKingdomRows.json', '../bwiki/data/preview/creature-rows.json'],
    ['skills', '../../public/presets/rockKingdomSkillRows.json', '../bwiki/data/preview/skill-rows.json'],
  ]

  for (const [section, currentPath, previewPath] of cases) {
    const [currentRows, preview] = await Promise.all([
      readFile(new URL(currentPath, import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL(previewPath, import.meta.url), 'utf8').then(JSON.parse),
    ])
    const currentById = new Map(currentRows.map((row) => [row.id, row]))
    const patchById = new Map(manifest[section].rows.map((row) => [row.id, row.fields]))
    for (const target of preview.rows) {
      const current = currentById.get(target.id)
      if (!current) continue
      const result = await mergeVersionedPresetValues({
        existingValues: current.values,
        presetValues: target.values,
        fieldPatches: patchById.get(target.id),
      })
      for (const [key, targetValue] of Object.entries(target.values)) {
        const absentEmptyTarget = !Object.hasOwn(current.values, key) &&
          (targetValue == null || targetValue === '' || (Array.isArray(targetValue) && targetValue.length === 0))
        if (!absentEmptyTarget) assert.deepEqual(result[key], targetValue, `${section} ${target.id} ${key}`)
      }
    }
  }
})
