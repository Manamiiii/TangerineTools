// 洛克王国预置骨架、版本化正式数据迁移与演示数据初始化。

import { db } from './core.js'
import { ensureOwnedTable } from './repository.js'
import {
  ELEMENT_LEGACY_DEFAULTS,
  ROCK_KINGDOM_PRESET,
  ROCK_KINGDOM_ROWS_VERSION,
  SKILL_CATEGORY_LEGACY_DEFAULTS,
  TRAIT_TAG_LEGACY_DEFAULTS,
} from '../presets/rockKingdom.js'
import { BREEDING_DEMO_OWNED } from '../domain/breedingData.js'
import { mergeVersionedPresetValues } from '../domain/presetMigration.js'
import { mergeFieldOptions, nowIso } from '../utils.js'

const presetUrl = (fileName) => `${import.meta.env?.BASE_URL ?? '/'}presets/${fileName}`

// ---------------------------------------------------------------------------
// 初始化 / 预置资料
// ---------------------------------------------------------------------------

export async function ensureSeeded() {
  const seeded = await db.meta.get('seededRockKingdom')
  if (!seeded?.value) {
    await seedRockKingdomStructure()
    await db.meta.put({ key: 'seededRockKingdom', value: true })
  }
  const migrationKey = 'rockKingdomRuntimeMigrationVersion'
  const migrated = await db.meta.get(migrationKey)
  if (migrated?.value === ROCK_KINGDOM_ROWS_VERSION) {
    await migrateRockKingdomStructure()
    await migrateRockKingdomFieldLayout()
    return
  }
  // 版本变化或导入后才执行完整迁移，避免每次启动重复扫描全部精灵与技能行。
  // 各迁移仍保持幂等，并尊重用户删除的表以及非空自定义字段。
  await migrateRockKingdomStructure()
  await migrateRockKingdomSkillReferenceFields()
  await migrateRockKingdomSkillTableFields()
  await migrateRockKingdomFieldOptions()
  await migrateRockKingdomFieldLayout()
  const presetMigration = await loadRockKingdomPresetMigration()
  const creatureRowsReady = await migrateRockKingdomRows(presetMigration)
  await migrateRockKingdomBreedingFieldLabels()
  const skillRowsReady = await migrateRockKingdomSkillRows(presetMigration)
  await migrateRockKingdomSceneTools()
  await seedRockKingdomBreedingDemoOwnedRows()
  // 静态预置离线时保留未完成状态，下次启动继续尝试，不把空骨架误标成已迁移。
  if (creatureRowsReady && skillRowsReady) {
    await db.meta.put({ key: migrationKey, value: ROCK_KINGDOM_ROWS_VERSION })
  }
}

// 洛克王国场景经历了几轮默认工具变更：
// - 第一轮：只启用资料库 -> ['catalog']
// - 第二轮：加入统计视图与性格推荐 -> ['catalog', 'stock', 'nature']
// - 第三轮：再加入收集记录 -> ['catalog', 'owned', 'stock', 'nature']
// - 当前：加入孵蛋推荐 -> ['catalog', 'owned', 'stock', 'nature', 'breeding']
// 迁移策略：只在场景 tools 恰好等于某一版旧默认值时，自动补齐到当前默认值。
// 只要用户手动改过 tools（哪怕只是关掉了资料库或加入了不同工具的组合），
// 一律不覆盖，尊重用户的选择。场景已被用户删除时跳过。
const LEGACY_DEFAULT_SCENE_TOOLS_LIST = [
  ['catalog'],
  ['catalog', 'stock', 'nature'],
  ['catalog', 'owned', 'stock', 'nature'],
]

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

async function migrateRockKingdomSceneTools() {
  const scene = await db.scenes.get(ROCK_KINGDOM_PRESET.scene.id)
  if (!scene) return
  const isLegacyDefault = LEGACY_DEFAULT_SCENE_TOOLS_LIST.some((legacy) =>
    arraysEqual(scene.tools, legacy),
  )
  if (!isLegacyDefault) return
  await db.scenes.update(scene.id, {
    tools: [...ROCK_KINGDOM_PRESET.scene.tools],
    updatedAt: nowIso(),
  })
}

