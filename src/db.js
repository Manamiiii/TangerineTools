// Dexie 数据库定义：schema、初始化、预置资料加载、
// 场景 / 资料表 / 字段 / 行的基础 CRUD，以及全量导出/导入。

import Dexie from 'dexie'
import { ROCK_KINGDOM_PRESET, TRAIT_TAG_LEGACY_DEFAULTS } from './presets/rockKingdom.js'
import { STOCK_FIXED_FIELDS, STOCK_TABLE_NAME } from './domain/stock.js'
import { deriveFieldKey, generateId, mergeFieldOptions, normalizeField, nowIso } from './utils.js'

export const db = new Dexie('tangerine-tools')

db.version(1).stores({
  scenes: 'id, order',
  catalogTables: 'id, sceneId, order',
  catalogFields: 'id, tableId, order',
  catalogRows: 'id, tableId',
  meta: 'key',
})

// ---------------------------------------------------------------------------
// 初始化 / 预置资料
// ---------------------------------------------------------------------------

export async function ensureSeeded() {
  const seeded = await db.meta.get('seededRockKingdom')
  if (!seeded?.value) {
    await seedRockKingdomStructure()
    await db.meta.put({ key: 'seededRockKingdom', value: true })
  }
  // 以下几步在每次启动时都会执行（不受 seededRockKingdom 一次性标记限制），
  // 目的是让"已经播种过"的老用户也能安全地补齐后续新增的字段选项/预置行/默认工具，
  // 同时尊重用户已删除的场景/资料表、已有的自定义编辑，不做覆盖式重置。
  await migrateRockKingdomFieldOptions()
  await migrateRockKingdomRows()
  await migrateRockKingdomSceneTools()
}

// 洛克王国场景第一轮的旧默认值只启用了资料库工具；这一轮把新默认值改为三个工具
// 都启用。这里只处理老用户"场景 tools 仍然恰好等于旧默认值"的情况，自动补齐为
// 新默认值；只要用户自定义过 tools（无论是关掉了资料库、只手动开了库存，还是
// 任何不同于旧默认值的组合），一律不覆盖，尊重用户的选择。场景已被用户删除时跳过。
const LEGACY_DEFAULT_SCENE_TOOLS = ['catalog']