async function seedRockKingdomStructure() {
  const { scene, tables, fields } = ROCK_KINGDOM_PRESET
  await db.transaction('rw', db.scenes, db.catalogTables, db.catalogFields, async () => {
    await db.scenes.put(scene)
    for (const table of tables) await db.catalogTables.put(table)
    for (const field of fields) await db.catalogFields.put(field)
  })
}

async function migrateRockKingdomStructure() {
  const scene = await db.scenes.get(ROCK_KINGDOM_PRESET.scene.id)
  if (!scene) return
  const now = nowIso()
  const existingTables = await db.catalogTables
    .where('sceneId')
    .equals(ROCK_KINGDOM_PRESET.scene.id)
    .toArray()
  const existingTableIds = new Set(existingTables.map((table) => table.id))
  let nextTableOrder = existingTables.length
    ? Math.max(...existingTables.map((table) => table.order ?? 0)) + 1
    : 0

  await db.transaction('rw', db.catalogTables, db.catalogFields, async () => {
    for (const presetTable of ROCK_KINGDOM_PRESET.tables) {
      if (existingTableIds.has(presetTable.id)) continue
      await db.catalogTables.put({
        ...presetTable,
        order: nextTableOrder,
        createdAt: now,
        updatedAt: now,
      })
      existingTableIds.add(presetTable.id)
      nextTableOrder += 1
    }

    for (const tableId of existingTableIds) {
      const existingFields = await db.catalogFields.where('tableId').equals(tableId).toArray()
      const existingFieldIds = new Set(existingFields.map((field) => field.id))
      const existingKeys = new Set(existingFields.map((field) => field.key))
      let nextFieldOrder = existingFields.length
        ? Math.max(...existingFields.map((field) => field.order ?? 0)) + 1
        : 0
      for (const presetField of ROCK_KINGDOM_PRESET.fields.filter((field) => field.tableId === tableId)) {
        if (existingFieldIds.has(presetField.id) || existingKeys.has(presetField.key)) continue
        await db.catalogFields.put({
          ...presetField,
          order: nextFieldOrder,
          createdAt: now,
          updatedAt: now,
        })
        nextFieldOrder += 1
      }
    }
  })
}

async function migrateRockKingdomSkillReferenceFields() {
  const tableId = ROCK_KINGDOM_PRESET.tables[0].id
  const table = await db.catalogTables.get(tableId)
  if (!table) return
  const deprecatedKeys = new Set(['skills', 'coreSkill'])
  const fields = await db.catalogFields.where('tableId').equals(tableId).toArray()
  const deprecatedFieldIds = fields
    .filter((field) => deprecatedKeys.has(field.key))
    .map((field) => field.id)
  if (deprecatedFieldIds.length === 0) return
  await db.transaction('rw', db.catalogFields, async () => {
    await db.catalogFields.bulkDelete(deprecatedFieldIds)
  })
}

async function migrateRockKingdomSkillTableFields() {
  const table = ROCK_KINGDOM_PRESET.tables.find((item) => item.id === 'table-rock-kingdom-skills')
  if (!table) return
  const existingTable = await db.catalogTables.get(table.id)
  if (!existingTable) return
  const deprecatedKeys = new Set(['categoryIcon', 'learnMethod', 'learnLevel', 'learners'])
  const fields = await db.catalogFields.where('tableId').equals(table.id).toArray()
  const deprecatedFieldIds = fields
    .filter((field) => deprecatedKeys.has(field.key))
    .map((field) => field.id)
  if (deprecatedFieldIds.length === 0) return
  await db.transaction('rw', db.catalogFields, async () => {
    await db.catalogFields.bulkDelete(deprecatedFieldIds)
  })
}