async function migrateRockKingdomSceneTools() {
  const scene = await db.scenes.get(ROCK_KINGDOM_PRESET.scene.id)
  if (!scene) return
  const isLegacyDefault =
    Array.isArray(scene.tools) &&
    scene.tools.length === LEGACY_DEFAULT_SCENE_TOOLS.length &&
    scene.tools.every((tool, index) => tool === LEGACY_DEFAULT_SCENE_TOOLS[index])
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

// 为已存在的洛克王国字段（如特性标签）补齐预置里新增的选项，并且只在用户
// 尚未自定义过旧选项时才更新其展示名/颜色。字段本身已被用户删除时跳过，
// 不做任何恢复。
async function migrateRockKingdomFieldOptions() {
  for (const presetField of ROCK_KINGDOM_PRESET.fields) {
    if (!Array.isArray(presetField.options) || presetField.options.length === 0) continue
    const existingField = await db.catalogFields.get(presetField.id)
    if (!existingField) continue
    const legacyDefaults = presetField.key === 'traitTags' ? TRAIT_TAG_LEGACY_DEFAULTS : {}
    const mergedOptions = mergeFieldOptions(existingField.options, presetField.options, legacyDefaults)
    if (JSON.stringify(mergedOptions) !== JSON.stringify(existingField.options)) {
      await db.catalogFields.update(presetField.id, { options: mergedOptions, updatedAt: nowIso() })
    }
  }
}

// 补齐预置行数据：只插入本地还不存在（按 id 判断）的行，已存在的行（含用户
// 编辑过的）一律不动。资料表已被用户删除时跳过，不做任何恢复。
async function migrateRockKingdomRows() {
  const tableId = ROCK_KINGDOM_PRESET.tables[0].id
  const table = await db.catalogTables.get(tableId)
  if (!table) return
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}presets/rockKingdomRows.json`)
    if (!res.ok) return
    const presetRows = await res.json()
    const existingIds = new Set(await db.catalogRows.where('tableId').equals(tableId).primaryKeys())
    const now = nowIso()
    const rowsToInsert = presetRows
      .filter((row) => row.id && !existingIds.has(row.id))
      .map((row) => ({
        id: row.id,
        tableId,
        values: row.values || {},
        createdAt: row.createdAt || now,
        updatedAt: row.updatedAt || now,
      }))
    if (rowsToInsert.length > 0) {
      await db.catalogRows.bulkPut(rowsToInsert)
    }
  } catch (err) {
    // 预置资料只是锦上添花的 mock 数据；离线或抓取失败时，骨架仍应可用。
    console.warn('加载洛克王国预置资料行失败：', err)
  }
}

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------

export async function createScene({ name, type, color, tools }) {
  const count = await db.scenes.count()
  const now = nowIso()
  const scene = {
    id: generateId('scene'),
    name,
    type,
    color,
    tools: tools || [],
    order: count,
    createdAt: now,
    updatedAt: now,
  }
  await db.scenes.put(scene)
  return scene
}

export async function updateScene(id, patch) {
  await db.scenes.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteScene(id) {
  const tables = await db.catalogTables.where('sceneId').equals(id).toArray()
  await db.transaction(
    'rw',
    db.scenes,
    db.catalogTables,
    db.catalogFields,
    db.catalogRows,
    async () => {
      for (const table of tables) {
        await deleteCatalogTableInternal(table.id)
      }
      await db.scenes.delete(id)
    },
  )
}

export async function reorderScenes(orderedIds) {
  const now = nowIso()
  await db.transaction('rw', db.scenes, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.scenes.update(id, { order: index, updatedAt: now })),
    )
  })
}

// ---------------------------------------------------------------------------
// 资料表（catalogTables）
// ---------------------------------------------------------------------------

export async function createCatalogTable(sceneId, name) {
  const count = await db.catalogTables.where('sceneId').equals(sceneId).count()
  const now = nowIso()
  const table = {
    id: generateId('table'),
    sceneId,
    name,
    order: count,
    createdAt: now,
    updatedAt: now,
  }
  await db.catalogTables.put(table)
  return table
}

export async function renameCatalogTable(id, name) {
  await db.catalogTables.update(id, { name, updatedAt: nowIso() })
}

export async function deleteCatalogTable(id) {
  await db.transaction('rw', db.catalogTables, db.catalogFields, db.catalogRows, async () => {
    await deleteCatalogTableInternal(id)
  })
}

async function deleteCatalogTableInternal(id) {
  await db.catalogFields.where('tableId').equals(id).delete()
  await db.catalogRows.where('tableId').equals(id).delete()
  await db.catalogTables.delete(id)
}

// 属性库存：复用 catalogTables/catalogFields 存储，通过 kind: 'stock' 标记
// 与资料库的普通资料表区分开，避免混入资料库工具的资料表选择器。
// 幂等：同一场景只会创建一次，已存在时直接返回，不会覆盖用户数据。
export async function ensureStockTable(sceneId) {
  const existing = await db.catalogTables
    .where('sceneId')
    .equals(sceneId)
    .filter((t) => t.kind === 'stock')
    .first()
  if (existing) return existing

  const now = nowIso()
  const order = await db.catalogTables.where('sceneId').equals(sceneId).count()
  const table = {
    id: generateId('table'),
    sceneId,
    name: STOCK_TABLE_NAME,
    kind: 'stock',
    order,
    createdAt: now,
    updatedAt: now,
  }
  const fields = STOCK_FIXED_FIELDS.map((f, index) =>
    normalizeField({
      id: generateId('field'),
      tableId: table.id,
      key: f.key,
      name: f.name,
      type: f.type,
      order: index,
      options: f.options,
      createdAt: now,
      updatedAt: now,
    }),
  )
  await db.transaction('rw', db.catalogTables, db.catalogFields, async () => {
    await db.catalogTables.put(table)
    for (const field of fields) await db.catalogFields.put(field)
  })
  return table
}

// ---------------------------------------------------------------------------
// 字段（catalogFields）
// ---------------------------------------------------------------------------

export async function createField(tableId, { name, type }, atIndex = null) {
  const existing = await db.catalogFields.where('tableId').equals(tableId).sortBy('order')
  const key = deriveFieldKey(
    name,
    existing.map((f) => f.key),
  )
  const now = nowIso()
  const field = normalizeField({
    id: generateId('field'),
    tableId,
    key,
    name,
    type,
    order: atIndex == null ? existing.length : atIndex,
    createdAt: now,
    updatedAt: now,
  })
  if (atIndex == null) {
    await db.catalogFields.put(field)
    return field
  }
  const ordered = [...existing]
  ordered.splice(atIndex, 0, field)
  await db.transaction('rw', db.catalogFields, async () => {
    await Promise.all(ordered.map((f, index) => db.catalogFields.put({ ...f, order: index })))
  })
  return field
}

export async function updateField(id, patch) {
  await db.catalogFields.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteField(id) {
  await db.catalogFields.delete(id)
}

export async function reorderFields(orderedIds) {
  const now = nowIso()
  await db.transaction('rw', db.catalogFields, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.catalogFields.update(id, { order: index, updatedAt: now })),
    )
  })
}

// ---------------------------------------------------------------------------
// 行（catalogRows）
// ---------------------------------------------------------------------------

export async function createRow(tableId, values) {
  const now = nowIso()
  const row = { id: generateId('row'), tableId, values, createdAt: now, updatedAt: now }
  await db.catalogRows.put(row)
  return row
}

export async function updateRow(id, values) {
  await db.catalogRows.update(id, { values, updatedAt: nowIso() })
}

export async function deleteRow(id) {
  await db.catalogRows.delete(id)
}

// ---------------------------------------------------------------------------
// 全量导出 / 导入
// ---------------------------------------------------------------------------

export const EXPORT_SCHEMA_VERSION = 1

export async function exportAllData() {
  const [scenes, catalogTables, catalogFields, catalogRows, meta] = await Promise.all([
    db.scenes.toArray(),
    db.catalogTables.toArray(),
    db.catalogFields.toArray(),
    db.catalogRows.toArray(),
    db.meta.toArray(),
  ])
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: { scenes, catalogTables, catalogFields, catalogRows, meta },
  }
}

const IMPORTABLE_KEYS = ['scenes', 'catalogTables', 'catalogFields', 'catalogRows', 'meta']

export function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object') return '文件内容不是有效的 JSON 对象'
  if (!payload.data || typeof payload.data !== 'object') return '文件缺少 data 字段'
  for (const key of IMPORTABLE_KEYS) {
    if (payload.data[key] !== undefined && !Array.isArray(payload.data[key])) {
      return `data.${key} 必须是数组`
    }
  }
  const hasAny = IMPORTABLE_KEYS.some((key) => Array.isArray(payload.data[key]))
  if (!hasAny) return '文件不包含任何可导入的数据'
  return null
}

// 导入策略：同 id 覆盖，文件中不存在的本地数据保留。
export async function importAllData(payload) {
  const error = validateImportPayload(payload)
  if (error) throw new Error(error)
  const { data } = payload
  await db.transaction(
    'rw',
    db.scenes,
    db.catalogTables,
    db.catalogFields,
    db.catalogRows,
    db.meta,
    async () => {
      if (data.scenes) await db.scenes.bulkPut(data.scenes)
      if (data.catalogTables) await db.catalogTables.bulkPut(data.catalogTables)
      if (data.catalogFields) await db.catalogFields.bulkPut(data.catalogFields)
      if (data.catalogRows) await db.catalogRows.bulkPut(data.catalogRows)
      if (data.meta) await db.meta.bulkPut(data.meta)
    },
  )
}