// 为已存在的洛克王国字段（如特性标签）补齐预置里新增的选项，并且只在用户
// 尚未自定义过旧选项时才更新其展示名/颜色。字段本身已被用户删除时跳过，
// 不做任何恢复。
async function migrateRockKingdomFieldOptions() {
  for (const presetField of ROCK_KINGDOM_PRESET.fields) {
    if (!Array.isArray(presetField.options) || presetField.options.length === 0) continue
    const existingField = await db.catalogFields.get(presetField.id)
    if (!existingField) continue
    const legacyDefaults =
      presetField.key === 'traitTags'
        ? TRAIT_TAG_LEGACY_DEFAULTS
        : presetField.key === 'element'
          ? ELEMENT_LEGACY_DEFAULTS
          : presetField.tableId === 'table-rock-kingdom-skills' && presetField.key === 'category'
            ? SKILL_CATEGORY_LEGACY_DEFAULTS
            : {}
    const mergedOptions = mergeFieldOptions(existingField.options, presetField.options, legacyDefaults)
    if (JSON.stringify(mergedOptions) !== JSON.stringify(existingField.options)) {
      await db.catalogFields.update(presetField.id, { options: mergedOptions, updatedAt: nowIso() })
    }
  }
}

async function migrateRockKingdomFieldLayout() {
  const migrationKey = 'rockKingdomFieldLayoutVersion'
  const targetVersion = 'catalog-layout-2026-07-22-v5'
  const migrated = await db.meta.get(migrationKey)
  if (migrated?.value === targetVersion) return
  const presetById = new Map(ROCK_KINGDOM_PRESET.fields.map((field) => [field.id, field]))
  const existingFields = await db.catalogFields.bulkGet([...presetById.keys()])
  const now = nowIso()
  const updates = existingFields.filter(Boolean).flatMap((field) => {
    const preset = presetById.get(field.id)
    if (!preset) return []
    const patch = {}
    if (field.order !== preset.order) patch.order = preset.order
    if (field.key === 'traitName' && field.type === 'text' && field.display?.kind === 'summary') patch.type = 'summary'
    if (JSON.stringify(field.display || {}) !== JSON.stringify(preset.display || {})) patch.display = preset.display || {}
    if (field.tableId === ROCK_KINGDOM_PRESET.tables[0].id && ['shiny', 'speciesGroup', 'traitIcon', 'traitDesc'].includes(field.key) && !field.hidden) patch.hidden = true
    return Object.keys(patch).length > 0 ? [{ id: field.id, patch: { ...patch, updatedAt: now } }] : []
  })
  await db.transaction('rw', db.catalogFields, db.meta, async () => {
    await Promise.all(updates.map(({ id, patch }) => db.catalogFields.update(id, patch)))
    await db.meta.put({ key: migrationKey, value: targetVersion })
  })
}

function isLegacyRockKingdomPlaceholderRow(row) {
  return (
    row.tableId === ROCK_KINGDOM_PRESET.tables[0].id &&
    (row.id?.startsWith('row-rock-') || row.values?.image?.startsWith('data:image/svg+xml'))
  )
}

function isInvalidElementValue(value) {
  const elementField = ROCK_KINGDOM_PRESET.fields.find((field) => field.key === 'element')
  const validValues = new Set((elementField?.options || []).map((option) => option.value))
  const values = Array.isArray(value) ? value : value ? [value] : []
  return values.some((item) => !validValues.has(item))
}

async function loadRockKingdomPresetMigration() {
  try {
    const res = await fetch(presetUrl('rockKingdomPresetMigration.json'))
    if (!res.ok) return null
    const payload = await res.json()
    if (payload?.source !== 'bwiki-preset-migration') return null
    return payload
  } catch {
    return null
  }
}

// 补齐预置行数据：新安装会插入 public/presets/rockKingdomRows.json 中的官方
// 图鉴行；升级用户如果本地仍有旧版 row-rock-* / SVG 占位行，会在插入官方
// 行前删除这些明确可识别的占位行，避免出现“496 占位 + 496 官方”的重复。
// 对已有稳定 id 行做三方合并：空值 / 无效系别直接补齐；非空字段只有在其
// SHA-256 与版本化迁移清单中的旧官方值匹配时才更新。用户自定义值保持不变。
// 用户自行新增或无法安全判断为占位的普通资料行不会被删除；owned / stock
// 工具表不在默认资料表 tableId 下，也不会被触碰。资料表已被用户删除时跳过。
async function migrateRockKingdomRows(presetMigration) {
  const tableId = ROCK_KINGDOM_PRESET.tables[0].id
  const table = await db.catalogTables.get(tableId)
  if (!table) return true
  try {
    const res = await fetch(presetUrl('rockKingdomRows.json'))
    if (!res.ok) return false
    const presetRows = await res.json()
    const isVersionedPreset = presetRows.some((row) =>
      row.id?.startsWith('rock-creature-src-') || row.id?.startsWith('rock-creature-bwiki-'),
    )
    const now = nowIso()
    const existingRows = await db.catalogRows.where('tableId').equals(tableId).toArray()
    const legacyPlaceholderIds = isVersionedPreset
      ? existingRows.filter(isLegacyRockKingdomPlaceholderRow).map((row) => row.id)
      : []
    const existingById = new Map(existingRows
      .filter((row) => !legacyPlaceholderIds.includes(row.id))
      .map((row) => [row.id, row]))
    const patchesById = new Map((presetMigration?.creatures?.rows ?? []).map((row) => [row.id, row.fields ?? []]))
    const rowsToPut = []
    for (const row of presetRows.filter((item) => item.id)) {
      const existing = existingById.get(row.id)
      if (!existing) {
        rowsToPut.push({
          id: row.id,
          tableId,
          values: row.values || {},
          createdAt: row.createdAt || now,
          updatedAt: row.updatedAt || now,
        })
        continue
      }
      if (!isVersionedPreset || (!row.id.startsWith('rock-creature-src-') && !row.id.startsWith('rock-creature-bwiki-'))) continue
      const nextValues = await mergeVersionedPresetValues({
        existingValues: existing.values,
        presetValues: row.values || {},
        fieldPatches: patchesById.get(row.id),
        isInvalidValue: (key, value) => key === 'element' && isInvalidElementValue(value),
      })
      if (nextValues !== existing.values) rowsToPut.push({ ...existing, values: nextValues, updatedAt: now })
    }

    await db.transaction('rw', db.catalogRows, db.meta, async () => {
      if (legacyPlaceholderIds.length > 0) await db.catalogRows.bulkDelete(legacyPlaceholderIds)
      if (rowsToPut.length > 0) await db.catalogRows.bulkPut(rowsToPut)
      if (isVersionedPreset) {
        await db.meta.put({
          key: 'rockKingdomRowsVersion',
          value: presetMigration?.version || ROCK_KINGDOM_ROWS_VERSION,
        })
      }
    })
    return true
  } catch (err) {
    // 预置资料离线或抓取失败时，骨架仍应可用。不能用 mock 数据兜底。
    console.warn('加载洛克王国预置资料行失败：', err)
    return false
  }
}


// 孵蛋字段迁移：正式 rockKingdomRows.json 已包含 BWiki 繁育快照合并结果；
// 这里只补齐字段结构与标签，不覆盖用户已有非空字段。

async function migrateRockKingdomBreedingFieldLabels() {
  const tableId = ROCK_KINGDOM_PRESET.tables[0].id
  const ownedTableId = `table-owned-${ROCK_KINGDOM_PRESET.scene.id}`
  const now = nowIso()
  const labelUpdates = [
    { tableId, key: 'shiny', name: '异色形态' },
    { tableId, key: 'traitName', name: '特性' },
    { tableId, key: 'speciesGroup', name: '繁育谱系' },
    { tableId, key: 'evolutionLine', name: '进化链' },
    { tableId: ownedTableId, key: 'shiny', name: '个体异色' },
  ]
  for (const update of labelUpdates) {
    const field = await db.catalogFields
      .where('tableId')
      .equals(update.tableId)
      .filter((item) => item.key === update.key)
      .first()
    if (field && field.name !== update.name) {
      await db.catalogFields.update(field.id, { name: update.name, updatedAt: now })
    }
  }
  const traitIconField = await db.catalogFields
    .where('tableId')
    .equals(tableId)
    .filter((item) => item.key === 'traitIcon')
    .first()
  if (traitIconField && !traitIconField.hidden) {
    await db.catalogFields.update(traitIconField.id, { hidden: true, updatedAt: now })
  }
}

async function seedRockKingdomBreedingDemoOwnedRows() {
  const scene = await db.scenes.get(ROCK_KINGDOM_PRESET.scene.id)
  if (!scene) return
  const demoMeta = await db.meta.get('seededRockKingdomBreedingDemoOwnedRows')
  if (demoMeta?.value) return
  const ownedTable = await ensureOwnedTable(ROCK_KINGDOM_PRESET.scene.id)
  const existingOwnedRows = await db.catalogRows.where('tableId').equals(ownedTable.id).count()
  if (existingOwnedRows > 0) {
    await db.meta.put({ key: 'seededRockKingdomBreedingDemoOwnedRows', value: 'skipped-existing-owned' })
    return
  }
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const creatureRows = await db.catalogRows.where('tableId').equals(creatureTableId).toArray()
  const creatureByName = new Map(creatureRows.map((row) => [row.values?.name, row]))
  const now = nowIso()
  const rowsToPut = BREEDING_DEMO_OWNED.flatMap((demo, index) => {
    const creature = creatureByName.get(demo.name)
    if (!creature) return []
    return [{
      id: `owned-rock-breeding-demo-${index + 1}`,
      tableId: ownedTable.id,
      values: {
        ref: creature.id,
        nature: demo.nature,
        bloodline: '',
        shiny: demo.shiny,
        colorful: demo.colorful,
        specialty: '',
        gender: demo.gender,
        note: demo.note,
      },
      createdAt: now,
      updatedAt: now,
    }]
  })
  await db.transaction('rw', db.catalogRows, db.meta, async () => {
    if (rowsToPut.length > 0) await db.catalogRows.bulkPut(rowsToPut)
    await db.meta.put({ key: 'seededRockKingdomBreedingDemoOwnedRows', value: true })
  })
}

async function migrateRockKingdomSkillRows(presetMigration) {
  const table = ROCK_KINGDOM_PRESET.tables.find((item) => item.id === 'table-rock-kingdom-skills')
  if (!table) return true
  const existingTable = await db.catalogTables.get(table.id)
  if (!existingTable) return
  try {
    const res = await fetch(presetUrl('rockKingdomSkillRows.json'))
    if (!res.ok) return false
    const presetRows = await res.json()
    const now = nowIso()
    const existingRows = await db.catalogRows.where('tableId').equals(table.id).toArray()
    const existingById = new Map(existingRows.map((row) => [row.id, row]))
    const patchesById = new Map((presetMigration?.skills?.rows ?? []).map((row) => [row.id, row.fields ?? []]))
    const rowsToPut = []
    for (const row of (Array.isArray(presetRows) ? presetRows : []).filter((item) => item.id)) {
      const existing = existingById.get(row.id)
      if (!existing) {
        rowsToPut.push({
          id: row.id,
          tableId: table.id,
          values: row.values || {},
          createdAt: row.createdAt || now,
          updatedAt: row.updatedAt || now,
        })
        continue
      }
      const nextValues = await mergeVersionedPresetValues({
        existingValues: existing.values,
        presetValues: row.values || {},
        fieldPatches: patchesById.get(row.id),
      })
      if (nextValues !== existing.values) rowsToPut.push({ ...existing, values: nextValues, updatedAt: now })
    }
    await db.transaction('rw', db.catalogRows, db.meta, async () => {
      if (rowsToPut.length > 0) await db.catalogRows.bulkPut(rowsToPut)
      await db.meta.put({
        key: 'rockKingdomSkillRowsVersion',
        value: presetMigration?.version || ROCK_KINGDOM_ROWS_VERSION,
      })
    })
    return true
  } catch (err) {
    console.warn('加载洛克王国技能预置资料行失败：', err)
    return false
  }
}
